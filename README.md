# SECUSEO — Frontend en React

Migración a React (Vite) del frontend que antes vivía como plantillas Django
en `Frontend/HTML/*.html`. El backend Django (`Backend/`, `secuseo_project/`)
no se toca: esta app solo consume sus endpoints JSON.

## Páginas migradas

| Página original                          | Componente                      | Ruta              |
|-------------------------------------------|----------------------------------|-------------------|
| InicioSesion.html                          | `src/pages/Login.jsx`            | `/login`          |
| PaginaPrincipal.html (mapa + sidebar)      | `src/pages/Home.jsx`             | `/`               |
| FormularioReporte.html                     | `src/pages/ReportForm.jsx`       | `/reporte/form`   |
| PanelAdministracion.html                   | `src/pages/AdminPanel.jsx`       | `/admin-panel`    |
| ValidacionyComentariosReportes.html        | `src/pages/ReportDetail.jsx`     | `/reportes/:id`   |

El header con notificaciones y menú de perfil (repetido en 3 plantillas) se
unificó en `src/components/Header.jsx`.

El mapa se sigue haciendo con Leaflet "a mano" (igual que el HTML original),
dentro de un `useEffect` — no se reescribió con `react-leaflet` para no
arriesgar el comportamiento de colores por zona / popups / polling que ya
tenías funcionando.

## Cómo correrlo

```bash
npm install
npm run dev
```

Esto sirve la app en `http://localhost:5173` (o el puerto que asigne
StackBlitz).

## Conexión con el backend Django (importante)

El frontend ya no vive dentro de Django, así que las llamadas a `/api/...`,
`/admin/api/...`, `/login/`, `/logout/`, `/verify-phone/` necesitan llegar a
tu servidor Django. Hay dos formas:

### 1. Proxy de Vite (recomendado en desarrollo)

`vite.config.js` ya trae un proxy configurado. Solo dile dónde vive tu
Django con una variable de entorno antes de `npm run dev`:

```bash
VITE_BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

Esto funciona perfecto si corres Vite y Django en la misma máquina. **En
StackBlitz esto NO va a poder llegar a un Django que corre en tu propia
computadora** (StackBlitz corre en la nube), así que para probar contra tu
backend real necesitas:
- exponer tu Django con algo como `ngrok`/`cloudflared` y apuntar
  `VITE_BACKEND_URL` a esa URL pública, o
- desplegar el backend en algún servidor accesible.

### 2. CORS + cookies entre dominios (si no usas el proxy)

Si en vez del proxy apuntas el frontend directo a la URL pública de Django
(sin proxy), Django necesita:
- `django-cors-headers` instalado, con `CORS_ALLOWED_ORIGINS` incluyendo el
  dominio de StackBlitz y `CORS_ALLOW_CREDENTIALS = True`.
- `CSRF_TRUSTED_ORIGINS` incluyendo ese mismo dominio (Django 4+).
- Las cookies de sesión con `SESSION_COOKIE_SAMESITE = "None"` y
  `SESSION_COOKIE_SECURE = True` (necesita HTTPS).

El helper `src/lib/api.js` ya manda `credentials: 'include'` y el header
`X-CSRFToken` en cada request que no sea GET, así que del lado del frontend
no hay que tocar nada más.

## Diferencia de datos a tener en cuenta

`ReportDetail.jsx` (`/reportes/:id`) usa `GET /api/reportes/<id>/`
(`Backend/views.py::detalle_reporte`), que hoy devuelve menos campos que los
que la plantilla Django original recibía por contexto de render (le faltan
`fecha_creacion` e `imagenes`). La página funciona con lo que ese endpoint
sí entrega; si quieres fecha e imágenes ahí también, hay que agregar esos
campos a esa vista en el backend.

## Estructura

```
src/
  lib/api.js       fetch + CSRF + cookies
  lib/tipos.js      catálogo de tipos de riesgo y helpers compartidos
  components/Header.jsx
  pages/Login.jsx
  pages/Home.jsx
  pages/ReportForm.jsx
  pages/AdminPanel.jsx
  pages/ReportDetail.jsx
public/
  Recursos/Barrios_Funza.geojson
  img/Logo.png, Logo2.png, Logo3.png
```
