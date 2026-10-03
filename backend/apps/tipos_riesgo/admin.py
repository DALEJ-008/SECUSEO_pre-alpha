from django.contrib import admin

from .models import TipoRiesgo


@admin.register(TipoRiesgo)
class TipoRiesgoAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "nivel", "peso")
    list_filter = ("nivel",)
