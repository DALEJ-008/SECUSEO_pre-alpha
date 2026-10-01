"""Vistas del dominio de comentarios."""
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.reportes.views import obtener_reporte_visible

from .models import Comentario
from .serializers import ComentarioCrearSerializer, ComentarioSerializer


@extend_schema(request=ComentarioCrearSerializer, responses=OpenApiTypes.OBJECT)
class ComentarioLocalView(APIView):
    """GET/POST /api/reportes/<id>/comentario-local/ -> {"comments": [...]}."""

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    def get(self, request, pk):
        reporte = obtener_reporte_visible(pk, request.user)
        comentarios = reporte.comentarios.select_related("autor")
        return Response({"comments": ComentarioSerializer(comentarios, many=True).data})

    def post(self, request, pk):
        reporte = obtener_reporte_visible(pk, request.user)
        entrada = ComentarioCrearSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        comentario = Comentario.objects.create(
            reporte=reporte, autor=request.user, texto=entrada.validated_data["texto"]
        )
        return Response(ComentarioSerializer(comentario).data, status=status.HTTP_201_CREATED)
