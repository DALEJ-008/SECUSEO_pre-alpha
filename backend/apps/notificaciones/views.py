"""Vistas del dominio de notificaciones (siempre del usuario autenticado)."""
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from .models import Notificacion
from .serializers import NotificacionDetalleSerializer, NotificacionSerializer


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class NotificacionListaView(APIView):
    """GET /api/notificaciones/ -> {"notificaciones": [...]}"""

    def get(self, request):
        consulta = Notificacion.objects.filter(usuario=request.user)[:50]
        return Response({"notificaciones": NotificacionSerializer(consulta, many=True).data})


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class NotificacionLeerView(APIView):
    def post(self, request, pk):
        n = get_object_or_404(Notificacion, pk=pk, usuario=request.user)
        if not n.leida:
            n.leida = True
            n.save(update_fields=["leida"])
        return Response({"ok": True})


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class NotificacionDetalleView(APIView):
    def get(self, request, pk):
        n = get_object_or_404(Notificacion, pk=pk, usuario=request.user)
        return Response(NotificacionDetalleSerializer(n).data)
