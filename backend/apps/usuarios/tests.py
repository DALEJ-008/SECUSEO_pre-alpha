"""Pruebas de autenticación y perfil (flujo igual al del frontend)."""
from django.test import override_settings

from apps.tests_base import BaseAPITest
from apps.usuarios.models import Usuario

REGISTRO = {
    "action": "register", "name": "Nuevo Usuario", "email": "nuevo@x.co", "password": "Clave-Segura-9",
    "telefono": "+573001112244", "dob": "2000-05-01",
}


class AuthTests(BaseAPITest):
    def test_login_correcto_sin_cookie_previa_y_whoami(self):
        c = self.cliente()  # sin sesión
        r = c.post("/login/", {"action": "login", "email": "ana@x.co", "password": "Clave-Segura-9"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"ok": True, "redirect": "/"})
        w = c.get("/api/whoami/").json()
        self.assertEqual((w["ok"], w["username"], w["email"], w["role"]), (True, "Ana", "ana@x.co", "user"))

    def test_login_admin_redirige_al_panel(self):
        r = self.client.post("/login/", {"action": "login", "email": "admin@x.co", "password": "Clave-Segura-9"})
        self.assertEqual(r.json()["redirect"], "/admin-panel")

    def test_login_correo_insensible_a_mayusculas(self):
        r = self.client.post("/login/", {"action": "login", "email": "ANA@X.CO", "password": "Clave-Segura-9"})
        self.assertTrue(r.json()["ok"])

    def test_login_incorrecto(self):
        r = self.client.post("/login/", {"action": "login", "email": "ana@x.co", "password": "mala"})
        self.assertEqual(r.status_code, 401)
        self.assertFalse(r.json()["ok"])
        self.assertIn("error", r.json())

    def test_bloqueo_tras_demasiados_intentos(self):
        from django.core.cache import cache

        cache.clear()
        for _ in range(5):
            self.client.post("/login/", {"action": "login", "email": "ana@x.co", "password": "mala"})
        r = self.client.post("/login/", {"action": "login", "email": "ana@x.co", "password": "Clave-Segura-9"})
        self.assertEqual(r.status_code, 429)
        cache.clear()

    def test_whoami_anonimo(self):
        self.assertEqual(self.client.get("/api/whoami/").json(), {"ok": False})

    def test_registro_inicia_sesion_cuando_no_hay_verificacion(self):
        c = self.cliente()
        r = c.post("/login/", REGISTRO)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["redirect"], "/")
        u = Usuario.objects.get(email="nuevo@x.co")
        self.assertEqual((u.nombre, u.telefono, u.rol), ("Nuevo Usuario", "+573001112244", "user"))
        self.assertEqual(c.get("/api/whoami/").json()["email"], "nuevo@x.co")

    def test_registro_validaciones(self):
        casos = [
            ({"email": "ana@x.co"}, 409),
            ({"email": "no-es-correo"}, 400),
            ({"password": "123"}, 400),
            ({"telefono": "abc"}, 400),
            ({"dob": "2999-01-01"}, 400),
            ({"name": ""}, 400),
        ]
        for cambio, estado in casos:
            r = self.client.post("/login/", {**REGISTRO, **cambio})
            self.assertEqual(r.status_code, estado, cambio)
            self.assertFalse(r.json()["ok"])

    @override_settings(VERIFICACION_TELEFONO_ACTIVA=True, DEBUG=True)
    def test_registro_con_verificacion_de_telefono(self):
        r = self.client.post("/login/", REGISTRO).json()
        self.assertIn("verify_user_id", r)
        self.assertEqual(len(r["debug_code"]), 6)
        # sin verificar no puede entrar
        no = self.client.post("/login/", {"action": "login", "email": "nuevo@x.co", "password": "Clave-Segura-9"})
        self.assertEqual(no.status_code, 403)
        mal = self.client.post("/verify-phone/", {"user_id": r["verify_user_id"], "code": "000000"})
        self.assertEqual(mal.status_code, 400)
        ok = self.client.post("/verify-phone/", {"user_id": r["verify_user_id"], "code": r["debug_code"]})
        self.assertTrue(ok.json()["ok"])
        self.assertEqual(self.client.get("/api/whoami/").json()["email"], "nuevo@x.co")

    @override_settings(VERIFICACION_TELEFONO_ACTIVA=True, DEBUG=False)
    def test_codigo_no_se_expone_fuera_de_debug(self):
        r = self.client.post("/login/", REGISTRO).json()
        self.assertNotIn("debug_code", r)

    def test_logout(self):
        c = self.cliente(self.ana)
        r = c.get("/logout/")
        self.assertEqual(r.status_code, 302)
        self.assertEqual(c.get("/api/whoami/").json(), {"ok": False})

    def test_actualizar_perfil_exige_csrf_y_sesion(self):
        c = self.cliente(self.ana)
        self.assertEqual(c.post("/api/profile/update/", {"username": "X"}).status_code, 403)  # sin token CSRF
        r = self.post(c, "/api/profile/update/", {"username": "Ana María"})
        self.assertEqual(r.json()["username"], "Ana María")
        self.assertEqual(self.post(self.cliente(), "/api/profile/update/", {"username": "X"}).status_code, 401)
