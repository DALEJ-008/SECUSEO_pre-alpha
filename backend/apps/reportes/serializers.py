"""Serializadores del dominio de reportes."""
from django.conf import settings
from django.contrib.gis.geos import Point
from rest_framework import serializers

from apps.tipos_riesgo.models import TipoRiesgo
from apps.zonas.models import Zona

from .models import Reporte


class ReporteSerializer(serializers.ModelSerializer):
    """Forma pública que consume el frontend (coordenadas = [lng, lat])."""

    tipo = serializers.CharField(source="tipo.codigo", read_only=True)
    zona = serializers.SerializerMethodField()
    coordenadas = serializers.SerializerMethodField()
    imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = Reporte
        fields = ["id", "ubicacion", "descripcion", "tipo", "zona", "coordenadas", "estado", "fecha_creacion", "imagen_url"]

    def get_zona(self, obj) -> str:
        return obj.zona.nombre if obj.zona_id else "Sin zona"

    def get_coordenadas(self, obj) -> list[float] | None:
        return [obj.punto.x, obj.punto.y] if obj.punto else None

    def get_imagen_url(self, obj) -> str | None:
        return obj.imagen.url if obj.imagen else None


class ReporteAdminSerializer(ReporteSerializer):
    """Añade prioridad y datos del autor para el panel de administración."""

    prioridad = serializers.CharField(source="tipo.nivel", read_only=True)
    creado_por = serializers.SerializerMethodField()

    class Meta(ReporteSerializer.Meta):
        fields = ReporteSerializer.Meta.fields + ["prioridad", "creado_por"]

    def get_creado_por(self, obj) -> dict:
        u = obj.usuario
        return {"id": u.id, "username": u.nombre, "email": u.email, "telefono": u.telefono}


class ReporteCrearSerializer(serializers.Serializer):
    ubicacion = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    descripcion = serializers.CharField(max_length=2000)
    tipo = serializers.CharField(required=False, allow_blank=True, default="otro")
    lat = serializers.FloatField(required=False, min_value=-90, max_value=90)
    lng = serializers.FloatField(required=False, min_value=-180, max_value=180)
    imagen = serializers.ImageField(required=False)

    def validate_imagen(self, imagen):
        limite = settings.TAMANO_MAX_IMAGEN_MB * 1024 * 1024
        if imagen.size > limite:
            raise serializers.ValidationError(f"La imagen no puede superar {settings.TAMANO_MAX_IMAGEN_MB} MB.")
        return imagen

    def validate(self, datos):
        if ("lat" in datos) != ("lng" in datos):
            raise serializers.ValidationError("Envía lat y lng juntos.")
        codigo = (datos.get("tipo") or "otro").strip().lower()
        tipo = TipoRiesgo.objects.filter(codigo=codigo).first() or TipoRiesgo.objects.filter(codigo="otro").first()
        if tipo is None:
            raise serializers.ValidationError({"tipo": "Catálogo de tipos de riesgo vacío (ejecuta las migraciones)."})
        datos["tipo_obj"] = tipo
        return datos

    def create(self, datos):
        punto = Point(datos["lng"], datos["lat"], srid=4326) if "lat" in datos else None
        return Reporte.objects.create(
            usuario=self.context["request"].user,
            tipo=datos["tipo_obj"],
            ubicacion=datos.get("ubicacion", ""),
            descripcion=datos["descripcion"],
            punto=punto,
            zona=Zona.para_punto(punto),
            imagen=datos.get("imagen"),
        )
