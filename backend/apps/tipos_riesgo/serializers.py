"""Serializadores del catálogo de tipos de riesgo."""
from rest_framework import serializers

from .models import TipoRiesgo


class TipoRiesgoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoRiesgo
        fields = ["codigo", "nombre", "nivel", "peso"]
