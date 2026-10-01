"""Vistas del catálogo de tipos de riesgo."""
from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import TipoRiesgo
from .serializers import TipoRiesgoSerializer


class TipoRiesgoListaView(generics.ListAPIView):
    """Catálogo de tipos de riesgo (público)."""

    queryset = TipoRiesgo.objects.all()
    serializer_class = TipoRiesgoSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    filter_backends = []