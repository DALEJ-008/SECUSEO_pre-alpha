from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.administracion.views import ComunicadoCrearView
from apps.usuarios import views as vistas_usuarios

urlpatterns = [
    # Autenticación por sesión (la usa el frontend React)
    path("login/", vistas_usuarios.inicio_sesion, name="login"),
    path("logout/", vistas_usuarios.cerrar_sesion, name="logout"),
    path("verify-phone/", vistas_usuarios.verificar_telefono, name="verificar-telefono"),
    path("api/whoami/", vistas_usuarios.quien_soy, name="whoami"),
    path("api/profile/update/", vistas_usuarios.actualizar_perfil, name="perfil-actualizar"),
    path("api/comunicado/create/", ComunicadoCrearView.as_view(), name="comunicado-crear"),
    # API REST
    path("api/usuarios/", include("apps.usuarios.urls")),
    path("api/reportes/", include("apps.reportes.urls")),
    path("api/zonas/", include("apps.zonas.urls")),
    path("api/tipos-riesgo/", include("apps.tipos_riesgo.urls")),
    path("api/comentarios/", include("apps.comentarios.urls")),
    path("api/notificaciones/", include("apps.notificaciones.urls")),
    # Panel de administración de la app. Debe ir ANTES de admin/ (Django admin).
    path("admin/api/", include("apps.administracion.urls")),
    path("admin/", admin.site.urls),
    # JWT (opcional, para clientes que no usan cookies)
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtener"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_actualizar"),
    # Documentación OpenAPI
    path("api/schema/", SpectacularAPIView.as_view(), name="esquema-api"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="esquema-api"),
        name="documentacion-api",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
