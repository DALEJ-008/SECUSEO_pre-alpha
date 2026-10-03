from django.contrib.gis import admin

from .models import Reporte, Validacion


@admin.register(Reporte)
class ReporteAdmin(admin.GISModelAdmin):
    list_display = ("id", "tipo", "zona", "estado", "usuario", "fecha_creacion")
    list_filter = ("estado", "tipo", "zona")
    search_fields = ("ubicacion", "descripcion", "usuario__email")
    raw_id_fields = ("usuario", "revisado_por")


admin.site.register(Validacion)
