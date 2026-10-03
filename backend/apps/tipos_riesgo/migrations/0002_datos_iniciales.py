"""Catálogo inicial de tipos de riesgo (mismos códigos que src/lib/services/tipos.js)."""
from django.db import migrations

TIPOS = [
    # codigo, nombre, nivel, peso
    ("robo", "Robo", "alto", 3.0),
    ("asalto", "Asalto", "alto", 3.5),
    ("hurto", "Hurto", "medio", 1.8),
    ("vandalismo", "Vandalismo", "medio", 1.5),
    ("iluminacion", "Poca iluminación", "bajo", 0.8),
    ("accidente", "Accidente de Tránsito", "medio", 1.2),
    ("violencia", "Violencia", "alto", 3.5),
    ("consumo_drogas", "Consumo/venta de drogas", "medio", 2.2),
    ("incendio", "Incendio", "alto", 3.5),
    ("amenaza", "Amenaza", "alto", 2.5),
    ("otro", "Otro", "bajo", 1.0),
    ("robo_vehiculo", "Robo de vehículos", "alto", 3.0),
    ("acoso_callejero", "Acoso callejero", "medio", 2.0),
    ("prostitucion_ilegal", "Prostitución ilegal", "medio", 2.0),
    ("fraude_estafa", "Fraudes y estafas", "medio", 1.5),
]


def cargar(apps, schema_editor):
    TipoRiesgo = apps.get_model("tipos_riesgo", "TipoRiesgo")
    for codigo, nombre, nivel, peso in TIPOS:
        TipoRiesgo.objects.update_or_create(codigo=codigo, defaults={"nombre": nombre, "nivel": nivel, "peso": peso})


class Migration(migrations.Migration):
    dependencies = [("tipos_riesgo", "0001_initial")]
    operations = [migrations.RunPython(cargar, migrations.RunPython.noop)]
