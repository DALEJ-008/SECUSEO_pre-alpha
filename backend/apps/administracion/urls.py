from django.urls import path

from . import views

app_name = "administracion"
urlpatterns = [
    path("counts/", views.ConteosView.as_view(), name="conteos"),
    path("reportes/pending/", views.ReportesPendientesView.as_view(), name="pendientes"),
    path("reportes/validated/", views.ReportesValidadosView.as_view(), name="validados"),
    path("reportes/search/", views.ReportesBusquedaView.as_view(), name="busqueda"),
    path("reportes/<int:pk>/detail/", views.ReporteAdminDetalleView.as_view(), name="reporte-detalle"),
    path("reportes/<int:pk>/validar/", views.ValidarReporteView.as_view(), name="reporte-validar"),
    path("reportes/<int:pk>/rechazar/", views.RechazarReporteView.as_view(), name="reporte-rechazar"),
    path("reportes/<int:pk>/eliminar/", views.EliminarReporteView.as_view(), name="reporte-eliminar"),
    path("users/", views.UsuariosView.as_view(), name="usuarios"),
    path("users/<int:pk>/set-role/", views.AsignarRolView.as_view(), name="usuario-rol"),
    path("users/<int:pk>/delete/", views.EliminarUsuarioView.as_view(), name="usuario-eliminar"),
]