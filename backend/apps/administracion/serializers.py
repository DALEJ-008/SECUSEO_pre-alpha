"""Serializadores del dominio de administración."""
from rest_framework import serializers

from apps.usuarios.models import Usuario


class UsuarioAdminSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="nombre")
    role = serializers.CharField(source="rol")

    class Meta:
        model = Usuario
        fields = ["id", "username", "nombre", "email", "telefono", "role"]
