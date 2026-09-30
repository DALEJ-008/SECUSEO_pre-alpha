import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import Header from '../componentes/Header';
import { apiFetch, apiJson } from '../lib/services/api';

const TYPE_LABELS = {
  robo: 'Robo', asalto: 'Asalto', hurto: 'Hurto', vandalismo: 'Vandalismo',
  iluminacion: 'Poca Iluminación', accidente: 'Accidente de Tránsito', violencia: 'Violencia',
  consumo_drogas: 'Consumo/Venta de Drogas', incendio: 'Incendio', amenaza: 'Amenaza',
  robo_vehiculo: 'Robo de Vehículos', acoso_callejero: 'Acoso Callejero',
  prostitucion_ilegal: 'Prostitución Ilegal', fraude_estafa: 'Fraudes y Estafas', otro: 'Otro',
};

function mapPriorityToLevel(p) {
  if (!p) return 'Bajo';
  const s = String(p).toLowerCase();
  if (s.includes('alto') || s.includes('3')) return 'Alto';
  if (s.includes('medio') || s.includes('2')) return 'Medio';
  if (s.includes('asalto') || s.includes('violencia') || s.includes('robo')) return 'Alto';
  if (s.includes('ilumin') || s.includes('hurto') || s.includes('vandal')) return 'Medio';
  return 'Bajo';
}

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
  const [comunicado, setComunicado] = useState('');
  const [modalReport, setModalReport] = useState(null);

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
    if (!modalReport) {
      if (modalMapRef.current) { try { modalMapRef.current.remove(); } catch (e) {} modalMapRef.current = null; }
      return;
    }
    requestAnimationFrame(() => {
      if (!modalMapDivRef.current) return;
      const map = L.map(modalMapDivRef.current, { preferCanvas: true }).setView([4.716, -74.212], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      if (modalReport.coordenadas?.length >= 2) {
        const lat = parseFloat(modalReport.coordenadas[1]);
        const lon = parseFloat(modalReport.coordenadas[0]);
        if (!isNaN(lat) && !isNaN(lon)) { map.setView([lat, lon], 15); L.marker([lat, lon]).addTo(map); }
      }
      modalMapRef.current = map;
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 80);
    });
  }, [modalReport]);

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

  async function sendComunicado() {
    if (!comunicado.trim()) { alert('Escribe un comunicado antes de enviar'); return; }
    const fd = new FormData(); fd.append('title', comunicado.slice(0, 80)); fd.append('body', comunicado);
    const res = await apiFetch('/api/comunicado/create/', { method: 'POST', body: fd });
    if (res.ok) { alert('Comunicado enviado'); setComunicado(''); fetchCounts(); } else alert('Error al enviar comunicado');
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

  const level = modalReport ? mapPriorityToLevel(modalReport.prioridad || modalReport.tipo || '') : 'Bajo';
  const levelBadge = level === 'Alto' ? 'bg-red-100 text-red-800' : level === 'Medio' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

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
              <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-slate-900">Comunicados</h2></div>
              <div className="p-6">
                <div className="flex flex-col gap-4">
                  <textarea
                    className="form-textarea block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm min-h-36"
                    placeholder="Escribe tu comunicado aquí..."
                    value={comunicado} onChange={(e) => setComunicado(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90" onClick={sendComunicado}>
                      <span className="material-symbols-outlined mr-2 -ml-1">send</span>
                      Enviar a la comunidad
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {modalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={(e) => { if (e.target === e.currentTarget) setModalReport(null); }}>
          <div className="bg-white rounded-xl max-w-5xl w-full mx-4 md:mx-0 p-6 shadow-2xl border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-semibold">Detalle del Reporte <span className="text-gray-500 text-base font-normal">#{modalReport.id}</span></h3>
                <p className="text-sm text-gray-500 mt-1">Información completa del reporte seleccionado</p>
              </div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setModalReport(null)}>Cerrar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 font-medium">{modalReport.ubicacion}</p>
                  <p className="mt-3 text-base text-gray-700">{modalReport.descripcion}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-3"><div className="text-xs text-gray-500 w-28">Tipo</div><div className="text-sm font-medium text-gray-800">{TYPE_LABELS[(modalReport.tipo || '').trim()] || modalReport.tipo || '—'}</div></div>
                  <div className="flex items-center gap-3"><div className="text-xs text-gray-500 w-28">Prioridad</div><div><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${levelBadge}`}>{level}</span></div></div>
                  <div className="flex items-center gap-3"><div className="text-xs text-gray-500 w-28">Estado</div><div className="text-sm font-medium text-gray-700">{modalReport.estado}</div></div>
                  <div className="flex items-center gap-3"><div className="text-xs text-gray-500 w-28">Creado por</div><div className="text-sm font-medium text-gray-700">{modalReport.creado_por?.username || modalReport.creado_por || '—'}</div></div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-green-600 text-white text-sm font-medium shadow-sm hover:bg-green-700" onClick={approveFromModal}>Aprobar</button>
                  <button className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-red-50 text-red-600 text-sm font-medium border border-red-100 hover:bg-red-100" onClick={rejectFromModal}>Rechazar</button>
                </div>
              </div>
              <div className="md:col-span-1">
                <div ref={modalMapDivRef} className="w-full rounded-md overflow-hidden shadow-sm" style={{ height: 200, border: '1px solid #e5e7eb' }} />
                <div className="mt-4 rounded-md overflow-hidden border border-gray-200 p-2 bg-white">
                  {modalReport.imagen_url && <img src={modalReport.imagen_url} className="max-h-[320px] rounded-md border object-cover w-full" />}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
