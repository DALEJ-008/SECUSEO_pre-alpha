import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import Header from '../componentes/Header';
import { prettyType, nivelDeRiesgo, normalizeName, COLOR_NIVEL, TIPOS_RIESGO } from '../lib/services/tipos';

const FILTROS_INICIALES = { q: '', tipo: '', nivel: '', desde: '', hasta: '', barrio: '' };

// Pesos por tipo de riesgo para colorear los barrios (más peso = barrio más rojo)
const TYPE_WEIGHTS = {
  robo: 3.0, asalto: 3.5, violencia: 3.5, hurto: 1.8, vandalismo: 1.5,
  iluminacion: 0.8, accidente: 1.2, consumo_drogas: 2.2, 'consumo/venta de drogas': 2.2,
  incendio: 3.5, amenaza: 2.5, robo_vehiculo: 3.0, acoso_callejero: 2.0,
  prostitucion_ilegal: 2.0, fraude_estafa: 1.5, agresiones_fisicas: 3.0, extorsion: 3.0, otro: 1.0,
};

function nombreBarrio(p) {
  return p?.BARRIO || p?.NOMBRE || p?.nombre || p?.NAME || p?.Name || p?.name;
}

// Evita inyectar HTML desde descripciones/ubicaciones escritas por usuarios
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Fecha local en formato YYYY-MM-DD para comparar con <input type="date">
function fechaLocalISO(value) {
  const d = new Date(value);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Home() {
  const navigate = useNavigate();
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const geojsonLayerRef = useRef(null);
  const geojsonDataRef = useRef(null);
  const neighborhoodLayersRef = useRef({});
  const reportDataRef = useRef({});
  const reportMarkersLayerRef = useRef(null);
  const fitPendingRef = useRef(false);
  const barrioRef = useRef('');
  const lastSigRef = useRef('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [geoReady, setGeoReady] = useState(false);
  const [allReports, setAllReports] = useState([]);
  const [filters, setFilters] = useState(FILTROS_INICIALES);

  barrioRef.current = filters.barrio;

  // ---------- Colores de los barrios (según los reportes que pasan los filtros) ----------
  function colorForRatio(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    const hue = (1 - r) * 120;
    return `hsl(${hue}, 75%, ${r > 0.6 ? '45%' : r > 0.3 ? '55%' : '70%'})`;
  }

  function findReportData(name) {
    if (!name) return null;
    return reportDataRef.current[normalizeName(name)] || null;
  }

  function getColor(neighborhoodName) {
    const data = findReportData(neighborhoodName);
    if (!data || !data.reports || data.reports.length === 0) return '#90EE90';
    const maxCombined = reportDataRef.current.__maxScore__ || 0;
    const combined = data.__combined__ || ((data.score || 0) * Math.log(1 + (data.total || 0)));
    if (maxCombined <= 0) return colorForRatio(0.18);
    let ratio = combined / maxCombined;
    if ((data.total || 0) > 0) {
      const minForAny = Math.min(0.12 + Math.log(1 + data.total) * 0.03, 0.25);
      ratio = Math.max(ratio, minForAny);
    }
    ratio = Math.min(ratio, 0.98);
    return colorForRatio(ratio);
  }

  function styleFeature(feature) {
    return { fillColor: getColor(nombreBarrio(feature.properties)), weight: 2, opacity: 1, color: 'white', dashArray: '3', fillOpacity: 0.7 };
  }

  function highlightBarrio() {
    const name = barrioRef.current;
    if (!name) return;
    (neighborhoodLayersRef.current[normalizeName(name)] || []).forEach((l) => l.setStyle({ weight: 5, color: '#000', fillOpacity: 0.9 }));
  }

  function popupContentFor(neighborhoodName) {
    const data = findReportData(neighborhoodName);
    let html = `<div class="p-3"><h3 class="font-bold text-lg mb-2">${esc(neighborhoodName || 'Sin nombre')}</h3>`;
    if (data && data.reports && data.reports.length) {
      html += `<p class="text-sm"><strong>Total reportes:</strong> ${data.total}</p><div class="mt-2 space-y-2">`;
      data.reports.slice(0, 10).forEach((r) => {
        const desc = (r.descripcion || r.ubicacion || '').toString().slice(0, 120);
        const color = COLOR_NIVEL[nivelDeRiesgo(r)];
        html += `<div class="p-2 rounded bg-white border">`;
        html += `<div class="flex items-center justify-between"><div class="text-sm font-semibold"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px"></span>${esc(prettyType(r.tipo) || 'Tipo desconocido')}</div><div class="text-xs text-gray-500">${r.fecha_creacion ? esc(new Date(r.fecha_creacion).toLocaleString()) : ''}</div></div>`;
        html += `<div class="text-sm text-gray-700 mt-1">${esc(desc)}</div></div>`;
      });
      if (data.reports.length > 10) html += `<div class="text-xs text-gray-500 mt-2">Mostrando 10 de ${data.reports.length} reportes</div>`;
      html += `</div>`;
    } else {
      html += `<p class="text-sm text-gray-600">Sin reportes con los filtros actuales</p>`;
    }
    html += `</div>`;
    return html;
  }

  function buildReportData(reports) {
    const reportData = {};
    reports.forEach((r) => {
      const z = r.zona || 'Sin zona';
      const zKey = normalizeName(z);
      if (!reportData[zKey]) reportData[zKey] = { total: 0, score: 0, reports: [], __displayName: z };
      reportData[zKey].total += 1;
      const pr = (r.tipo || r.prioridad || '').toString().toLowerCase().trim();
      let w = 1;
      if (TYPE_WEIGHTS[pr]) w = TYPE_WEIGHTS[pr];
      else if (pr === 'alto') w = 2;
      else if (pr === 'medio') w = 1.2;
      else if (pr === 'bajo') w = 0.6;
      reportData[zKey].score += w;
      reportData[zKey].reports.push(r);
    });
    let maxCombined = 0;
    Object.keys(reportData).forEach((k) => {
      const entry = reportData[k];
      const combined = (entry.score || 0) * Math.log(1 + (entry.total || 0));
      entry.__combined__ = combined;
      if (combined > maxCombined) maxCombined = combined;
    });
    reportData.__maxScore__ = maxCombined;
    return reportData;
  }

  // ---------- Punto dentro de polígono (para asignar barrio a reportes sin zona) ----------
  function _ringContains(x, y, ring) {
    let inside = false;
    let j = ring.length - 1;
    for (let i = 0; i < ring.length; i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
      j = i;
    }
    return inside;
  }

  function pointInGeoJSON(lon, lat) {
    const geo = geojsonDataRef.current;
    if (!geo || !geo.features) return null;
    for (const f of geo.features) {
      if (!f || !f.geometry) continue;
      const g = f.geometry;
      if (g.type === 'Polygon') {
        if (_ringContains(lon, lat, g.coordinates[0])) return f;
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates) {
          if (_ringContains(lon, lat, poly[0])) return f;
        }
      }
    }
    return null;
  }

  // ---------- Carga de reportes ----------
  async function loadReports() {
    try {
      const res = await fetch('/api/reportes/', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.reportes || [];
      // Solo se actualiza el estado si algo cambió (evita cerrar popups abiertos cada 20 s)
      const sig = JSON.stringify(list.map((r) => [r.id, r.estado, r.tipo, r.prioridad, r.zona, r.descripcion]));
      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;
      setAllReports(list);
    } catch (err) {
      console.warn('No se pudieron cargar reportes:', err);
    }
  }

  // ---------- Filtros ----------
  const reportsWithZone = useMemo(() => allReports.map((r) => {
    if ((!r.zona || r.zona === 'Sin zona') && Array.isArray(r.coordenadas) && geojsonDataRef.current) {
      const f = pointInGeoJSON(parseFloat(r.coordenadas[0]), parseFloat(r.coordenadas[1]));
      const name = nombreBarrio(f?.properties);
      if (name) return { ...r, zona: name };
    }
    return r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [allReports, geoReady]);

  // Reportes que cumplen tipo / nivel / fechas / texto (sirven para colorear los barrios)
  const baseFiltered = useMemo(() => {
    const q = normalizeName(filters.q);
    return reportsWithZone.filter((r) => {
      if (filters.tipo && normalizeName(r.tipo) !== filters.tipo) return false;
      if (filters.nivel && nivelDeRiesgo(r) !== filters.nivel) return false;
      if (filters.desde || filters.hasta) {
        const k = fechaLocalISO(r.fecha_creacion);
        if (!k) return false;
        if (filters.desde && k < filters.desde) return false;
        if (filters.hasta && k > filters.hasta) return false;
      }
      if (q) {
        const texto = normalizeName([r.descripcion, r.ubicacion, r.zona, prettyType(r.tipo)].join(' '));
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [reportsWithZone, filters.q, filters.tipo, filters.nivel, filters.desde, filters.hasta]);

  // Además filtra por barrio: lo que se ve como marcadores y en "Reportes recientes"
  const visibleReports = useMemo(() => {
    if (!filters.barrio) return baseFiltered;
    const key = normalizeName(filters.barrio);
    return baseFiltered.filter((r) => normalizeName(r.zona) === key);
  }, [baseFiltered, filters.barrio]);

  const tipoOptions = useMemo(() => {
    const base = [...TIPOS_RIESGO];
    const known = new Set(base.map((t) => t.value));
    allReports.forEach((r) => {
      const c = normalizeName(r.tipo);
      if (c && !known.has(c)) { known.add(c); base.push({ value: c, label: prettyType(c) }); }
    });
    return base.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [allReports]);

  const filtrosActivos = Object.values(filters).some(Boolean);

  function updateFilter(key, value) {
    if (key !== 'q') fitPendingRef.current = true; // reencuadra el mapa al cambiar un filtro
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function clearFilters() {
    fitPendingRef.current = true;
    setFilters(FILTROS_INICIALES);
  }

  // ---------- Dibuja marcadores y recolorea barrios cuando cambian datos o filtros ----------
  useEffect(() => {
    const map = mapRef.current;
    const group = reportMarkersLayerRef.current;
    if (!map || !group || !geoReady) return;

    group.clearLayers();
    const points = [];
    visibleReports.forEach((r) => {
      if (!Array.isArray(r.coordenadas)) return;
      const lng = parseFloat(r.coordenadas[0]);
      const lat = parseFloat(r.coordenadas[1]);
      if (isNaN(lat) || isNaN(lng)) return;
      const nivel = nivelDeRiesgo(r);
      const color = COLOR_NIVEL[nivel];
      const marker = L.circleMarker([lat, lng], { radius: 8, fillColor: color, color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.95 }).addTo(group);
      marker.bindPopup(
        `<div class="p-2" style="min-width:180px">`
        + `<h3 class="font-bold">${esc(prettyType(r.tipo) || 'Reporte')}</h3>`
        + `<p class="text-xs" style="margin:2px 0 6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px"></span>Riesgo ${nivel.toLowerCase()}</p>`
        + `<p class="text-sm">${esc(r.descripcion || '')}</p>`
        + `<p class="text-xs" style="margin-top:6px">Zona: ${esc(r.zona || 'N/A')}</p>`
        + `<p style="margin-top:6px"><a href="/reportes/${r.id}" data-report-id="${r.id}" style="color:#545dfa;font-weight:600;font-size:12px">Ver detalle</a></p>`
        + `</div>`,
      );
      points.push([lat, lng]);
    });

    reportDataRef.current = buildReportData(baseFiltered);
    const layer = geojsonLayerRef.current;
    if (layer) {
      layer.setStyle(styleFeature);
      highlightBarrio();
    }

    if (fitPendingRef.current) {
      fitPendingRef.current = false;
      const hayFiltroDeDatos = filters.tipo || filters.nivel || filters.desde || filters.hasta;
      if (filters.barrio) {
        const layers = neighborhoodLayersRef.current[normalizeName(filters.barrio)] || [];
        if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds());
      } else if (hayFiltroDeDatos && points.length) {
        map.fitBounds(points, { padding: [50, 50], maxZoom: 17 });
      } else if (!hayFiltroDeDatos && layer) {
        map.fitBounds(layer.getBounds());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleReports, baseFiltered, geoReady, filters]);

  // ---------- Inicialización del mapa ----------
  useEffect(() => {
    let cancelled = false;
    const map = L.map(mapDivRef.current, {
      zoomControl: false, // los botones de zoom se agregan manualmente abajo a la derecha
    }).setView([4.716, -74.212], 13);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    reportMarkersLayerRef.current = L.layerGroup().addTo(map);

    // "Ver detalle" dentro del popup de un marcador navega sin recargar la página
    map.on('popupopen', (e) => {
      const a = e.popup.getElement()?.querySelector('[data-report-id]');
      if (a) a.addEventListener('click', (ev) => { ev.preventDefault(); navigate(`/reportes/${a.dataset.reportId}`); });
    });

    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      const zonas = [
        { color: '#90EE90', label: 'Sin reportes' },
        { color: '#FFA07A', label: 'Riesgo muy bajo' },
        { color: '#FF6347', label: 'Riesgo bajo' },
        { color: '#FF4500', label: 'Riesgo medio' },
        { color: '#DC143C', label: 'Riesgo alto' },
        { color: '#8B0000', label: 'Riesgo muy alto' },
      ];
      let html = '<h4 style="margin:0 0 8px 0;font-weight:bold;">Nivel de riesgo del barrio</h4>';
      zonas.forEach((g) => { html += `<i style="background:${g.color}"></i> ${g.label}<br>`; });
      html += '<h4 style="margin:10px 0 8px 0;font-weight:bold;clear:both;">Puntos de reporte</h4>';
      [['Alto', 'Riesgo alto'], ['Medio', 'Riesgo medio'], ['Bajo', 'Riesgo bajo']].forEach(([n, label]) => {
        html += `<i style="background:${COLOR_NIVEL[n]};border-radius:50%;opacity:1"></i> ${label}<br>`;
      });
      div.innerHTML = html;
      return div;
    };
    legend.addTo(map);

    async function loadGeoJSON() {
      try {
        const res = await fetch('/Recursos/Barrios_Funza.geojson', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo cargar el GeoJSON');
        const geojsonData = await res.json();
        if (cancelled) return;
        geojsonDataRef.current = geojsonData;
        neighborhoodLayersRef.current = {};

        function onEachFeature(feature, layer) {
          const name = nombreBarrio(feature.properties);
          // El contenido se calcula al abrir el popup, así siempre refleja los filtros actuales
          layer.bindPopup(() => popupContentFor(name), { maxWidth: 400 });
          if (name) {
            const key = normalizeName(name);
            if (!neighborhoodLayersRef.current[key]) neighborhoodLayersRef.current[key] = [];
            neighborhoodLayersRef.current[key].push(layer);
          }
          layer.on({
            mouseover: (e) => { e.target.setStyle({ weight: 5, color: '#666', dashArray: '', fillOpacity: 0.8 }); e.target.bringToFront(); },
            mouseout: (e) => {
              geojsonLayerRef.current.resetStyle(e.target);
              if (name && barrioRef.current && normalizeName(name) === normalizeName(barrioRef.current)) {
                e.target.setStyle({ weight: 5, color: '#000', fillOpacity: 0.9 });
              }
            },
            click: (e) => map.fitBounds(e.target.getBounds()),
          });
        }

        const layer = L.geoJSON(geojsonData, { style: styleFeature, onEachFeature }).addTo(map);
        geojsonLayerRef.current = layer;
        map.fitBounds(layer.getBounds());

        const names = [];
        geojsonData.features.forEach((f) => {
          const name = nombreBarrio(f.properties);
          if (name && !names.includes(name)) names.push(name);
        });
        setNeighborhoods(names.sort());
        setLoading(false);
        setGeoReady(true);
      } catch (error) {
        if (!cancelled) {
          console.error('Error cargando el archivo GeoJSON:', error);
          setLoadError(String(error).slice(0, 200));
          setGeoReady(true); // aun sin barrios, se muestran los marcadores
        }
      }
    }

    loadGeoJSON().then(() => { if (!cancelled) loadReports(); });

    const POLL_INTERVAL = 20000;
    let pollTimer = null;
    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(loadReports, POLL_INTERVAL);
    }
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
    function onVisibility() { if (document.hidden) stopPolling(); else startPolling(); }
    startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
      map.remove();
      lastSigRef.current = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLocateMe() {
    const map = mapRef.current;
    if (!navigator.geolocation) { alert('Geolocalización no soportada'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        map.setView([lat, lng], 16);
        L.marker([lat, lng]).addTo(map).bindPopup('Tu ubicación actual').openPopup();
      },
      () => alert('No se pudo obtener tu ubicación'),
    );
  }

  const inputCls = 'form-input w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm';
  const selectCls = 'form-select w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm';

  return (
    <div className="relative flex h-screen w-full flex-col overflow-x-hidden" style={{ background: 'var(--background-color)' }}>
      <Header />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-96 flex-shrink-0 overflow-y-auto border-r border-gray-200 p-6" style={{ background: 'var(--background-color)', maxHeight: 'calc(100vh - 80px)' }}>
          <div className="flex flex-col gap-6">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-white text-base font-bold shadow-sm hover:opacity-90 transition-colors"
              onClick={() => navigate('/reporte/form')}
            >
              <span className="material-symbols-outlined">add_location_alt</span>
              <span className="truncate">Reportar Nueva Zona</span>
            </button>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary">Filtros</h3>
                {filtrosActivos && (
                  <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={clearFilters}>Limpiar filtros</button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="f-tipo">Tipo de riesgo</label>
                  <select id="f-tipo" className={selectCls} value={filters.tipo} onChange={(e) => updateFilter('tipo', e.target.value)}>
                    <option value="">Todos los tipos</option>
                    {tipoOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="f-nivel">Nivel de riesgo</label>
                  <select id="f-nivel" className={selectCls} value={filters.nivel} onChange={(e) => updateFilter('nivel', e.target.value)}>
                    <option value="">Todos los niveles</option>
                    <option value="Alto">Alto</option>
                    <option value="Medio">Medio</option>
                    <option value="Bajo">Bajo</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="f-desde">Desde</label>
                    <input id="f-desde" type="date" className={inputCls} value={filters.desde} max={filters.hasta || undefined} onChange={(e) => updateFilter('desde', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="f-hasta">Hasta</label>
                    <input id="f-hasta" type="date" className={inputCls} value={filters.hasta} min={filters.desde || undefined} onChange={(e) => updateFilter('hasta', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="f-barrio">Zona / Barrio</label>
                  <select id="f-barrio" className={selectCls} value={filters.barrio} onChange={(e) => updateFilter('barrio', e.target.value)}>
                    <option value="">Todos los barrios</option>
                    {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Mostrando {visibleReports.length} de {allReports.length} reportes
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4">Reportes Recientes</h3>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {visibleReports.length === 0 && (
                  <div className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                    {allReports.length === 0 ? 'Aún no hay reportes publicados' : 'Ningún reporte coincide con los filtros'}
                  </div>
                )}
                {visibleReports.map((r) => {
                  const level = nivelDeRiesgo(r);
                  const color = COLOR_NIVEL[level];
                  const typeLabel = prettyType(r.tipo);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-4 rounded-md border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer bg-white"
                      onClick={() => navigate(`/reportes/${r.id}`)}
                    >
                      <div className="w-1.5 h-16 flex-shrink-0 rounded-full" style={{ background: color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color }}>{typeLabel || `Riesgo ${level}`} · {level}</p>
                        <p className="font-bold text-text-primary truncate">{r.descripcion ? r.descripcion.slice(0, 60) : r.ubicacion}</p>
                        <p className="text-xs text-text-secondary">Zona: {r.zona || 'Sin zona'}</p>
                      </div>
                      <span className="material-symbols-outlined text-text-secondary">chevron_right</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Mapa */}
        <main className="flex-1 relative">
          {loading && !loadError && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 p-5 rounded-lg shadow-md z-[1000] flex items-center gap-2.5">
              <div className="spinner" />
              <span>Cargando delimitación de Funza...</span>
            </div>
          )}
          {loadError && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 p-5 rounded-lg shadow-md z-[1000] text-red-600 text-center">
              <span className="material-symbols-outlined">error</span>
              <div>Error al cargar la delimitación de Funza</div>
              <div className="text-sm mt-1">Verifique que el archivo GeoJSON esté en la ruta correcta</div>
              <div className="text-xs mt-2">Detalle: {loadError}</div>
            </div>
          )}

          <div className="absolute top-6 left-6 w-full max-w-sm z-[1000]">
            <label className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-text-secondary">search</span>
              <input
                className="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary pl-12 pr-4 py-3 bg-white"
                placeholder="Buscar reportes por texto, tipo o barrio..."
                type="text"
                value={filters.q}
                onChange={(e) => updateFilter('q', e.target.value)}
              />
            </label>
          </div>

          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-[1000]">
            <div className="flex flex-col rounded-md bg-white shadow-md">
              <button className="flex size-12 items-center justify-center text-text-primary hover:bg-gray-100 rounded-t-md" onClick={() => mapRef.current?.zoomIn()}>
                <span className="material-symbols-outlined">add</span>
              </button>
              <button className="flex size-12 items-center justify-center text-text-primary hover:bg-gray-100 rounded-b-md border-t border-gray-200" onClick={() => mapRef.current?.zoomOut()}>
                <span className="material-symbols-outlined">remove</span>
              </button>
            </div>
            <button className="flex size-12 items-center justify-center rounded-md bg-white shadow-md text-text-primary hover:bg-gray-100" onClick={handleLocateMe}>
              <span className="material-symbols-outlined">my_location</span>
            </button>
          </div>

          <div ref={mapDivRef} style={{ height: 'calc(100vh - 80px)', width: '100%' }} />
        </main>
      </div>
    </div>
  );
}
