import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import Header from '../componentes/Header';
import { prettyType, mapPriorityToLevel, normalizeName } from '../lib/services/tipos';


export default function Home() {
  const navigate = useNavigate();
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const geojsonLayerRef = useRef(null);
  const geojsonDataRef = useRef(null);
  const neighborhoodLayersRef = useRef({});
  const reportDataRef = useRef({});
  const reportMarkersLayerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [recentReports, setRecentReports] = useState([]);

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
    const name = feature.properties.BARRIO || feature.properties.NOMBRE || feature.properties.nombre || feature.properties.NAME || feature.properties.Name || feature.properties.name;
    return { fillColor: getColor(name), weight: 2, opacity: 1, color: 'white', dashArray: '3', fillOpacity: 0.7 };
  }

  function popupContentFor(neighborhoodName) {
    const data = findReportData(neighborhoodName);
    let html = `<div class="p-3"><h3 class="font-bold text-lg mb-2">${neighborhoodName || 'Sin nombre'}</h3>`;
    if (data && data.reports && data.reports.length) {
      html += `<p class="text-sm"><strong>Total reportes:</strong> ${data.total}</p><div class="mt-2 space-y-2">`;
      data.reports.slice(0, 10).forEach((r) => {
        const desc = (r.descripcion || r.ubicacion || '').toString().slice(0, 120);
        const priLabel = prettyType(r.tipo || r.prioridad || '');
        html += `<div class="p-2 rounded bg-white border">`;
        html += `<div class="flex items-center justify-between"><div class="text-sm font-semibold">${priLabel || 'Tipo desconocido'}</div><div class="text-xs text-gray-500">${r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleString() : ''}</div></div>`;
        html += `<div class="text-sm text-gray-700 mt-1">${desc}</div></div>`;
      });
      if (data.reports.length > 10) html += `<div class="text-xs text-gray-500 mt-2">Mostrando 10 de ${data.reports.length} reportes</div>`;
      html += `</div>`;
    } else {
      html += `<p class="text-sm text-gray-600">Sin reportes registrados</p>`;
    }
    html += `</div>`;
    return html;
  }

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

  async function loadReportMarkers() {
    const map = mapRef.current;
    if (!map) return;
    try {
      const res = await fetch('/api/reportes/', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      reportMarkersLayerRef.current.clearLayers();
      const reportData = {};

      const TYPE_WEIGHTS = {
        robo: 3.0, asalto: 3.5, violencia: 3.5, hurto: 1.8, vandalismo: 1.5,
        iluminacion: 0.8, accidente: 1.2, consumo_drogas: 2.2, 'consumo/venta de drogas': 2.2,
        incendio: 3.5, amenaza: 2.5, robo_vehiculo: 3.0, acoso_callejero: 2.0,
        prostitucion_ilegal: 2.0, fraude_estafa: 1.5, otro: 1.0,
      };

      data.reportes.forEach((r) => {
        if ((!r.zona || r.zona === 'Sin zona') && r.coordenadas && Array.isArray(r.coordenadas) && geojsonDataRef.current) {
          try {
            const lng = parseFloat(r.coordenadas[0]);
            const lat = parseFloat(r.coordenadas[1]);
            const f = pointInGeoJSON(lng, lat);
            if (f?.properties) {
              const name = f.properties.BARRIO || f.properties.NOMBRE || f.properties.nombre || f.properties.NAME || f.properties.Name || f.properties.name;
              if (name) r.zona = name;
            }
          } catch (e) { /* ignore */ }
        }

        if (r.coordenadas && Array.isArray(r.coordenadas)) {
          const [lng, lat] = r.coordenadas.length === 2 ? r.coordenadas : [r.coordenadas[0], r.coordenadas[1]];
          const pri = prettyType(r.tipo || r.prioridad || '');
          const color = (pri.includes('alto') || pri.includes('muy')) ? '#b11' : (pri.includes('medio') ? '#f39c12' : '#2ecc71');
          const marker = L.circleMarker([lat, lng], { radius: 6, fillColor: color, color: '#000', weight: 1, opacity: 1, fillOpacity: 0.9 }).addTo(reportMarkersLayerRef.current);
          const markerTitle = prettyType(r.tipo || r.prioridad || '') || 'Reporte';
          marker.bindPopup(`<div class="p-2"><h3 class="font-bold">${markerTitle}</h3><p class="text-sm">${r.descripcion || ''}</p><p class="text-xs">Zona: ${r.zona || 'N/A'}</p></div>`);
        }

        const z = r.zona || 'Sin zona';
        const zKey = normalizeName(z);
        if (!reportData[zKey]) reportData[zKey] = { total: 0, score: 0, reports: [], __displayName: z };
        reportData[zKey].total += 1;

        const pr = (r.prioridad || r.tipo || '').toString().toLowerCase().trim();
        let w = 1;
        if (pr) {
          if (TYPE_WEIGHTS[pr]) w = TYPE_WEIGHTS[pr];
          else if (pr.includes('robo') && pr.includes('vehicul')) w = TYPE_WEIGHTS.robo_vehiculo;
          else if (pr.includes('robo')) w = TYPE_WEIGHTS.robo;
          else if (pr.includes('asalto')) w = TYPE_WEIGHTS.asalto;
          else if (pr.includes('violencia')) w = TYPE_WEIGHTS.violencia;
          else if (pr.includes('hurto')) w = TYPE_WEIGHTS.hurto;
          else if (pr.includes('vandal')) w = TYPE_WEIGHTS.vandalismo;
          else if (pr.includes('ilumin') || pr.includes('luz')) w = TYPE_WEIGHTS.iluminacion;
          else if (pr.includes('accident')) w = TYPE_WEIGHTS.accidente;
          else if (pr.includes('drog')) w = TYPE_WEIGHTS.consumo_drogas;
          else if (pr.includes('incend')) w = TYPE_WEIGHTS.incendio;
          else if (pr.includes('amenaz')) w = TYPE_WEIGHTS.amenaza;
          else if (pr.includes('acoso')) w = TYPE_WEIGHTS.acoso_callejero;
          else if (pr.includes('prostitucion')) w = TYPE_WEIGHTS.prostitucion_ilegal;
          else if (pr.includes('fraud') || pr.includes('estaf')) w = TYPE_WEIGHTS.fraude_estafa;
          else if (pr.includes('muy') && pr.includes('alto')) w = 3;
          else if (pr.includes('alto')) w = 2;
          else if (pr.includes('medio')) w = 1.2;
          else if (pr.includes('bajo')) w = 0.6;
        }
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
      reportDataRef.current = reportData;

      const geojsonLayer = geojsonLayerRef.current;
      if (geojsonLayer) {
        geojsonLayer.setStyle(styleFeature);
        geojsonLayer.eachLayer((layer) => {
          const feat = layer.feature;
          if (feat) {
            const name = feat.properties.BARRIO || feat.properties.NOMBRE || feat.properties.nombre || feat.properties.NAME || feat.properties.Name || feat.properties.name;
            layer.bindPopup(popupContentFor(name), { maxWidth: 400 });
          }
        });
      }
    } catch (err) {
      console.warn('No se pudieron cargar reportes:', err);
    }
  }

  async function renderRecentReports() {
    try {
      const res = await fetch('/api/reportes/', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.reportes.map((r) => {
        if ((!r.zona || r.zona === 'Sin zona') && r.coordenadas && Array.isArray(r.coordenadas) && geojsonDataRef.current) {
          try {
            const lng = parseFloat(r.coordenadas[0]);
            const lat = parseFloat(r.coordenadas[1]);
            const f = pointInGeoJSON(lng, lat);
            if (f?.properties) {
              const name = f.properties.BARRIO || f.properties.NOMBRE || f.properties.nombre || f.properties.NAME || f.properties.Name || f.properties.name;
              if (name) r.zona = name;
            }
          } catch (e) { /* ignore */ }
        }
        return r;
      });
      setRecentReports(items);
    } catch (e) {
      console.warn('No se pudieron renderizar reportes recientes', e);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const map = L.map(mapDivRef.current, {
      zoomControl: false, //Quita los botones por defecto de zoom de Leaflet, ya que se agregan manualmente en la esquina inferior derecha
    }
    ).setView([4.716, -74.212], 13);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    reportMarkersLayerRef.current = L.layerGroup().addTo(map);

    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      const grades = [
        { color: '#90EE90', label: 'Sin reportes' },
        { color: '#FFA07A', label: 'Riesgo muy bajo' },
        { color: '#FF6347', label: 'Riesgo bajo' },
        { color: '#FF4500', label: 'Riesgo medio' },
        { color: '#DC143C', label: 'Riesgo alto' },
        { color: '#8B0000', label: 'Riesgo muy alto' },
      ];
      div.innerHTML = '<h4 style="margin:0 0 10px 0;font-weight:bold;">Nivel de Riesgo</h4>';
      grades.forEach((g) => { div.innerHTML += `<i style="background:${g.color}"></i> ${g.label}<br>`; });
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

        function onEachFeature(feature, layer) {
          const name = feature.properties.BARRIO || feature.properties.NOMBRE || feature.properties.nombre || feature.properties.NAME || feature.properties.Name || feature.properties.name;
          layer.bindPopup(popupContentFor(name), { maxWidth: 400 });
          if (name) {
            const key = normalizeName(name);
            if (!neighborhoodLayersRef.current[key]) neighborhoodLayersRef.current[key] = [];
            neighborhoodLayersRef.current[key].push(layer);
          }
          layer.on({
            mouseover: (e) => { e.target.setStyle({ weight: 5, color: '#666', dashArray: '', fillOpacity: 0.8 }); e.target.bringToFront(); },
            mouseout: (e) => geojsonLayerRef.current.resetStyle(e.target),
            click: (e) => map.fitBounds(e.target.getBounds()),
          });
        }

        const layer = L.geoJSON(geojsonData, { style: styleFeature, onEachFeature }).addTo(map);
        geojsonLayerRef.current = layer;
        map.fitBounds(layer.getBounds());

        const names = [];
        geojsonData.features.forEach((f) => {
          const name = f.properties.BARRIO || f.properties.NOMBRE || f.properties.nombre || f.properties.NAME || f.properties.Name || f.properties.name;
          if (name && !names.includes(name)) names.push(name);
        });
        setNeighborhoods(names.sort());
        setLoading(false);
      } catch (error) {
        if (!cancelled) {
          console.error('Error cargando el archivo GeoJSON:', error);
          setLoadError(String(error).slice(0, 200));
        }
      }
    }

    loadGeoJSON().then(() => { if (!cancelled) { loadReportMarkers(); renderRecentReports(); } });

    const POLL_INTERVAL = 20000;
    let pollTimer = null;
    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(async () => { await loadReportMarkers(); await renderRecentReports(); }, POLL_INTERVAL);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNeighborhoodChange(e) {
    const val = e.target.value;
    const map = mapRef.current;
    const geojsonLayer = geojsonLayerRef.current;
    if (!map || !geojsonLayer) return;
    if (!val) {
      geojsonLayer.eachLayer((l) => geojsonLayer.resetStyle(l));
      map.fitBounds(geojsonLayer.getBounds());
      return;
    }
    const layers = neighborhoodLayersRef.current[normalizeName(val)] || [];
    geojsonLayer.eachLayer((l) => geojsonLayer.resetStyle(l));
    if (layers.length) {
      layers.forEach((l) => l.setStyle({ weight: 5, color: '#000', fillOpacity: 0.9 }));
      map.fitBounds(L.featureGroup(layers).getBounds());
    }
  }

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

  return (
    <div className="relative flex h-screen w-full flex-col overflow-x-hidden" style={{ background: 'var(--background-color)' }}>
      <Header />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-96 flex-shrink-0 border-r border-gray-200 p-6" style={{ background: 'var(--background-color)' }}>
          <div className="flex flex-col gap-6">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-white text-base font-bold shadow-sm hover:opacity-90 transition-colors"
              onClick={() => navigate('/reporte/form')}
            >
              <span className="material-symbols-outlined">add_location_alt</span>
              <span className="truncate">Reportar Nueva Zona</span>
            </button>

            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4">Filtros</h3>
              <div className="space-y-4">
                <select className="form-select w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary px-3 py-2" defaultValue="">
                  <option value="" disabled>Tipo de Riesgo</option>
                  <option value="">Todos</option>
                </select>
                <input className="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary px-3 py-2" placeholder="Fecha" type="date" />
                <select className="form-select w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary px-3 py-2" defaultValue="">
                  <option value="" disabled>Estado</option>
                  <option>Activo</option>
                  <option>Resuelto</option>
                  <option>En progreso</option>
                </select>
                <select className="form-select w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary px-3 py-2" onChange={handleNeighborhoodChange} defaultValue="">
                  <option value="" disabled>Zona/Barrio</option>
                  <option value="">Todos los barrios</option>
                  {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4">Reportes Recientes</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {recentReports.map((r) => {
                  const level = mapPriorityToLevel(r.prioridad || r.tipo || '');
                  const color = level === 'Alto' ? 'bg-red-500' : level === 'Medio' ? 'bg-yellow-500' : 'bg-green-500';
                  const textColor = level === 'Alto' ? 'text-red-600' : level === 'Medio' ? 'text-yellow-600' : 'text-green-600';
                  const typeLabel = prettyType(r.tipo || r.prioridad || '');
                  return (
                    <div key={r.id} className="flex items-center gap-4 rounded-md border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer bg-white">
                      <div className={`w-1.5 h-16 rounded-full ${color}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${textColor}`}>{typeLabel || `Riesgo ${level}`}</p>
                        <p className="font-bold text-text-primary">{r.descripcion ? r.descripcion.slice(0, 60) : r.ubicacion}</p>
                        <p className="text-xs text-text-secondary">Zona: {r.zona || 'Sin zona'}</p>
                      </div>
                      <button aria-label="Ver detalle" onClick={() => navigate(`/reportes/${r.id}`)}>
                        <span className="material-symbols-outlined text-text-secondary">chevron_right</span>
                      </button>
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
              <input className="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary pl-12 pr-4 py-3 bg-white" placeholder="Buscar en el mapa..." type="text" />
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
