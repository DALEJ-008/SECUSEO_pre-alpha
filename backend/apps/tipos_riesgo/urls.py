from django.urls import path
from .views import TipoRiesgoListaView

app_name = "tipos_riesgo"
urlpatterns = [
    path("", TipoRiesgoListaView.as_view(), name="lista")
    ]