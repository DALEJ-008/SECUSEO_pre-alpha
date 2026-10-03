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
    class Meta:
        model = Notificacion
        fields = ["id", "titulo", "cuerpo", "leida", "fecha"]
