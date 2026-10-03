"""Modelos del dominio de notificaciones."""
from django.conf import settings
from django.db import models


class Notificacion(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notificaciones")
    titulo = models.CharField(max_length=120)
    cuerpo = models.TextField()
    leida = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)
    comunicado = models.ForeignKey(
        "administracion.Comunicado", null=True, blank=True, on_delete=models.SET_NULL, related_name="notificaciones"
    )

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "notificación"
        verbose_name_plural = "notificaciones"

    def __str__(self):
        return f"{self.titulo} -> {self.usuario_id}"
