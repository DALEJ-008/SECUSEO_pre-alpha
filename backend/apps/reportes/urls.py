from django.urls import path

from apps.comentarios.views import ComentarioLocalView

from .views import ReporteCrearView, ReporteDetalleView, ReporteListaView, ValidacionLocalView

app_name = "reportes"
urlpatterns = [
    path("", ReporteListaView.as_view(), name="lista"),
    path("crear/", ReporteCrearView.as_view(), name="crear"),
    path("<int:pk>/", ReporteDetalleView.as_view(), name="detalle"),
    path("<int:pk>/comentario-local/", ComentarioLocalView.as_view(), name="comentario-local"),
    path("<int:pk>/validar-local/", ValidacionLocalView.as_view(), name="validar-local"),
]
