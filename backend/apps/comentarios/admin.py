from django.contrib import admin

from .models import Comentario


@admin.register(Comentario)
class ComentarioAdmin(admin.ModelAdmin):
    list_display = ("id", "reporte", "autor", "fecha")
    search_fields = ("texto", "autor__email")