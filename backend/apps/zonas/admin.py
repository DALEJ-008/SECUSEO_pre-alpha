from django.contrib.gis import admin

from .models import Zona


@admin.register(Zona)
class ZonaAdmin(admin.GISModelAdmin):
    list_display = ("nombre", "codigo_barrio", "cuadrante")
    search_fields = ("nombre",)
