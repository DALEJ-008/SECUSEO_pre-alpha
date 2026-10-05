import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import Header from '../componentes/Header';
import { apiFetch, apiJson, mediaUrl } from '../lib/services/api';
import { prettyType, nivelDeRiesgo } from '../lib/services/tipos';

const MAX_IMAGENES_COMUNICADO = 6;
const MAX_MB_IMAGEN = 5;

const ESTADO_BADGE = {
  validado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
};

// Migrado de Frontend/HTML/PanelAdministracion.html.
export default function AdminPanel() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ pending_reportes: 0, validated_reportes: 0, users_total: 0, comunicados_recientes: 0 });
  const [pending, setPending] = useState([]);
  const [validated, setValidated] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchEstado, setSearchEstado] = useState('');
  const [searching, setSearching] = useState(false);
  const [comTitulo, setComTitulo] = useState('');
  const [comCuerpo, setComCuerpo] = useState('');
  const [comImagenes, setComImagenes] = useState([]); // [{ file, preview }]
  const [enviandoCom, setEnviandoCom] = useState(false);
  const [modalReport, setModalReport] = useState(null);
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const comFileRef = useRef(null);

  const modalMapDivRef = useRef(null);
  const modalMapRef = useRef(null);

  async function fetchCounts() {
    const { res, data } = await apiJson('/admin/api/counts/');
    if (res.ok) setCounts(data);
  }
  async function fetchPending() {
    const { res, data } = await apiJson('/admin/api/reportes/pending/');
    if (res.ok) setPending(data.reportes || []);
  }
  async function fetchValidated() {
    const { res, data } = await apiJson('/admin/api/reportes/validated/');
    if (res.ok) setValidated(data.reportes || []);
  }
  async function fetchUsers() {
    const { res, data } = await apiJson('/admin/api/users/');
    if (res.ok) setUsers(data.users || []);
  }

  useEffect(() => {
    fetchPending(); fetchValidated(); fetchUsers(); fetchCounts();
    const t1 = setInterval(fetchPending, 60000);
    const t2 = setInterval(fetchValidated, 60000);
    const t3 = setInterval(fetchUsers, 120000);
    const t4 = setInterval(fetchCounts, 60000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); };
  }, []);

  async function approveReport(id) {
    if (!confirm(`Aprobar reporte #${id}?`)) return;
    const res = await apiFetch(`/admin/api/reportes/${id}/validar/`, { method: 'POST' });
    if (res.ok) { fetchPending(); fetchValidated(); fetchCounts(); } else alert('Error al aprobar');
  }
  async function rejectReport(id) {
    if (!confirm(`Rechazar/eliminar reporte #${id}?`)) return;
    const res = await apiFetch(`/admin/api/reportes/${id}/rechazar/`, { method: 'POST' });
    if (res.ok) { fetchPending(); fetchCounts(); } else alert('Error al rechazar');
  }
  async function deletePermanent(id) {
    if (!confirm(`Eliminar reporte #${id}? Esta acción eliminará todos los datos del sistema.`)) return;
    const res = await apiFetch(`/admin/api/reportes/${id}/eliminar/`, { method: 'POST' });
    if (res.ok) { fetchValidated(); fetchPending(); fetchCounts(); } else alert('Error al eliminar');
  }

  async function runSearch() {
    setSearching(true);
    const params = new URLSearchParams();
    if (searchQ) params.append('q', searchQ);
    if (searchEstado) params.append('estado', searchEstado);
    try {
      const { res, data } = await apiJson(`/admin/api/reportes/search/?${params.toString()}`);
      if (!res.ok) throw new Error('search failed');
      setPending(data.reportes || []);
    } catch (e) {
      alert('Error al buscar reportes');
    }
  }
  function clearSearch() {
    setSearchQ(''); setSearchEstado(''); setSearching(false); fetchPending();
  }

  async function openReportModal(id) {
    const { res, data } = await apiJson(`/admin/api/reportes/${id}/detail/`);
    if (!res.ok) { alert('No se pudo cargar el detalle'); return; }
    setModalReport(data);
  }

  useEffect(() => {
    if (modalMapRef.current) { try { modalMapRef.current.remove(); } catch (e) {} modalMapRef.current = null; }
    if (!modalReport) return undefined;
    const lat = parseFloat(modalReport.coordenadas?.[1]);
    const lon = parseFloat(modalReport.coordenadas?.[0]);
    if (isNaN(lat) || isNaN(lon)) return undefined;
    const raf = requestAnimationFrame(() => {
      if (!modalMapDivRef.current) return;
      const map = L.map(modalMapDivRef.current, { preferCanvas: true }).setView([lat, lon], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      L.marker([lat, lon]).addTo(map);
      modalMapRef.current = map;
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 100);
    });
    return () => cancelAnimationFrame(raf);
  }, [modalReport]);

  // Libera las URLs temporales de las vistas previas de imágenes del comunicado
  useEffect(() => () => { comImagenes.forEach((i) => URL.revokeObjectURL(i.preview)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function approveFromModal() {
    if (!confirm(`Aprobar reporte #${modalReport.id}?`)) return;
    const res = await apiFetch(`/admin/api/reportes/${modalReport.id}/validar/`, { method: 'POST' });
    if (res.ok) { alert('Reporte aprobado'); setModalReport(null); fetchPending(); fetchValidated(); fetchCounts(); } else alert('Error al aprobar');
  }
  async function rejectFromModal() {
    if (!confirm(`Rechazar/eliminar reporte #${modalReport.id}?`)) return;
    const res = await apiFetch(`/admin/api/reportes/${modalReport.id}/rechazar/`, { method: 'POST' });
    if (res.ok) { alert('Reporte rechazado'); setModalReport(null); fetchPending(); fetchCounts(); } else alert('Error al rechazar');
  }

  async function setUserRole(u) {
    const newRole = prompt('Asignar rol a usuario (admin/user/moderator):', u.role);
    if (!newRole) return;
    const fd = new FormData(); fd.append('role', newRole);
    const res = await apiFetch(`/admin/api/users/${u.id}/set-role/`, { method: 'POST', body: fd });
    if (res.ok) fetchUsers(); else alert('Error al cambiar rol');
  }
  async function deleteUser(id) {
    if (!confirm(`Eliminar usuario #${id}?`)) return;
    const res = await apiFetch(`/admin/api/users/${id}/delete/`, { method: 'POST' });
    if (res.ok) fetchUsers(); else alert('Error al eliminar');
  }

  function addComImagenes(fileList) {
    const nuevas = [];
    for (const file of Array.from(fileList || [])) {
      if (!file.type.startsWith('image/')) { alert(`"${file.name}" no es una imagen`); continue; }
      if (file.size > MAX_MB_IMAGEN * 1024 * 1024) { alert(`"${file.name}" supera ${MAX_MB_IMAGEN} MB`); continue; }
      nuevas.push({ file, preview: URL.createObjectURL(file) });
    }
    setComImagenes((prev) => {
      const todas = [...prev, ...nuevas];
      if (todas.length > MAX_IMAGENES_COMUNICADO) {
        alert(`Máximo ${MAX_IMAGENES_COMUNICADO} imágenes por comunicado`);
        todas.slice(MAX_IMAGENES_COMUNICADO).forEach((i) => URL.revokeObjectURL(i.preview));
        return todas.slice(0, MAX_IMAGENES_COMUNICADO);
      }
      return todas;
    });
    if (comFileRef.current) comFileRef.current.value = '';
  }
  function removeComImagen(idx) {
    setComImagenes((prev) => {
      URL.revokeObjectURL(prev[idx]?.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function sendComunicado() {
    const titulo = comTitulo.trim();
    const cuerpo = comCuerpo.trim();
    if (!titulo) { alert('Escribe el título del comunicado'); return; }
    if (!cuerpo) { alert('Escribe el contenido del comunicado'); return; }
    const fd = new FormData();
    fd.append('title', titulo);
    fd.append('body', cuerpo);
    comImagenes.forEach((i) => fd.append('images', i.file));
    setEnviandoCom(true);
    try {
      const { res, data } = await apiJson('/api/comunicado/create/', { method: 'POST', body: fd });
      if (res.ok) {
        alert('Comunicado enviado');
        comImagenes.forEach((i) => URL.revokeObjectURL(i.preview));
        setComTitulo(''); setComCuerpo(''); setComImagenes([]);
        fetchCounts();
      } else {
        alert(data?.mensaje || 'Error al enviar comunicado');
      }
    } catch (e) {
      alert('Error de red al enviar el comunicado');
    } finally {
      setEnviandoCom(false);
    }
  }

  function reportRow(r, { validatedView = false } = {}) {
    return (
      <tr key={r.id}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">#{r.id}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{r.ubicacion || (r.coordenadas ? r.coordenadas.join(',') : '—')}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{(r.descripcion || '').slice(0, 120)}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{r.creado_por?.username || '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{r.creado_por?.telefono || '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{r.creado_por?.email || '—'}</td>
        {!validatedView && (
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.estado] || ESTADO_BADGE.pendiente}`}>
              {r.estado || 'pendiente'}
            </span>
          </td>
        )}
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
          {validatedView ? (
            <>
              <button className="text-blue-600 hover:text-blue-900" onClick={() => navigate(`/reportes/${r.id}`)}>Ver</button>
              <button className="text-red-600 hover:text-red-900" onClick={() => deletePermanent(r.id)}>Eliminar</button>
            </>
          ) : (
            <>
              <button className="text-blue-600 hover:text-blue-900" onClick={() => openReportModal(r.id)}>Ver</button>
              {(!searching || r.estado === 'pendiente') && <button className="text-green-600 hover:text-green-900" onClick={() => approveReport(r.id)}>Aprobar</button>}
              {(!searching || r.estado !== 'validado') && <button className="text-red-600 hover:text-red-900" onClick={() => rejectReport(r.id)}>Eliminar</button>}
            </>
          )}
        </td>
      </tr>
    );
  }

  const level = modalReport ? nivelDeRiesgo(modalReport) : 'Bajo';
  const levelBadge = level === 'Alto' ? 'bg-red-100 text-red-800' : level === 'Medio' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  const modalImagenes = modalReport
    ? (modalReport.imagenes?.length ? modalReport.imagenes : (modalReport.imagen_url ? [modalReport.imagen_url] : []))
    : [];
  const modalTieneCoords = modalReport && !isNaN(parseFloat(modalReport.coordenadas?.[0])) && !isNaN(parseFloat(modalReport.coordenadas?.[1]));

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#f1f2ff] text-text-primary">
      <Header />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Panel de Administración</h1>
            <p className="text-gray-500 mt-1">Bienvenido, gestiona la aplicación desde aquí.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              ['Reportes Pendientes', counts.pending_reportes],
              ['Reportes Validados', counts.validated_reportes],
              ['Usuarios Totales', counts.users_total],
              ['Comunicados Recientes', counts.comunicados_recientes],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-2 rounded-lg p-6 bg-white border border-gray-200 shadow-sm">
                <p className="text-text-secondary text-sm font-medium">{label}</p>
                <p className="text-3xl font-bold text-slate-900">{value ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="space-y-12">
            <div id="reports-section" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-slate-900">Gestión de Reportes</h2></div>
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    className="block rounded-md border-gray-200 p-2 text-sm w-72"
                    placeholder="Buscar por ubicación, descripción, usuario..."
                    value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                  />
                  <select className="rounded-md border-gray-200 p-2 text-sm" value={searchEstado} onChange={(e) => setSearchEstado(e.target.value)}>
                    <option value="">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="validado">Validado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                  <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-white text-sm" onClick={runSearch}>Buscar</button>
                  <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-gray-100 text-sm" onClick={clearSearch}>Limpiar</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#eef5ff]">
                  <thead className="bg-[#eef5ff]">
                    <tr>
                      {['Reporte ID', 'Ubicación', 'Descripción', 'Creador', 'Teléfono', 'Email', 'Estado', 'Acciones'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">{pending.map((r) => reportRow(r))}</tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-slate-900">Reportes Validados</h2></div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#eef5ff]">
                  <thead className="bg-[#eef5ff]">
                    <tr>
                      {['Reporte ID', 'Ubicación', 'Descripción', 'Creador', 'Teléfono', 'Email', 'Acciones'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">{validated.map((r) => reportRow(r, { validatedView: true }))}</tbody>
                </table>
              </div>
            </div>

            <div id="users-section" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-slate-900">Gestión de Usuarios</h2></div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#eef5ff]">
                  <thead className="bg-[#eef5ff]">
                    <tr>
                      {['User ID', 'Nombre', 'Email', 'Rol', 'Acciones'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">#U{u.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{u.nombre || u.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button className="text-indigo-600 hover:text-indigo-900" onClick={() => setUserRole(u)}>Editar</button>
                          <button className="text-red-600 hover:text-red-900" onClick={() => deleteUser(u.id)}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div id="comms-section" className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-slate-900">Comunicados</h2>
                <p className="text-sm text-gray-500 mt-0.5">Se enviará como notificación a todos los usuarios.</p>
              </div>
              <div className="p-6">
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="com-titulo" className="block text-sm font-medium text-slate-700">Título</label>
                      <span className="text-xs text-gray-400">{comTitulo.length}/120</span>
                    </div>
                    <input
                      id="com-titulo"
                      type="text"
                      maxLength={120}
                      className="form-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary text-sm"
                      placeholder="Ej: Mantenimiento programado de la plataforma"
                      value={comTitulo} onChange={(e) => setComTitulo(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="com-cuerpo" className="block text-sm font-medium text-slate-700 mb-1">Contenido del comunicado</label>
                    <textarea
                      id="com-cuerpo"
                      className="form-textarea block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary text-sm min-h-36"
                      placeholder="Escribe aquí el mensaje completo..."
                      value={comCuerpo} onChange={(e) => setComCuerpo(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Imágenes <span className="font-normal text-gray-400">(opcional, hasta {MAX_IMAGENES_COMUNICADO}, máx. {MAX_MB_IMAGEN} MB c/u)</span>
                    </label>
                    <input
                      ref={comFileRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => addComImagenes(e.target.files)}
                    />
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:border-primary hover:bg-white"
                      onClick={() => comFileRef.current?.click()}
                    >
                      <span className="material-symbols-outlined text-slate-400">add_photo_alternate</span>
                      Haz clic para agregar imágenes
                    </button>
                    {comImagenes.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {comImagenes.map((img, i) => (
                          <div key={img.preview} className="relative group">
                            <img src={img.preview} alt={`Imagen ${i + 1}`} className="h-24 w-full rounded-md border border-gray-200 object-cover" />
                            <button
                              type="button" aria-label="Quitar imagen"
                              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                              onClick={() => removeComImagen(i)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                      onClick={sendComunicado} disabled={enviandoCom}
                    >
                      <span className="material-symbols-outlined mr-2 -ml-1">send</span>
                      {enviandoCom ? 'Enviando...' : 'Enviar a la comunidad'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {modalReport && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black bg-opacity-50 p-3 sm:p-5"
          onClick={(e) => { if (e.target === e.currentTarget) setModalReport(null); }}
        >
          <div className="flex h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            {/* Encabezado */}
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-semibold text-slate-900">Detalle del Reporte <span className="text-gray-400 text-lg font-normal">#{modalReport.id}</span></h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[modalReport.estado] || ESTADO_BADGE.pendiente}`}>{modalReport.estado || 'pendiente'}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${levelBadge}`}>Riesgo {level.toLowerCase()}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">Información completa del reporte seleccionado</p>
              </div>
              <button type="button" aria-label="Cerrar" className="flex-shrink-0 rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" onClick={() => setModalReport(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Contenido (con scroll interno) */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* Columna izquierda: datos */}
                <div className="space-y-5 lg:col-span-3">
                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Información general</h4>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                      {[
                        ['Tipo de riesgo', prettyType(modalReport.tipo) || '—'],
                        ['Nivel de riesgo', <span key="nivel" className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${levelBadge}`}>{level}</span>],
                        ['Zona / Barrio', modalReport.zona || 'Sin zona'],
                        ['Fecha de creación', modalReport.fecha_creacion ? new Date(modalReport.fecha_creacion).toLocaleString() : '—'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-gray-500">{label}</dt>
                          <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Ubicación</h4>
                    <p className="flex items-start gap-2 break-words text-sm text-gray-800">
                      <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 20 }}>location_on</span>
                      <span className="min-w-0">{modalReport.ubicacion || 'No disponible'}</span>
                    </p>
                  </section>

                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Descripción</h4>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{modalReport.descripcion || 'Sin descripción'}</p>
                  </section>

                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Creado por</h4>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                      {[
                        ['Nombre', modalReport.creado_por?.username || (typeof modalReport.creado_por === 'string' ? modalReport.creado_por : '—')],
                        ['Email', modalReport.creado_por?.email || '—'],
                        ['Teléfono', modalReport.creado_por?.telefono || '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <dt className="text-xs text-gray-500">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-medium text-gray-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>

                {/* Columna derecha: mapa e imágenes */}
                <div className="space-y-5 lg:col-span-2">
                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Ubicación en el mapa</h4>
                    {modalTieneCoords ? (
                      <div ref={modalMapDivRef} className="w-full overflow-hidden rounded-md border border-gray-200" style={{ height: 300 }} />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500">Este reporte no tiene coordenadas</div>
                    )}
                  </section>

                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Imágenes adjuntas ({modalImagenes.length})</h4>
                    {modalImagenes.length === 0 ? (
                      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500">Este reporte no tiene imágenes</div>
                    ) : (
                      <div className={`grid gap-3 ${modalImagenes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {modalImagenes.map((src, i) => (
                          <button type="button" key={i} className="overflow-hidden rounded-md border border-gray-200 bg-gray-100" onClick={() => setImagenAmpliada(mediaUrl(src))}>
                            <img
                              src={mediaUrl(src)} alt={`Imagen ${i + 1} del reporte`} className="h-48 w-full object-cover"
                              onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'flex h-48 items-center justify-center px-2 text-center text-xs text-gray-500', textContent: 'No se pudo cargar la imagen' })); }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button type="button" className="h-10 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setModalReport(null)}>Cerrar</button>
              <button type="button" className="h-10 rounded-md border border-red-100 bg-red-50 px-4 text-sm font-medium text-red-600 hover:bg-red-100" onClick={rejectFromModal}>Rechazar</button>
              <button type="button" className="h-10 rounded-md bg-green-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-green-700" onClick={approveFromModal}>Aprobar</button>
            </div>
          </div>
        </div>
      )}

      {imagenAmpliada && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black bg-opacity-85 p-4" onClick={() => setImagenAmpliada(null)}>
          <img src={imagenAmpliada} alt="Imagen ampliada" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
