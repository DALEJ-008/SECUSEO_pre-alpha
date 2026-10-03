"""Filtros del dominio de reportes."""
import django_filters

from .models import Reporte


class ReporteFilter(django_filters.FilterSet):
    tipo = django_filters.CharFilter(field_name="tipo__codigo")
    zona = django_filters.CharFilter(field_name="zona__nombre", lookup_expr="iexact")
    desde = django_filters.DateFilter(field_name="fecha_creacion", lookup_expr="date__gte")
    hasta = django_filters.DateFilter(field_name="fecha_creacion", lookup_expr="date__lte")

    class Meta:
        model = Reporte
        fields = ["tipo", "zona", "desde", "hasta"]
