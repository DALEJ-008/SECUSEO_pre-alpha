"""Filtros del dominio de administración."""
from django.db.models import Q

from apps.reportes.models import Reporte


def buscar_reportes(q="", estado=""):
    consulta = Reporte.objects.select_related("tipo", "zona", "usuario")
    if estado in Reporte.Estado.values:
        consulta = consulta.filter(estado=estado)
    q = (q or "").strip()
    if q:
        consulta = consulta.filter(
            Q(ubicacion__icontains=q)
            | Q(descripcion__icontains=q)
            | Q(tipo__codigo__icontains=q)
            | Q(tipo__nombre__icontains=q)
            | Q(zona__nombre__icontains=q)
            | Q(usuario__email__icontains=q)
            | Q(usuario__nombre__icontains=q)
        )
    return consulta