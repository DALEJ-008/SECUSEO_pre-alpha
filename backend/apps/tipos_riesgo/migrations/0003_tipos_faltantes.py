"""Agrega al catálogo los tipos que el formulario ofrece pero no existían en la BD.

Sin estos, un reporte de "Agresiones físicas" o "Extorsión" se guardaba como "otro"
(riesgo bajo) y su marcador salía verde.
"""
from django.db import migrations

TIPOS = [
    # codigo, nombre, nivel, peso
    ("agresiones_fisicas", "Agresiones físicas", "alto", 3.0),
    ("extorsion", "Extorsión", "alto", 3.0),
]


def cargar(apps, schema_editor):
    TipoRiesgo = apps.get_model("tipos_riesgo", "TipoRiesgo")
    for codigo, nombre, nivel, peso in TIPOS:
        TipoRiesgo.objects.update_or_create(codigo=codigo, defaults={"nombre": nombre, "nivel": nivel, "peso": peso})


class Migration(migrations.Migration):
    dependencies = [("tipos_riesgo", "0002_datos_iniciales")]
    operations = [migrations.RunPython(cargar, migrations.RunPython.noop)]
