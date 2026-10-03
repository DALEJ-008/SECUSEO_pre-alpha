"""Modelos del dominio de zonas (barrios de Funza)."""
from django.contrib.gis.db import models


class Zona(models.Model):
    nombre = models.CharField(max_length=150, unique=True)
    codigo_barrio = models.IntegerField(null=True, blank=True)
    cuadrante = models.IntegerField(null=True, blank=True)
    geometria = models.MultiPolygonField(srid=4326)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "zona"
        verbose_name_plural = "zonas"

    def __str__(self):
        return self.nombre

    @classmethod
    def para_punto(cls, punto):
        """Zona (barrio) que contiene el punto, o None."""
        if punto is None:
            return None
        return cls.objects.filter(geometria__contains=punto).first()
