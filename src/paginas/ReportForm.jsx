import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { apiFetch } from '../lib/services/api';
import { TIPOS_RIESGO } from '../lib/services/tipos';

// Migrado de Frontend/HTML/FormularioReporte.html.
export default function ReportForm() {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [riskType, setRiskType] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const miniMapDivRef = useRef(null);
  const miniMapRef = useRef(null);
  const pickMarkerRef = useRef(null);
  const zonasPolygonsRef = useRef([]);
  const zonasBBoxRef = useRef(null);
  const acTimerRef = useRef(null);
  const pendingPointRef = useRef(null);

  useEffect(() => {
    fetch('/Recursos/Barrios_Funza.geojson')
      .then((r) => r.json())
      .then((geo) => {
        try {
          let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
          const polys = [];
          (geo.features || []).forEach((f) => {
            const g = f.geometry;
            if (!g) return;
            const collect = (poly) => {
              polys.push(poly);
              poly[0].forEach((pt) => {
                const [lo, la] = pt;
                if (lo < minLon) minLon = lo;
                if (la < minLat) minLat = la;
                if (lo > maxLon) maxLon = lo;
                if (la > maxLat) maxLat = la;
              });
            };
            if (g.type === 'Polygon') collect(g.coordinates);
            else if (g.type === 'MultiPolygon') g.coordinates.forEach(collect);
          });
          zonasPolygonsRef.current = polys;
          if (isFinite(minLon)) zonasBBoxRef.current = [minLon, minLat, maxLon, maxLat];
        } catch (e) { console.warn('Error parsing zonas geojson', e); }
      })
      .catch(() => console.warn('No se pudo cargar Barrios_Funza.geojson para filtrar autocompletado'));
  }, []);

  function ringContains(x, y, ring) {
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

  function pointInAnyPolygon(lon, lat) {
    const polys = zonasPolygonsRef.current;
    if (!polys || polys.length === 0) return false;
    return polys.some((poly) => poly?.length && ringContains(lon, lat, poly[0]));
  }

  // Coloca (o mueve) el marcador en el minimapa y, opcionalmente, centra la vista
  function placeMarker(la, lo, zoom) {
    const map = miniMapRef.current;
    if (!map) return;
    const pos = [parseFloat(la), parseFloat(lo)];
    if (pickMarkerRef.current) pickMarkerRef.current.setLatLng(pos);
    else pickMarkerRef.current = L.marker(pos).addTo(map);
    if (zoom) map.setView(pos, zoom);
  }

  // Crea el minimapa cuando el contenedor ya existe en el DOM
  useEffect(() => {
    if (!showMiniMap) {
      if (miniMapRef.current) { miniMapRef.current.remove(); miniMapRef.current = null; pickMarkerRef.current = null; }
      return undefined;
    }
    if (miniMapRef.current || !miniMapDivRef.current) return undefined;

    const map = L.map(miniMapDivRef.current).setView([4.716, -74.212], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e) => {
      const { lat: la, lng: lo } = e.latlng;
      placeMarker(la, lo);
      setLat(la);
      setLng(lo);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}`)
        .then((r) => r.json()).then((data) => { if (data?.display_name) setLocation(data.display_name); })
        .catch(() => {});
    });
    miniMapRef.current = map;

    // Si ya había una ubicación elegida (p. ej. desde las sugerencias), se muestra
    if (pendingPointRef.current) {
      const [pla, plo] = pendingPointRef.current;
      placeMarker(pla, plo, 16);
      pendingPointRef.current = null;
    }
    // El contenedor acaba de aparecer: Leaflet necesita recalcular su tamaño
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showMiniMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al desmontar la página se destruye el mapa
  useEffect(() => () => {
    if (miniMapRef.current) { miniMapRef.current.remove(); miniMapRef.current = null; }
  }, []);

  function handleOpenMap() {
    setShowMiniMap(true);
    setTimeout(() => {
      miniMapDivRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function handleLocationInput(value) {
    setLocation(value);
    setSuggestions([]);
    if (acTimerRef.current) clearTimeout(acTimerRef.current);
    const q = value.trim();
    if (!q || q.length < 3) return;
    acTimerRef.current = setTimeout(async () => {
      try {
        let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=8`;
        const bbox = zonasBBoxRef.current;
        if (bbox) {
          const vb = [bbox[0], bbox[3], bbox[2], bbox[1]];
          url += `&viewbox=${vb.join(',')}&bounded=1`;
        }
        const res = await fetch(url);
        const arr = await res.json();
        const polys = zonasPolygonsRef.current;
        const filtered = arr.filter((item) => {
          if (!item?.lon || !item?.lat) return false;
          if (!polys || polys.length === 0) return true;
          return pointInAnyPolygon(parseFloat(item.lon), parseFloat(item.lat));
        });
        setSuggestions(filtered);
      } catch (e) { console.warn('autocomplete error', e); }
    }, 350);
  }

  function pickSuggestion(item) {
    setLocation(item.display_name);
    setLat(item.lat);
    setLng(item.lon);
    setSuggestions([]);
    if (miniMapRef.current) {
      placeMarker(item.lat, item.lon, 16);
    } else {
      pendingPointRef.current = [item.lat, item.lon];
      setShowMiniMap(true);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lat || !lng) {
      if (!confirm('No has seleccionado una ubicación exacta en el mapa. ¿Deseas continuar sin coordenadas?')) return;
    }
    const fd = new FormData();
    fd.append('ubicacion', location);
    fd.append('descripcion', description);
    fd.append('tipo', riskType || 'otro');
    if (lat && lng) { fd.append('lat', lat); fd.append('lng', lng); }
    if (file) fd.append('imagen', file);

    try {
      const res = await apiFetch('/api/reportes/crear/', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(`Error creando reporte: ${res.status} ${res.statusText}\n${err ? JSON.stringify(err, null, 2) : ''}`);
        return;
      }
      setShowMiniMap(false);
      setSubmitted(true);
    } catch (e) {
      alert('Error de red al crear el reporte');
    }
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden" style={{ background: 'var(--secondary-color)' }}>
      <div className="m-auto flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl my-10">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">Reportar una zona peligrosa</h2>
              <p className="text-sm text-slate-500">Ayúdanos a mantener segura a nuestra comunidad.</p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <img alt="SECUSEO Logo" className="h-12 w-auto" src="/img/Logo3.png" />
            </div>
          </div>
        </div>

        <form className="flex flex-col gap-4 p-6" onSubmit={handleSubmit}>
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-700">Ubicación</label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">location_on</span>
              <input
                className="form-input h-12 w-full rounded-lg border-slate-300 bg-slate-100 pl-10 pr-4"
                placeholder="Selecciona en el mapa o ingresa una dirección"
                type="text" value={location} onChange={(e) => handleLocationInput(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <button type="button" className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={handleOpenMap}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>pin_drop</span>
                Marcar en el mapa
              </button>
              {showMiniMap && <span className="text-xs text-slate-500">Haz clic en el mapa para marcar el punto exacto</span>}
            </div>
            {showMiniMap && (
              <div className="relative z-0 w-full overflow-hidden rounded-lg border border-slate-300" style={{ height: 280 }}>
                <div ref={miniMapDivRef} style={{ height: '100%', width: '100%' }} />
              </div>
            )}
            {showMiniMap && lat && lng && (
              <p className="mt-2 text-xs text-slate-500">Punto seleccionado: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</p>
            )}
            {suggestions.length > 0 && (
              <div className="mt-2">
                {suggestions.map((item, i) => (
                  <button key={i} type="button" className="w-full text-left p-2 hover:bg-slate-100 rounded block" onClick={() => pickSuggestion(item)}>
                    {item.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de riesgo</label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">warning</span>
              <select
                className="form-select h-12 w-full appearance-none rounded-lg border-slate-300 bg-slate-100 pl-10 pr-8"
                value={riskType} onChange={(e) => setRiskType(e.target.value)}
              >
                <option value="" disabled>Selecciona el tipo de riesgo</option>
                {TIPOS_RIESGO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
            <textarea
              className="form-input min-h-32 w-full rounded-lg border-slate-300 bg-slate-100 p-4 text-base"
              placeholder="Describe lo que sucede en la zona..."
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Subir imagen (opcional)</label>
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
              <div className="text-center">
                <span className="material-symbols-outlined mx-auto text-4xl text-slate-400">cloud_upload</span>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold text-primary">Haz clic para subir</span> o arrastra y suelta una imagen.
                </p>
                <p className="text-xs text-slate-500">PNG, JPG, GIF hasta 10MB</p>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 -mx-6 -mb-6 mt-2 px-6 py-4">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => navigate('/')}>
              Cancelar
            </button>
            <button type="submit" className="flex items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90">
              <span className="material-symbols-outlined">report</span>
              Reportar zona peligrosa
            </button>
          </div>
        </form>
      </div>

      {submitted && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[9999]">
          <div className="bg-white p-6 rounded-lg max-w-md text-center">
            <h3 className="text-lg font-bold mb-2">Reporte recibido</h3>
            <p className="mb-4">Gracias — tu reporte será revisado por los administradores antes de publicarse. Apreciamos tu contribución a la seguridad de la comunidad.</p>
            <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => navigate('/')}>Aceptar</button>
          </div>
        </div>
      )}
    </div>
  );
}
