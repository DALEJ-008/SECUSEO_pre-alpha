"""Carga los barrios de Funza desde el GeoJSON del frontend.

Uso:  python manage.py cargar_zonas [ruta_al_geojson]
Es idempotente: actualiza por nombre.
"""
import json
from pathlib import Path

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand, CommandError

from apps.zonas.models import Zona

RUTA_POR_DEFECTO = Path(settings.BASE_DIR).parent / "public" / "Recursos" / "Barrios_Funza.geojson"


def _texto(valor):
    """Repara texto UTF-8 mal decodificado como latin-1 (p. ej. 'AcciÃ³n')."""
    if not isinstance(valor, str):
        return valor
    try:
        return valor.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return valor


class Command(BaseCommand):
    help = "Carga/actualiza las zonas (barrios) desde Barrios_Funza.geojson"

    def add_arguments(self, parser):
        parser.add_argument("ruta", nargs="?", default=str(RUTA_POR_DEFECTO))

    def handle(self, *args, **opts):
        ruta = Path(opts["ruta"])
        if not ruta.exists():
            raise CommandError(f"No existe el archivo: {ruta}")
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        # Hay barrios repartidos en varios polígonos con el mismo nombre: se unen en un MultiPolygon.
        por_nombre = {}
        for f in datos.get("features", []):
            props = f.get("properties") or {}
            nombre = _texto(props.get("NOMBRE") or props.get("nombre") or props.get("BARRIO"))
            if not nombre:
                continue
            geom = GEOSGeometry(json.dumps(f["geometry"]), srid=4326)
            poligonos = list(geom) if geom.geom_type == "MultiPolygon" else [geom]
            entrada = por_nombre.setdefault(
                str(nombre).strip(), {"poligonos": [], "codigo": None, "cuadrante": props.get("Cuadrante")}
            )
            entrada["poligonos"].extend(poligonos)
            entrada["codigo"] = entrada["codigo"] or props.get("CODBAR") or None

        creadas = actualizadas = 0
        for nombre, e in por_nombre.items():
            _, nueva = Zona.objects.update_or_create(
                nombre=nombre,
                defaults={
                    "codigo_barrio": e["codigo"],
                    "cuadrante": e["cuadrante"],
                    "geometria": MultiPolygon(*e["poligonos"], srid=4326),
                },
            )
            creadas += nueva
            actualizadas += not nueva
        self.stdout.write(self.style.SUCCESS(f"Zonas: {creadas} creadas, {actualizadas} actualizadas."))
