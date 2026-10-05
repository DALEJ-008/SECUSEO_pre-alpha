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

Frontend en React se corre con Vite. Primero instala dependencias y luego corre el servidor de desarrollo:
```bash
npm install
npm run dev
```

Backend Django se corre de la siguiente manera (requiere Python 3.10+ y un virtualenv con dependencias instaladas):
```bash
cd Backend
python manage.py runserver
```

Esto sirve la app en `http://localhost:5173`

