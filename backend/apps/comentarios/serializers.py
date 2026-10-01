"""Serializadores del dominio de comentarios."""
from rest_framework import serializers

from .models import Comentario


class ComentarioSerializer(serializers.ModelSerializer):
    autor = serializers.CharField(source="autor.nombre", read_only=True)

    class Meta:
        model = Comentario
        fields = ["id", "autor", "texto", "fecha"]


class ComentarioCrearSerializer(serializers.Serializer):
    texto = serializers.CharField(max_length=1000, trim_whitespace=True)