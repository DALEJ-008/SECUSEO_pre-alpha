"""Modelos del dominio de administración."""
from django.conf import settings
from django.db import models


class Comunicado(models.Model):
    """Mensaje de la administración enviado a todos los usuarios como notificación."""

    titulo = models.CharField(max_length=120)
    cuerpo = models.TextField()
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="comunicados"
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "comunicado"
        verbose_name_plural = "comunicados"

    def __str__(self):
        return self.titulo
