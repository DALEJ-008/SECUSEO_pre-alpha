import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, apiJson, getCookie } from '../lib/services/api';

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
    <header ref={rootRef} className="flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 bg-white px-6 py-4 shadow-sm">
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
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50">
              <div className="p-3 text-sm font-semibold">Notificaciones</div>
              <div className="max-h-56 overflow-auto divide-y">
                {notifications.length === 0 && (
                  <div className="p-2 text-center text-xs text-gray-500">No disponibles</div>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className="p-2 cursor-pointer hover:bg-gray-50" onClick={() => openNotification(n)}>
                    <div className="font-medium text-sm">{n.titulo}</div>
                    <div className="text-xs text-gray-500">{n.resumen}</div>
                  </div>
                ))}
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

      {/* Modal detalle de notificación */}
      {notifDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50" onClick={() => setNotifDetail(null)}>
          <div className="bg-white rounded-lg w-11/12 max-w-2xl p-4 shadow-lg border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">{notifDetail.titulo || 'Notificación'}</h3>
              <button className="text-gray-500" onClick={() => setNotifDetail(null)}>Cerrar</button>
            </div>
            <div className="mt-3">{notifDetail.cuerpo}</div>
          </div>
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
