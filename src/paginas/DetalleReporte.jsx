import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../componentes/Header';
import { apiFetch, apiJson, mediaUrl } from '../lib/services/api';
import { prettyType, nivelDeRiesgo } from '../lib/services/tipos';

// Migrado de Frontend/HTML/ValidacionyComentariosReportes.html.
export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportId = parseInt(id, 10);

  const [report, setReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [validationsCount, setValidationsCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const typingRef = useRef(false);

  async function loadReport() {
    const { res, data } = await apiJson(`/api/reportes/${reportId}/`);
    if (res.ok) setReport(data);
  }

  async function fetchDetailExtras() {
    if (typingRef.current) return;
    try {
      const { res: cRes, data: cd } = await apiJson(`/api/reportes/${reportId}/comentario-local/`);
      if (cRes.ok && cd?.comments) setComments(cd.comments);
      const { res: vRes, data: vd } = await apiJson(`/api/reportes/${reportId}/validar-local/`);
      if (vRes.ok) setValidationsCount(vd.count || vd.validations?.length || 0);
    } catch (e) { console.warn('Error fetching detail extras', e); }
  }

  useEffect(() => {
    loadReport();
    fetchDetailExtras();
    const timer = setInterval(fetchDetailExtras, 10000);
    function onVisibility() { if (!document.hidden) fetchDetailExtras(); }
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  async function sendComment() {
    const txt = commentText.trim();
    if (!txt) { alert('Escribe un comentario'); return; }
    setComments((c) => [{ autor: 'Tú', texto: txt, fecha: new Date().toISOString() }, ...c]);
    setCommentText('');
    try {
      const fd = new FormData(); fd.append('texto', txt);
      const res = await apiFetch(`/api/reportes/${reportId}/comentario-local/`, { method: 'POST', body: fd });
      if (!res.ok) console.warn('No se pudo guardar comentario local');
    } catch (e) { console.warn('error', e); }
  }

  async function validate() {
    if (!confirm('¿Confirmas que este reporte sí ocurrió? (Esto solo se registra como validación comunitaria)')) return;
    try {
      const { res, data } = await apiJson(`/api/reportes/${reportId}/validar-local/`, { method: 'POST' });
      if (res.ok) { setValidationsCount(data.count ?? validationsCount + 1); alert('Gracias por validar'); }
      else alert(data?.error || 'No se pudo validar');
    } catch (e) { alert('Error conectando al servidor'); }
  }

  async function flagReport() {
    if (!confirm('¿Deseas reportar/denunciar este reporte?')) return;
    try {
      const res = await apiFetch(`/admin/api/reportes/${reportId}/rechazar/`, { method: 'POST' });
      if (res.ok) { alert('Reporte marcado como rechazado (administración)'); navigate('/'); }
      else alert('No tienes permisos para esta acción. Gracias por reportar, tomaremos nota.');
    } catch (e) { alert('No se pudo completar la operación'); }
  }

  const imagenes = report?.imagenes?.length ? report.imagenes : (report?.imagen_url ? [report.imagen_url] : []);
  const nivel = report ? nivelDeRiesgo(report) : null;
  const nivelBadge = nivel === 'Alto' ? 'bg-red-100 text-red-800' : nivel === 'Medio' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

  return (
    <div className="min-h-screen bg-[#f1f2ff]" style={{ fontFamily: 'Poppins, "Noto Sans", sans-serif' }}>
      <Header />
      <main className="flex flex-1 justify-center py-10">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg">
          <div className="p-6 border-b border-gray-200"><h1 className="text-2xl font-bold text-gray-800">Reporte de Zona Peligrosa</h1></div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-y-4 gap-x-4">
              <div className="col-span-1 text-sm font-medium text-gray-500">Ubicación</div>
              <div className="col-span-3 text-sm text-gray-800">{report?.ubicacion || 'No disponible'}</div>
              <div className="col-span-1 text-sm font-medium text-gray-500">Tipo</div>
              <div className="col-span-3 text-sm text-gray-800">{prettyType(report?.tipo) || '—'}</div>
              <div className="col-span-1 text-sm font-medium text-gray-500">Descripción</div>
              <div className="col-span-3 text-sm text-gray-800">{report?.descripcion || ''}</div>
              <div className="col-span-1 text-sm font-medium text-gray-500">Zona</div>
              <div className="col-span-3 text-sm text-gray-800">{report?.zona || 'Sin zona'}</div>
              <div className="col-span-1 text-sm font-medium text-gray-500">Nivel de riesgo</div>
              <div className="col-span-3 text-sm">{nivel && <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${nivelBadge}`}>{nivel}</span>}</div>
              <div className="col-span-1 text-sm font-medium text-gray-500">Fecha</div>
              <div className="col-span-3 text-sm text-gray-800">{report?.fecha_creacion ? new Date(report.fecha_creacion).toLocaleString() : '—'}</div>
            </div>
          </div>
          {imagenes.length > 0 && (
            <div className="px-6 pb-6">
              <div className="mb-3 text-sm font-medium text-gray-500">Imágenes adjuntas</div>
              <div className={`grid gap-3 ${imagenes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {imagenes.map((src, i) => (
                  <button type="button" key={i} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100" onClick={() => setImagenAmpliada(mediaUrl(src))}>
                    <img
                      src={mediaUrl(src)} alt={`Imagen ${i + 1} del reporte`} className="max-h-80 w-full object-cover"
                      onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'flex h-32 items-center justify-center px-2 text-center text-xs text-gray-500', textContent: 'No se pudo cargar la imagen' })); }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap items-center gap-4">
            <button className="flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-white text-sm font-bold shadow-sm hover:opacity-90" onClick={validate}>
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span className="truncate">Validar</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500 mr-2">Validaciones:</div>
              <div className="font-semibold text-gray-800">{validationsCount}</div>
            </div>
            <button className="flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200" onClick={() => setShowCommentForm((s) => !s)}>
              <span className="material-symbols-outlined text-base">comment</span>
              <span className="truncate">Comentar</span>
            </button>
            <button className="flex items-center justify-center gap-2 h-10 px-4 rounded-md text-red-600 text-sm font-bold hover:bg-red-50 ml-auto" onClick={flagReport}>
              <span className="material-symbols-outlined text-base">flag</span>
              <span className="truncate">Denunciar</span>
            </button>
          </div>

          {showCommentForm && (
            <div className="px-6 pb-4 flex gap-2">
              <textarea
                className="form-textarea flex-1 rounded-md border-gray-300 text-sm"
                rows={2}
                placeholder="Escribe un comentario..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onFocus={() => { typingRef.current = true; }}
                onBlur={() => { typingRef.current = false; }}
              />
              <button className="rounded-md bg-primary text-white px-4 text-sm font-medium" onClick={sendComment}>Enviar</button>
            </div>
          )}

          <div className="p-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Comentarios</h3>
            <div className="space-y-6">
              {comments.length === 0 && <div className="text-sm text-gray-500">Aún no hay comentarios.</div>}
              {comments.map((c, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 shrink-0" style={{ backgroundImage: "url('/img/Logo3.png')" }} />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-bold text-gray-800">{c.autor || 'Anónimo'}</p>
                      <p className="text-xs text-gray-500">{c.fecha ? new Date(c.fecha).toLocaleString() : ''}</p>
                    </div>
                    <div className="mt-1 p-3 rounded-lg bg-gray-100"><p className="text-sm text-gray-800">{c.texto}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {imagenAmpliada && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-85 p-4" onClick={() => setImagenAmpliada(null)}>
          <img src={imagenAmpliada} alt="Imagen ampliada" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
