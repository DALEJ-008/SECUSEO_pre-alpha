"""Vistas de autenticación y perfil. Responden JSON con el formato que usa el frontend:
{"ok": true, ...} / {"ok": false, "error": "..."}."""
import re
from datetime import date

from django import forms
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_POST

from . import servicios
from .models import Usuario

TELEFONO_RE = re.compile(r"^\+?\d{7,15}$")


def _error(mensaje, status=400):
    return JsonResponse({"ok": False, "error": mensaje}, status=status)


def _destino(usuario):
    return "/admin-panel" if usuario.es_admin else "/"


def _entrar(request, usuario):
    usuario.backend = "django.contrib.auth.backends.ModelBackend"
    login(request, usuario)
    get_token(request)  # asegura la cookie csrftoken para las siguientes peticiones


# El login/registro/verificación se llaman antes de existir cookie CSRF (el frontend
# no hace un GET previo), por eso quedan exentos de CSRF. Se protegen con límite de intentos.
@csrf_exempt
def inicio_sesion(request):
    """POST /login/ con action=login|register (multipart, como envía el frontend)."""
    if request.method != "POST":
        return _error("Método no permitido.", 405)
    if request.POST.get("action") == "register":
        return _registrar(request)
    return _iniciar_sesion(request)


def _iniciar_sesion(request):
    email = request.POST.get("email", "").strip().lower()
    password = request.POST.get("password", "")
    if not email or not password:
        return _error("Correo y contraseña son obligatorios.")
    if servicios.bloqueado("login", request, email):
        return _error("Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.", 429)
    usuario = authenticate(request, username=email, password=password)
    if usuario is None:
        servicios.registrar_fallo("login", request, email)
        return _error("Correo o contraseña incorrectos.", 401)
    if settings.VERIFICACION_TELEFONO_ACTIVA and not usuario.telefono_verificado and not usuario.es_admin:
        return _error("Debes verificar tu teléfono antes de iniciar sesión.", 403)
    servicios.limpiar_fallos("login", request, email)
    _entrar(request, usuario)
    return JsonResponse({"ok": True, "redirect": _destino(usuario)})


def _registrar(request):
    nombre = request.POST.get("name", "").strip()
    email = request.POST.get("email", "").strip().lower()
    password = request.POST.get("password", "")
    telefono = re.sub(r"[\s\-()]", "", request.POST.get("telefono", ""))
    dob = request.POST.get("dob", "").strip()

    if not (nombre and email and password and telefono and dob):
        return _error("Todos los campos son obligatorios.")
    try:
        validate_email(email)
    except ValidationError:
        return _error("Correo electrónico inválido.")
    if not TELEFONO_RE.match(telefono):
        return _error("Teléfono inválido. Usa el formato +573001112233.")
    try:
        nacimiento = date.fromisoformat(dob)
    except ValueError:
        return _error("Fecha de nacimiento inválida.")
    if not (date(1900, 1, 1) <= nacimiento < date.today()):
        return _error("Fecha de nacimiento inválida.")
    if Usuario.objects.filter(email__iexact=email).exists():
        return _error("Ya existe una cuenta con ese correo.", 409)
    try:
        validate_password(password, Usuario(email=email, nombre=nombre))
    except ValidationError as exc:
        return _error(" ".join(exc.messages))

    usuario = Usuario.objects.create_user(
        email=email, password=password, nombre=nombre, telefono=telefono, fecha_nacimiento=nacimiento
    )
    if settings.VERIFICACION_TELEFONO_ACTIVA:
        codigo = servicios.generar_codigo(usuario)
        respuesta = {"ok": True, "verify_user_id": usuario.pk}
        if settings.DEBUG:
            respuesta["debug_code"] = codigo
        return JsonResponse(respuesta, status=201)
    _entrar(request, usuario)
    return JsonResponse({"ok": True, "redirect": "/"}, status=201)


@csrf_exempt
def verificar_telefono(request):
    """POST /verify-phone/ (user_id, code): confirma el teléfono e inicia sesión."""
    if request.method != "POST":
        return _error("Método no permitido.", 405)
    user_id = request.POST.get("user_id", "")
    if servicios.bloqueado("verify", request, user_id):
        return _error("Demasiados intentos. Solicita un nuevo registro o espera 15 minutos.", 429)
    usuario = Usuario.objects.filter(pk=user_id).first() if user_id.isdigit() else None
    if usuario is None or not servicios.codigo_valido(usuario, request.POST.get("code")):
        servicios.registrar_fallo("verify", request, user_id)
        return _error("Código inválido o vencido.", 400)
    usuario.telefono_verificado = True
    usuario.codigo_verificacion = ""
    usuario.codigo_expira = None
    usuario.save(update_fields=["telefono_verificado", "codigo_verificacion", "codigo_expira"])
    servicios.limpiar_fallos("verify", request, user_id)
    _entrar(request, usuario)
    return JsonResponse({"ok": True, "redirect": "/"})


def cerrar_sesion(request):
    """GET/POST /logout/ -> cierra sesión y vuelve a la pantalla de login del frontend."""
    logout(request)
    return redirect(settings.FRONTEND_LOGIN_URL)


@ensure_csrf_cookie
def quien_soy(request):
    """GET /api/whoami/ -> datos del usuario en sesión. También entrega la cookie CSRF."""
    u = request.user
    if not u.is_authenticated:
        return JsonResponse({"ok": False})
    return JsonResponse(
        {
            "ok": True,
            "id": u.pk,
            "username": u.nombre or u.email,
            "email": u.email,
            "role": "admin" if u.es_admin else u.rol,
            "photo_url": u.foto.url if u.foto else None,
        }
    )


class _PerfilForm(forms.Form):
    username = forms.CharField(max_length=150, required=False)
    photo = forms.ImageField(required=False)

    def clean_photo(self):
        foto = self.cleaned_data.get("photo")
        if foto and foto.size > 3 * 1024 * 1024:
            raise forms.ValidationError("La foto no puede superar 3 MB.")
        return foto


@require_POST
def actualizar_perfil(request):
    """POST /api/profile/update/ (username, photo)."""
    u = request.user
    if not u.is_authenticated:
        return _error("Debes iniciar sesión.", 401)
    form = _PerfilForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({"ok": False, "error": "; ".join(sum(form.errors.values(), []))}, status=400)
    campos = []
    if form.cleaned_data["username"].strip():
        u.nombre = form.cleaned_data["username"].strip()
        campos.append("nombre")
    if form.cleaned_data["photo"]:
        u.foto = form.cleaned_data["photo"]
        campos.append("foto")
    if campos:
        u.save(update_fields=campos)
    return JsonResponse({"ok": True, "username": u.nombre, "photo_url": u.foto.url if u.foto else None})
