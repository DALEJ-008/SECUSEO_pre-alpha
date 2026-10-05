from django.contrib import admin

from .models import Comunicado, ComunicadoImagen


class ComunicadoImagenInline(admin.TabularInline):
    model = ComunicadoImagen
    extra = 0


@admin.register(Comunicado)
class ComunicadoAdmin(admin.ModelAdmin):
    inlines = [ComunicadoImagenInline]
