from django.urls import path

from .views import ComentarioLocalView

app_name = "comentarios"
# Los comentarios se exponen bajo /api/reportes/<id>/comentario-local/ (ver reportes/urls.py).
# Este módulo queda como alias de lectura/escritura por id de reporte.
urlpatterns = [path("reporte/<int:pk>/", ComentarioLocalView.as_view(), name="por-reporte")]
