from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Zona
from .serializers import ZonaSerializer


class ZonaListaView(generics.ListAPIView):
    """Listado de zonas (sin geometría; los polígonos los usa el frontend desde el GeoJSON)."""

    queryset = Zona.objects.all()
    serializer_class = ZonaSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    filter_backends = []
