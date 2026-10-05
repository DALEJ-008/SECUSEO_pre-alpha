"""Serializadores del dominio de notificaciones."""
from rest_framework import serializers

from .models import Notificacion


class NotificacionSerializer(serializers.ModelSerializer):
    resumen = serializers.SerializerMethodField()

    class Meta:
        model = Notificacion
        fields = ["id", "titulo", "resumen", "leida", "fecha"]

    def get_resumen(self, obj) -> str:
        return obj.cuerpo if len(obj.cuerpo) <= 80 else obj.cuerpo[:77] + "..."


class NotificacionDetalleSerializer(serializers.ModelSerializer):
    imagenes = serializers.SerializerMethodField()

    class Meta:
        model = Notificacion
        fields = ["id", "titulo", "cuerpo", "leida", "fecha", "imagenes"]

    def get_imagenes(self, obj) -> list[str]:
        """URLs de las imágenes del comunicado asociado (vacío si no es un comunicado)."""
        if not obj.comunicado_id:
            return []
        return [img.imagen.url for img in obj.comunicado.imagenes.all() if img.imagen]
