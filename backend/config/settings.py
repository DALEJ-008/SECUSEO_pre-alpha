import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

GIS_DLL_DIRECTORY = os.getenv("GIS_DLL_DIRECTORY")
if GIS_DLL_DIRECTORY:
    _gis_dll_directory = Path(GIS_DLL_DIRECTORY)
    _gis_dll_directory_handle = os.add_dll_directory(str(_gis_dll_directory))
    os.environ["PATH"] = f"{_gis_dll_directory}{os.pathsep}{os.environ.get('PATH', '')}"
    GDAL_LIBRARY_PATH = os.getenv(
        "GDAL_LIBRARY_PATH", str(_gis_dll_directory / "gdal.dll")
    )
    GEOS_LIBRARY_PATH = os.getenv(
        "GEOS_LIBRARY_PATH", str(_gis_dll_directory / "geos_c.dll")
    )

DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() in {"1", "true", "yes"}
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or secrets.token_urlsafe(50)
if not DEBUG and not os.getenv("DJANGO_SECRET_KEY"):
    raise RuntimeError("DJANGO_SECRET_KEY es obligatorio cuando DEBUG está desactivado.")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.gis",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "apps.usuarios.apps.UsuariosConfig",
    "apps.reportes.apps.ReportesConfig",
    "apps.zonas.apps.ZonasConfig",
    "apps.tipos_riesgo.apps.TiposRiesgoConfig",
    "apps.comentarios.apps.ComentariosConfig",
    "apps.notificaciones.apps.NotificacionesConfig",
    "apps.administracion.apps.AdministracionConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": os.getenv("DB_NAME", "SECUSEO"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

AUTH_USER_MODEL = "usuarios.Usuario"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.excepciones.manejador_excepciones_api",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SECUSEO API",
    "DESCRIPTION": "API de reportes colaborativos de seguridad ciudadana en Funza.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# --- Sesión / CSRF (el frontend React usa cookies de sesión + X-CSRFToken) ---
# En producción con frontend y backend en dominios distintos y HTTPS:
#   SESSION_COOKIE_SAMESITE=None, SESSION_COOKIE_SECURE=true, CSRF_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "false").lower() == "true"
CSRF_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE

# --- Aplicación ---
# A dónde redirige /logout/ (ruta del frontend).
FRONTEND_LOGIN_URL = os.getenv("FRONTEND_LOGIN_URL", "/login")
# Verificación del teléfono por código. Requiere integrar un proveedor de SMS
# (ver apps/usuarios/servicios.py); en DEBUG el código se devuelve en la respuesta.
VERIFICACION_TELEFONO_ACTIVA = os.getenv("VERIFICACION_TELEFONO_ACTIVA", "false").lower() == "true"
TAMANO_MAX_IMAGEN_MB = 5
