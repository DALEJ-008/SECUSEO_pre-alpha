"""Controladores del dominio de administración."""
from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.notificaciones.models import Notificacion
from apps.notificaciones.servicios import notificar
from apps.reportes.models import Reporte
from apps.reportes.serializers import ReporteAdminSerializer
from apps.usuarios.models import Usuario

from .filters import buscar_reportes
from .models import Comunicado
from .permissions import EsAdministrador, EsModerador
from .serializers import UsuarioAdminSerializer

_CON_RELACIONES = ("tipo", "zona", "usuario")


def _lista(consulta):
    return Response({"reportes": ReporteAdminSerializer(consulta, many=True).data})


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ConteosView(APIView):
    permission_classes = [EsModerador]

    def get(self, request):
        desde = timezone.now() - timedelta(days=7)
        return Response(
            {
                "pending_reportes": Reporte.objects.filter(estado=Reporte.Estado.PENDIENTE).count(),
                "validated_reportes": Reporte.objects.filter(estado=Reporte.Estado.VALIDADO).count(),
                "users_total": Usuario.objects.count(),
                "comunicados_recientes": Comunicado.objects.filter(fecha__gte=desde).count(),
            }
        )


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ReportesPendientesView(APIView):
    permission_classes = [EsModerador]

    def get(self, request):
        return _lista(Reporte.objects.filter(estado=Reporte.Estado.PENDIENTE).select_related(*_CON_RELACIONES))


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ReportesValidadosView(APIView):
    permission_classes = [EsModerador]

    def get(self, request):
        return _lista(Reporte.objects.filter(estado=Reporte.Estado.VALIDADO).select_related(*_CON_RELACIONES))


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ReportesBusquedaView(APIView):
    permission_classes = [EsModerador]

    def get(self, request):
        return _lista(buscar_reportes(request.query_params.get("q"), request.query_params.get("estado")))


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ReporteAdminDetalleView(APIView):
    permission_classes = [EsModerador]

    def get(self, request, pk):
        reporte = get_object_or_404(Reporte.objects.select_related(*_CON_RELACIONES), pk=pk)
        return Response(ReporteAdminSerializer(reporte).data)


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class _ModerarReporteView(APIView):
    """Base: cambia el estado de un reporte y avisa a su autor."""

    permission_classes = [EsModerador]
    nuevo_estado = None
    titulo = ""
    mensaje = ""

    def post(self, request, pk):
        reporte = get_object_or_404(Reporte.objects.select_related("usuario"), pk=pk)
        with transaction.atomic():
            reporte.estado = self.nuevo_estado
            reporte.revisado_por = request.user
            reporte.fecha_revision = timezone.now()
            reporte.save(update_fields=["estado", "revisado_por", "fecha_revision"])
            if reporte.usuario_id != request.user.id:
                notificar(reporte.usuario, self.titulo, self.mensaje.format(id=reporte.pk))
        return Response({"ok": True, "id": reporte.pk, "estado": reporte.estado})


class ValidarReporteView(_ModerarReporteView):
    nuevo_estado = Reporte.Estado.VALIDADO
    titulo = "Tu reporte fue aprobado"
    mensaje = "Tu reporte #{id} fue validado y ya aparece en el mapa de SECUSEO."


class RechazarReporteView(_ModerarReporteView):
    nuevo_estado = Reporte.Estado.RECHAZADO
    titulo = "Tu reporte fue rechazado"
    mensaje = "Tu reporte #{id} no cumplió los criterios de validación y fue rechazado."


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class EliminarReporteView(APIView):
    permission_classes = [EsModerador]

    def post(self, request, pk):
        reporte = get_object_or_404(Reporte, pk=pk)
        reporte.delete()
        return Response({"ok": True})


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class UsuariosView(APIView):
    permission_classes = [EsAdministrador]

    def get(self, request):
        return Response({"users": UsuarioAdminSerializer(Usuario.objects.order_by("id"), many=True).data})


def _es_ultimo_admin(usuario):
    return usuario.es_admin and Usuario.objects.filter(rol=Usuario.Rol.ADMIN, is_active=True).exclude(pk=usuario.pk).count() == 0


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class AsignarRolView(APIView):
    permission_classes = [EsAdministrador]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        rol = (request.data.get("role") or "").strip().lower()
        if rol not in Usuario.Rol.values:
            return Response(
                {"mensaje": "Rol inválido.", "detalle": {"role": [f"Usa uno de: {', '.join(Usuario.Rol.values)}."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario = get_object_or_404(Usuario, pk=pk)
        if rol != Usuario.Rol.ADMIN and _es_ultimo_admin(usuario):
            return Response(
                {"mensaje": "No puedes quitar el rol al único administrador.", "detalle": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.rol = rol
        usuario.save(update_fields=["rol"])
        return Response({"ok": True, "id": usuario.pk, "role": usuario.rol})


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class EliminarUsuarioView(APIView):
    permission_classes = [EsAdministrador]

    def post(self, request, pk):
        usuario = get_object_or_404(Usuario, pk=pk)
        if usuario.pk == request.user.pk:
            return Response({"mensaje": "No puedes eliminar tu propia cuenta.", "detalle": {}}, status=400)
        if _es_ultimo_admin(usuario):
            return Response({"mensaje": "No puedes eliminar al único administrador.", "detalle": {}}, status=400)
        usuario.delete()
        return Response({"ok": True})


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ComunicadoCrearView(APIView):
    """POST /api/comunicado/create/ (title, body) -> notifica a todos los usuarios activos."""

    permission_classes = [EsAdministrador]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        titulo = (request.data.get("title") or "").strip()[:120]
        cuerpo = (request.data.get("body") or "").strip()
        if not titulo or not cuerpo:
            return Response(
                {"mensaje": "La solicitud contiene errores de validación.", "detalle": {"body": ["Este campo es obligatorio."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            comunicado = Comunicado.objects.create(titulo=titulo, cuerpo=cuerpo, creado_por=request.user)
            Notificacion.objects.bulk_create(
                [
                    Notificacion(usuario=u, titulo=titulo, cuerpo=cuerpo, comunicado=comunicado)
                    for u in Usuario.objects.filter(is_active=True)
                ]
            )
        return Response({"ok": True, "id": comunicado.pk}, status=status.HTTP_201_CREATED)
