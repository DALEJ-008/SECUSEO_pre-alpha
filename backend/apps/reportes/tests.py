import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from django.urls import reverse
from PIL import Image
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from apps.reportes.models import Reporte
from apps.tests_base import BaseAPITest
from config.excepciones import manejador_excepciones_api


class DocumentacionAPITests(SimpleTestCase):
    def test_documentacion_openapi_disponible(self):
        response = self.client.get(reverse("documentacion-api"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "swagger-ui")

    def test_error_validacion_con_formato_estandar(self):
        solicitud = APIRequestFactory().post("/api/reportes/")
        error = ValidationError({"titulo": ["Este campo es obligatorio."]})

        response = manejador_excepciones_api(
            error,
            {"request": solicitud, "view": APIView()},
        )

        self.assertEqual(
            response.data,
            {
                "mensaje": "La solicitud contiene errores de validación.",
                "detalle": {"titulo": ["Este campo es obligatorio."]},
            },
        )


def _png():
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, "PNG")
    return SimpleUploadedFile("foto.png", buf.getvalue(), content_type="image/png")


class ReportesAPITests(BaseAPITest):
    def test_esquema_openapi_se_genera(self):
        self.assertEqual(self.client.get("/api/schema/").status_code, 200)

    def test_crear_reporte_como_el_formulario(self):
        c = self.cliente(self.ana)
        r = self.post(c, "/api/reportes/crear/", {
            "ubicacion": "Calle 15", "descripcion": "Robaron a un peatón", "tipo": "robo",
            "lat": "4.7165", "lng": "-74.2125", "imagen": _png(),
        })
        self.assertEqual(r.status_code, 201, r.content)
        rep = Reporte.objects.get()
        self.assertEqual((rep.estado, rep.usuario, rep.tipo.codigo), ("pendiente", self.ana, "robo"))
        self.assertIsNotNone(rep.punto)
        self.assertTrue(rep.imagen.name.startswith("reportes/"))
        rep.imagen.delete()

    def test_crear_sin_coordenadas_y_tipo_desconocido_cae_en_otro(self):
        c = self.cliente(self.ana)
        r = self.post(c, "/api/reportes/crear/", {"ubicacion": "x", "descripcion": "algo", "tipo": "inventado"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["tipo"], "otro")
        self.assertEqual(r.json()["zona"], "Sin zona")
        self.assertIsNone(r.json()["coordenadas"])

    def test_crear_validaciones(self):
        c = self.cliente(self.ana)
        self.assertEqual(self.post(c, "/api/reportes/crear/", {"descripcion": ""}).status_code, 400)
        self.assertEqual(self.post(c, "/api/reportes/crear/", {"descripcion": "a", "lat": "4.7"}).status_code, 400)
        self.assertEqual(self.post(c, "/api/reportes/crear/", {"descripcion": "a", "lat": "999", "lng": "1"}).status_code, 400)
        falsa = SimpleUploadedFile("a.png", b"no soy imagen", content_type="image/png")
        self.assertEqual(self.post(c, "/api/reportes/crear/", {"descripcion": "a", "imagen": falsa}).status_code, 400)
        err = self.post(c, "/api/reportes/crear/", {"descripcion": ""}).json()
        self.assertIn("mensaje", err)
        self.assertIn("descripcion", err["detalle"])

    def test_crear_exige_autenticacion(self):
        r = self.post(self.cliente(), "/api/reportes/crear/", {"descripcion": "x"})
        self.assertIn(r.status_code, (401, 403))

    def test_lista_publica_solo_validados_con_formato_del_frontend(self):
        v = self.crear_reporte(self.ana, "validado")
        self.crear_reporte(self.ana, "pendiente")
        self.crear_reporte(self.ana, "rechazado")
        data = self.cliente().get("/api/reportes/").json()
        self.assertEqual([r["id"] for r in data["reportes"]], [v.id])
        r = data["reportes"][0]
        self.assertEqual(r["tipo"], "robo")
        self.assertEqual(len(r["coordenadas"]), 2)
        self.assertAlmostEqual(r["coordenadas"][0], -74.2125, 4)  # [lng, lat]
        self.assertNotEqual(r["zona"], "")
        self.assertNotIn("prioridad", r)  # el frontend usa el peso por tipo si no hay prioridad

    def test_zona_se_asigna_por_punto_en_poligono(self):
        from apps.zonas.models import Zona

        z = Zona.objects.get(nombre="EL PORVENIR")
        c = z.geometria.point_on_surface
        rep = self.crear_reporte(self.ana, lat=c.y, lng=c.x)
        self.assertEqual(rep.zona, z)
        lejos = self.crear_reporte(self.ana, lat=10.0, lng=-70.0)
        self.assertIsNone(lejos.zona)

    def test_filtros_de_lista(self):
        self.crear_reporte(self.ana, tipo="robo")
        self.crear_reporte(self.ana, tipo="hurto")
        data = self.client.get("/api/reportes/?tipo=hurto").json()["reportes"]
        self.assertEqual([r["tipo"] for r in data], ["hurto"])

    def test_detalle_visibilidad(self):
        pendiente = self.crear_reporte(self.ana, "pendiente")
        url = f"/api/reportes/{pendiente.id}/"
        self.assertEqual(self.client.get(url).status_code, 404)  # anónimo
        self.assertEqual(self.cliente(self.luis).get(url).status_code, 404)  # otro usuario
        self.assertEqual(self.cliente(self.ana).get(url).status_code, 200)  # autor
        self.assertEqual(self.cliente(self.admin).get(url).status_code, 200)  # moderación
        validado = self.crear_reporte(self.ana, "validado")
        d = self.client.get(f"/api/reportes/{validado.id}/").json()
        for campo in ("ubicacion", "tipo", "descripcion", "zona", "fecha_creacion", "imagen_url"):
            self.assertIn(campo, d)

    def test_comentarios(self):
        rep = self.crear_reporte(self.ana)
        url = f"/api/reportes/{rep.id}/comentario-local/"
        self.assertEqual(self.client.get(url).json(), {"comments": []})
        c = self.cliente(self.luis)
        self.assertEqual(self.post(c, url, {"texto": "  Yo también lo vi  "}).status_code, 201)
        self.assertEqual(self.post(c, url, {"texto": "   "}).status_code, 400)
        lista = self.client.get(url).json()["comments"]
        self.assertEqual((lista[0]["autor"], lista[0]["texto"]), ("Luis", "Yo también lo vi"))
        self.assertIn("fecha", lista[0])
        self.assertIn(self.post(self.cliente(), url, {"texto": "x"}).status_code, (401, 403))

    def test_validacion_comunitaria(self):
        rep = self.crear_reporte(self.ana)
        url = f"/api/reportes/{rep.id}/validar-local/"
        self.assertEqual(self.client.get(url).json()["count"], 0)
        c = self.cliente(self.luis)
        r = self.post(c, url)
        self.assertEqual(r.json()["count"], 1)
        dup = self.post(c, url)
        self.assertEqual(dup.status_code, 400)
        self.assertIn("error", dup.json())
        propio = self.post(self.cliente(self.ana), url)
        self.assertEqual(propio.status_code, 400)
        self.assertEqual(self.client.get(url).json()["count"], 1)
