import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, apiJson, mediaUrl } from '../lib/services/api';

function recortar(texto, max = 90) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}...` : t;
}

function vistaPrevia(n) {
  const titulo = String(n.titulo || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const previa = String(n.resumen || '').replace(/\s+/g, ' ').replace(/\.\.\.$/, '').trim();
  const previaLower = previa.toLowerCase();
  if (!previa) return '';
  const k = Math.min(titulo.length, previaLower.length, 40);
  if (k > 0 && titulo.slice(0, k) === previaLower.slice(0, k)) return '';
  return recortar(n.resumen);
}

// Encabezado compartido: logo, notificaciones y menú de perfil.
// Replica la lógica de PaginaPrincipal.html / PanelAdministracion.html /
// ValidacionyComentariosReportes.html (whoami, notificaciones, editar perfil).
export default function Header() {
  const navigate = useNavigate();
  const [whoami, setWhoami] = useState({ username: 'Usuario', email: '', role: 'user', photo_url: null });
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifDetail, setNotifDetail] = useState(null);
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const rootRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.leida).length;

  async function fetchWhoami() {
    try {
      const { res, data } = await apiJson('/api/whoami/');
      if (res.ok && data?.ok) {
        setWhoami({
          username: data.username || data.email || 'Usuario',
          email: data.email || '',
          role: data.role,
          photo_url: data.photo_url || null,
        });
      }
    } catch (e) { console.error('whoami', e); }
  }

  async function loadNotifications() {
    try {
      const { res, data } = await apiJson('/api/notificaciones/');
      if (res.ok) setNotifications(data?.notificaciones || []);
    } catch (e) { console.error('notificaciones', e); }
  }

  useEffect(() => { fetchWhoami(); }, []);

  useEffect(() => {
    function onDocClick(ev) {
      if (rootRef.current && !rootRef.current.contains(ev.target)) {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function openNotification(n) {
    setNotifOpen(false);
    await apiFetch(`/api/notificaciones/${n.id}/leer/`, { method: 'POST' });
    const { res, data } = await apiJson(`/api/notificaciones/${n.id}/detail/`);
    if (!res.ok) { alert('No se pudo cargar la notificación'); return; }
    setNotifDetail(data);
    loadNotifications();
  }

  function openProfileModal() {
    setEditUsername(whoami.username || '');
    setProfileModalOpen(true);
  }

  async function saveProfile() {
    const fd = new FormData();
    if (editUsername) fd.append('username', editUsername);
    if (editPhoto) fd.append('photo', editPhoto);
    const { res, data } = await apiJson('/api/profile/update/', { method: 'POST', body: fd });
    if (res.ok) {
      setWhoami((w) => ({ ...w, username: data.username, photo_url: data.photo_url || w.photo_url }));
      alert('Perfil actualizado');
      setProfileModalOpen(false);
    } else {
      alert('Error al guardar');
    }
  }

  function logout() {
    window.location.href = '/logout/';
  }

  return (
    <header ref={rootRef} className="relative z-[1101] flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-3 text-text-primary">
        <Link to="/"><img alt="SECUSEO Logo" className="h-12 w-auto" src="/img/Logo2.png" /></Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Notificaciones */}
        <div className="relative">
          <button
            className="relative rounded-full p-2 text-text-secondary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            onClick={(e) => { e.stopPropagation(); const next = !notifOpen; setNotifOpen(next); setProfileOpen(false); if (next) loadNotifications(); }}
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs w-5 h-5">{unreadCount}</span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 whitespace-normal bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
              <div className="p-3 text-sm font-semibold border-b border-gray-100">Comunicados</div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {notifications.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-500">No hay comunicados disponibles</div>
                )}
                {notifications.map((n) => {
                  const previa = vistaPrevia(n);
                  return (
                    <button
                      type="button"
                      key={n.id}
                      className="block w-full text-left px-3 py-2.5 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                      onClick={() => openNotification(n)}
                    >
                      <div className="flex items-start gap-2">
                        {!n.leida && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-sm text-gray-900 ${n.leida ? 'font-medium' : 'font-bold'}`}>{n.titulo}</div>
                          {previa && <div className="clamp-2 mt-0.5 break-words text-xs text-gray-500">{previa}</div>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Perfil */}
        <div className="relative">
          <button className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); const next = !profileOpen; setProfileOpen(next); setNotifOpen(false); }}>
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-9 h-9"
              style={{ backgroundImage: `url('${whoami.photo_url || '/img/Logo3.png'}')` }}
            />
            <span className="material-symbols-outlined text-text-secondary">expand_more</span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
              <div className="p-3">
                <div className="font-medium">{whoami.username}</div>
                <div className="text-xs text-gray-500">{whoami.email}</div>
              </div>
              <div className="divide-y">
                <div className="p-2">
                  <Link to="/" className="block p-2 rounded hover:bg-gray-50">Página principal</Link>
                  <button className="w-full text-left p-2 rounded hover:bg-gray-50" onClick={openProfileModal}>Ver perfil</button>
                </div>
                <div className="p-2">
                  {whoami.role === 'admin' && (
                    <Link to="/admin-panel" className="block p-2 rounded hover:bg-gray-50">Panel de Administración</Link>
                  )}
                  <button className="block w-full text-left p-2 rounded hover:bg-gray-50" onClick={logout}>Cerrar sesión</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle de notificación / comunicado */}
      {notifDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setNotifDetail(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden whitespace-normal rounded-xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div className="min-w-0">
                <h3 className="break-words text-xl font-semibold text-gray-900">{notifDetail.titulo || 'Comunicado'}</h3>
                {notifDetail.fecha && (
                  <p className="mt-1 text-xs text-gray-500">{new Date(notifDetail.fecha).toLocaleString()}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                className="flex-shrink-0 rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                onClick={() => setNotifDetail(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{notifDetail.cuerpo}</p>

              {notifDetail.imagenes?.length > 0 && (
                <div className={`grid gap-3 ${notifDetail.imagenes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {notifDetail.imagenes.map((src, i) => (
                    <button
                      type="button"
                      key={i}
                      className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                      onClick={() => setImagenAmpliada(mediaUrl(src))}
                    >
                      <img src={mediaUrl(src)} alt={`Imagen ${i + 1} del comunicado`} className="max-h-72 w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-6 py-3">
              <button
                type="button"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setNotifDetail(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Imagen ampliada */}
      {imagenAmpliada && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-80 p-4" onClick={() => setImagenAmpliada(null)}>
          <img src={imagenAmpliada} alt="Imagen ampliada" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}

      {/* Modal perfil */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50" onClick={() => setProfileModalOpen(false)}>
          <div className="bg-white rounded-lg w-11/12 max-w-md p-4 shadow-lg border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">Perfil</h3>
              <button className="text-gray-500" onClick={() => setProfileModalOpen(false)}>Cerrar</button>
            </div>
            <div className="mt-3 flex flex-col items-center gap-3">
              <div
                className="w-28 h-28 rounded-full bg-center bg-cover"
                style={{ backgroundImage: `url('${whoami.photo_url || '/img/Logo3.png'}')` }}
              />
              <div className="font-bold text-lg">{whoami.username}</div>
              <div className="text-sm text-gray-500">{whoami.email}</div>
              <div className="w-full mt-2">
                <label className="text-sm font-medium">Editar nombre</label>
                <input className="block w-full mt-1 rounded border-gray-200" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
              </div>
              <div className="w-full">
                <label className="text-sm font-medium">Cambiar foto</label>
                <input type="file" accept="image/*" className="block mt-1" onChange={(e) => setEditPhoto(e.target.files?.[0] || null)} />
              </div>
              <div className="w-full flex justify-end">
                <button className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white" onClick={saveProfile}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
