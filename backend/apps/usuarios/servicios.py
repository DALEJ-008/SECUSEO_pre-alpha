"""Servicios de usuarios: verificación de teléfono y limitación de intentos."""
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

VIGENCIA_CODIGO = timedelta(minutes=10)
MAX_INTENTOS = 5
VENTANA_SEGUNDOS = 15 * 60


def generar_codigo(usuario):
    """Genera y guarda un código de 6 dígitos y lo envía por SMS."""
    codigo = f"{secrets.randbelow(10**6):06d}"
    usuario.codigo_verificacion = codigo
    usuario.codigo_expira = timezone.now() + VIGENCIA_CODIGO
    usuario.save(update_fields=["codigo_verificacion", "codigo_expira"])
    enviar_sms(usuario.telefono, f"Tu código de verificación SECUSEO es {codigo}")
    return codigo


def enviar_sms(telefono, mensaje):
    """PENDIENTE: integrar un proveedor de SMS (p. ej. Twilio) aquí.

    Mientras no exista, el código solo se devuelve al frontend cuando DEBUG=true.
    """
    if settings.DEBUG:
        print(f"[SMS simulado] {telefono}: {mensaje}")


def codigo_valido(usuario, codigo):
    if not usuario.codigo_verificacion or not usuario.codigo_expira:
        return False
    if timezone.now() > usuario.codigo_expira:
        return False
    return secrets.compare_digest(usuario.codigo_verificacion, (codigo or "").strip())


def _clave(prefijo, request, ident):
    ip = request.META.get("REMOTE_ADDR", "")
    return f"{prefijo}:{ip}:{(ident or '').lower()}"


def bloqueado(prefijo, request, ident):
    return cache.get(_clave(prefijo, request, ident), 0) >= MAX_INTENTOS


def registrar_fallo(prefijo, request, ident):
    clave = _clave(prefijo, request, ident)
    cache.set(clave, cache.get(clave, 0) + 1, VENTANA_SEGUNDOS)


def limpiar_fallos(prefijo, request, ident):
    cache.delete(_clave(prefijo, request, ident))
