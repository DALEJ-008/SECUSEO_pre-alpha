"""Modelos del dominio de comentarios."""
from django.conf import settings
from django.db import models


class Comentario(models.Model):
    reporte = models.ForeignKey("reportes.Reporte", on_delete=models.CASCADE, related_name="comentarios")
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comentarios")
    texto = models.TextField(max_length=1000)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "comentario"
        verbose_name_plural = "comentarios"

    def __str__(self):
        return f"Comentario #{self.pk} en reporte #{self.reporte_id}"