"""Modelos del catálogo de tipos de riesgo."""
from django.db import models


class TipoRiesgo(models.Model):
    class Nivel(models.TextChoices):
        ALTO = "alto", "Alto"
        MEDIO = "medio", "Medio"
        BAJO = "bajo", "Bajo"

    codigo = models.SlugField(max_length=40, unique=True)
    nombre = models.CharField(max_length=80)
    nivel = models.CharField(max_length=5, choices=Nivel.choices, default=Nivel.BAJO)
    peso = models.FloatField(default=1.0, help_text="Peso usado para calcular el riesgo de una zona.")

    class Meta:
        ordering = ["nombre"]
        verbose_name = "tipo de riesgo"
        verbose_name_plural = "tipos de riesgo"

    def __str__(self):
        return self.nombre