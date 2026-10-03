from django.urls import path

from . import views

app_name = "usuarios"
urlpatterns = [
    path("me/", views.quien_soy, name="me"),
]
