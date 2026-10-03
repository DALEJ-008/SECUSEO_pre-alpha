"""Vistas del dominio de reportes."""
from django.http import Http404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from .filters import ReporteFilter
from .models import Reporte, Validacion
from .permissions import reporte_visible_para
from .serializers import ReporteCrearSerializer, ReporteSerializer


def obtener_reporte_visible(pk, usuario):
    """Reporte por id respetando visibilidad; 404 si no existe o no puede verlo."""
    reporte = Reporte.objects.select_related("tipo", "zona", "usuario").filter(pk=pk).first()
    if reporte is None or not reporte_visible_para(reporte, usuario):
        raise Http404
    return reporte


class ReporteListaView(generics.ListAPIView):
    """GET /api/reportes/ -> {"reportes": [...]} solo con reportes validados."""

    serializer_class = ReporteSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    filterset_class = ReporteFilter
    search_fields = ["ubicacion", "descripcion", "zona__nombre"]
    ordering_fields = ["fecha_creacion"]
    ordering = ["-fecha_creacion"]

    def get_queryset(self):
        return Reporte.objects.filter(estado=Reporte.Estado.VALIDADO).select_related("tipo", "zona")

    def list(self, request, *args, **kwargs):
        consulta = self.filter_queryset(self.get_queryset())
        return Response({"reportes": self.get_serializer(consulta, many=True).data})


@extend_schema(responses=ReporteSerializer)
class ReporteDetalleView(APIView):
    """GET /api/reportes/<id>/"""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        reporte = obtener_reporte_visible(pk, request.user)
        return Response(ReporteSerializer(reporte).data)


@extend_schema(request=ReporteCrearSerializer, responses={201: ReporteSerializer})
class ReporteCrearView(APIView):
    """POST /api/reportes/crear/ (multipart: ubicacion, descripcion, tipo, lat, lng, imagen)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = ReporteCrearSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        reporte = serializer.save()
        return Response(ReporteSerializer(reporte).data, status=status.HTTP_201_CREATED)


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ValidacionLocalView(APIView):
    """GET/POST /api/reportes/<id>/validar-local/ — validación comunitaria."""

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get(self, request, pk):
        reporte = obtener_reporte_visible(pk, request.user)
        return Response({"count": reporte.validaciones.count()})

    def post(self, request, pk):
        reporte = obtener_reporte_visible(pk, request.user)
        if reporte.usuario_id == request.user.id:
            return Response({"error": "No puedes validar tu propio reporte."}, status=status.HTTP_400_BAD_REQUEST)
        _, creada = Validacion.objects.get_or_create(reporte=reporte, usuario=request.user)
        if not creada:
            return Response({"error": "Ya validaste este reporte."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"count": reporte.validaciones.count()}, status=status.HTTP_201_CREATED)
