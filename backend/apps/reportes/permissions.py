"""Permisos del dominio de reportes."""
from .models import Reporte


def reporte_visible_para(reporte, usuario):
    """Los reportes validados son públicos; los demás solo los ve su autor o la moderación."""
    if reporte.estado == Reporte.Estado.VALIDADO:
        return True
    if not usuario.is_authenticated:
        return False
    return reporte.usuario_id == usuario.id or usuario.puede_moderar
