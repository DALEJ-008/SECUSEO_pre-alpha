from django.urls import path

from .views import ZonaListaView

app_name = "zonas"
urlpatterns = [path("", ZonaListaView.as_view(), name="lista")]
