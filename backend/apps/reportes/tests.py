from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

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