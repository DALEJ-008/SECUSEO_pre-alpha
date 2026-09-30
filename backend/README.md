# Backend SECUSEO

## Preparar entorno

Desde `backend/`, instala las dependencias Python y configura `.env` a partir
de `.env.example`. Define `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` y
`DB_PORT` según tu instancia. El backend usa PostgreSQL con la extensión
PostGIS habilitada en la base de datos.

```powershell
python -m venv venv
Copy-Item .env.example .env
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

En Windows se requiere GDAL y GEOS para GeoDjango. Con Conda instalado, crea un
runtime local y establece `GIS_DLL_DIRECTORY` en `.env`:

```powershell
conda create --yes --prefix .\gis-runtime --channel conda-forge gdal
```

En `.env`, asigna `GIS_DLL_DIRECTORY` a la ruta absoluta
`backend/gis-runtime/Library/bin`. Esa carpeta debe contener `gdal.dll` y
`geos_c.dll`.

## Ejecutar y comprobar

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py runserver
```

Antes de iniciar el servidor, crea la base de datos indicada en `.env` y
habilita PostGIS con `CREATE EXTENSION postgis;`. La documentación OpenAPI
queda disponible en `http://127.0.0.1:8000/api/docs/`.