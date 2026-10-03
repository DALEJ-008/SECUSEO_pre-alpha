"""Utilidades compartidas por las pruebas."""
from django.core.management import call_command
from django.test import Client, TestCase

from apps.usuarios.models import Usuario


class BaseAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_zonas", verbosity=0)
        cls.admin = Usuario.objects.create_user("admin@x.co", "Clave-Segura-9", nombre="Admin", rol="admin")
        cls.moderador = Usuario.objects.create_user("mod@x.co", "Clave-Segura-9", nombre="Mod", rol="moderator")
        cls.ana = Usuario.objects.create_user("ana@x.co", "Clave-Segura-9", nombre="Ana", telefono="+573001112233")
        cls.luis = Usuario.objects.create_user("luis@x.co", "Clave-Segura-9", nombre="Luis")

    def cliente(self, usuario=None):
        """Cliente que, como el navegador, exige CSRF; si hay usuario, inicia sesión vía /login/."""
        c = Client(enforce_csrf_checks=True)
        if usuario:
            r = c.post("/login/", {"action": "login", "email": usuario.email, "password": "Clave-Segura-9"})
            assert r.status_code == 200, r.content
        c.get("/api/whoami/")  # entrega la cookie csrftoken
        return c

    @staticmethod
    def post(c, url, data=None, **extra):
        token = c.cookies["csrftoken"].value if "csrftoken" in c.cookies else ""
        return c.post(url, data or {}, HTTP_X_CSRFTOKEN=token, **extra)

    def crear_reporte(self, usuario, estado="validado", tipo="robo", lat=4.7165, lng=-74.2125, descripcion="Desc"):
        from django.contrib.gis.geos import Point

        from apps.reportes.models import Reporte
        from apps.tipos_riesgo.models import TipoRiesgo
        from apps.zonas.models import Zona

        p = Point(lng, lat, srid=4326)
        return Reporte.objects.create(
            usuario=usuario, tipo=TipoRiesgo.objects.get(codigo=tipo), ubicacion="Calle 1", descripcion=descripcion,
            punto=p, zona=Zona.para_punto(p), estado=estado,
        )
