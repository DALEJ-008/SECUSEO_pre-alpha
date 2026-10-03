from django.urls import path

from .views import NotificacionDetalleView, NotificacionLeerView, NotificacionListaView

app_name = "notificaciones"
urlpatterns = [
    path("", NotificacionListaView.as_view(), name="lista"),
    path("<int:pk>/leer/", NotificacionLeerView.as_view(), name="leer"),
    path("<int:pk>/detail/", NotificacionDetalleView.as_view(), name="detalle"),
]
