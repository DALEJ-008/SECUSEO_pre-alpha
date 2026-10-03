"""Modelos del dominio de reportes."""
from django.conf import settings
from django.contrib.gis.db import models


class Reporte(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        VALIDADO = "validado", "Validado"
        RECHAZADO = "rechazado", "Rechazado"

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reportes")
    tipo = models.ForeignKey("tipos_riesgo.TipoRiesgo", on_delete=models.PROTECT, related_name="reportes")
    zona = models.ForeignKey("zonas.Zona", null=True, blank=True, on_delete=models.SET_NULL, related_name="reportes")
    ubicacion = models.CharField(max_length=255, blank=True)
    descripcion = models.TextField()
    punto = models.PointField(srid=4326, null=True, blank=True)
    imagen = models.ImageField(upload_to="reportes/%Y/%m/", null=True, blank=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE, db_index=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_revision = models.DateTimeField(null=True, blank=True)
    revisado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reportes_revisados"
    )

    class Meta:
        ordering = ["-fecha_creacion"]
        verbose_name = "reporte"
        verbose_name_plural = "reportes"

    def __str__(self):
        return f"Reporte #{self.pk} ({self.tipo_id})"


class Validacion(models.Model):
    """Confirmación comunitaria de que un reporte sí ocurrió (una por usuario)."""

    reporte = models.ForeignKey(Reporte, on_delete=models.CASCADE, related_name="validaciones")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="validaciones")
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["reporte", "usuario"], name="validacion_unica_por_usuario")]
        verbose_name = "validación"
        verbose_name_plural = "validaciones"
