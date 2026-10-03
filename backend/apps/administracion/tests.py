"""Pruebas del panel de administración y notificaciones."""
from apps.reportes.models import Reporte
from apps.tests_base import BaseAPITest
from apps.usuarios.models import Usuario


class AdminAPITests(BaseAPITest):
    def test_permisos(self):
        rep = self.crear_reporte(self.ana, "pendiente")
        rutas_get = ["/admin/api/counts/", "/admin/api/reportes/pending/", "/admin/api/users/", f"/admin/api/reportes/{rep.id}/detail/"]
        for u in rutas_get:
            self.assertIn(self.cliente().get(u).status_code, (401, 403), u)
            self.assertEqual(self.cliente(self.ana).get(u).status_code, 403, u)
        c = self.cliente(self.ana)
        self.assertEqual(self.post(c, f"/admin/api/reportes/{rep.id}/validar/").status_code, 403)
        self.assertEqual(self.post(c, f"/admin/api/reportes/{rep.id}/rechazar/").status_code, 403)
        rep.refresh_from_db()
        self.assertEqual(rep.estado, "pendiente")

    def test_moderador_modera_pero_no_gestiona_usuarios(self):
        c = self.cliente(self.moderador)
        self.assertEqual(c.get("/admin/api/reportes/pending/").status_code, 200)
        self.assertEqual(c.get("/admin/api/users/").status_code, 403)

    def test_contadores_y_listas(self):
        self.crear_reporte(self.ana, "pendiente")
        self.crear_reporte(self.ana, "validado")
        c = self.cliente(self.admin)
        cnt = c.get("/admin/api/counts/").json()
        self.assertEqual((cnt["pending_reportes"], cnt["validated_reportes"], cnt["users_total"], cnt["comunicados_recientes"]), (1, 1, 4, 0))
        p = c.get("/admin/api/reportes/pending/").json()["reportes"][0]
        self.assertEqual(p["creado_por"]["email"], "ana@x.co")
        self.assertEqual(p["creado_por"]["username"], "Ana")
        self.assertEqual(p["creado_por"]["telefono"], "+573001112233")
        self.assertEqual(p["estado"], "pendiente")
        self.assertEqual(len(c.get("/admin/api/reportes/validated/").json()["reportes"]), 1)

    def test_validar_rechazar_eliminar_y_notificacion_al_autor(self):
        r1 = self.crear_reporte(self.ana, "pendiente")
        r2 = self.crear_reporte(self.ana, "pendiente")
        c = self.cliente(self.admin)
        self.assertEqual(self.post(c, f"/admin/api/reportes/{r1.id}/validar/").status_code, 200)
        self.assertEqual(self.post(c, f"/admin/api/reportes/{r2.id}/rechazar/").status_code, 200)
        r1.refresh_from_db(); r2.refresh_from_db()
        self.assertEqual((r1.estado, r1.revisado_por), ("validado", self.admin))
        self.assertEqual(r2.estado, "rechazado")
        self.assertEqual(self.ana.notificaciones.count(), 2)
        self.assertEqual(self.post(c, f"/admin/api/reportes/{r1.id}/eliminar/").status_code, 200)
        self.assertFalse(Reporte.objects.filter(pk=r1.id).exists())
        self.assertEqual(self.post(c, "/admin/api/reportes/9999/validar/").status_code, 404)

    def test_busqueda_y_detalle(self):
        r = self.crear_reporte(self.ana, "pendiente", descripcion="Ladrón en moto")
        self.crear_reporte(self.luis, "rechazado", tipo="hurto", descripcion="otra cosa")
        c = self.cliente(self.admin)
        self.assertEqual([x["id"] for x in c.get("/admin/api/reportes/search/?q=moto").json()["reportes"]], [r.id])
        self.assertEqual(len(c.get("/admin/api/reportes/search/?estado=rechazado").json()["reportes"]), 1)
        self.assertEqual(len(c.get("/admin/api/reportes/search/?q=ana@x.co").json()["reportes"]), 1)
        d = c.get(f"/admin/api/reportes/{r.id}/detail/").json()
        self.assertEqual(d["prioridad"], "alto")
        self.assertEqual(len(d["coordenadas"]), 2)

    def test_gestion_de_usuarios(self):
        c = self.cliente(self.admin)
        us = c.get("/admin/api/users/").json()["users"]
        self.assertEqual({"id", "username", "nombre", "email", "role"} <= set(us[0]), True)
        self.assertEqual(self.post(c, f"/admin/api/users/{self.luis.id}/set-role/", {"role": "moderator"}).status_code, 200)
        self.luis.refresh_from_db()
        self.assertEqual(self.luis.rol, "moderator")
        self.assertEqual(self.post(c, f"/admin/api/users/{self.luis.id}/set-role/", {"role": "root"}).status_code, 400)
        # no puede quitarse el rol siendo el único admin ni eliminarse
        self.assertEqual(self.post(c, f"/admin/api/users/{self.admin.id}/set-role/", {"role": "user"}).status_code, 400)
        self.assertEqual(self.post(c, f"/admin/api/users/{self.admin.id}/delete/").status_code, 400)
        self.assertEqual(self.post(c, f"/admin/api/users/{self.luis.id}/delete/").status_code, 200)
        self.assertFalse(Usuario.objects.filter(pk=self.luis.id).exists())

    def test_comunicado_y_notificaciones(self):
        c = self.cliente(self.admin)
        r = self.post(c, "/api/comunicado/create/", {"title": "Aviso", "body": "Mantenimiento esta noche"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.post(c, "/api/comunicado/create/", {"title": "", "body": ""}).status_code, 400)
        self.assertEqual(self.post(self.cliente(self.ana), "/api/comunicado/create/", {"title": "x", "body": "y"}).status_code, 403)
        self.assertEqual(c.get("/admin/api/counts/").json()["comunicados_recientes"], 1)

        ana = self.cliente(self.ana)
        lista = ana.get("/api/notificaciones/").json()["notificaciones"]
        self.assertEqual((len(lista), lista[0]["titulo"], lista[0]["leida"]), (1, "Aviso", False))
        nid = lista[0]["id"]
        self.assertEqual(self.post(ana, f"/api/notificaciones/{nid}/leer/").status_code, 200)
        det = ana.get(f"/api/notificaciones/{nid}/detail/").json()
        self.assertEqual(det["cuerpo"], "Mantenimiento esta noche")
        self.assertTrue(ana.get("/api/notificaciones/").json()["notificaciones"][0]["leida"])
        # nadie más puede leer/abrir la notificación ajena
        luis = self.cliente(self.luis)
        self.assertEqual(luis.get(f"/api/notificaciones/{nid}/detail/").status_code, 404)
        self.assertIn(self.cliente().get("/api/notificaciones/").status_code, (401, 403))

    def test_admin_de_django_sigue_accesible(self):
        self.assertEqual(self.client.get("/admin/login/").status_code, 200)
