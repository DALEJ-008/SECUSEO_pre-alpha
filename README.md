# SECUSEO — Plataforma Colaborativa de Seguridad Ciudadana

**SECUSEO** es una aplicación web de reportes colaborativos de seguridad ciudadana desarrollada para el municipio de Funza (Cundinamarca, Colombia). Permite a los ciudadanos reportar zonas peligrosas georreferenciadas y visualizar en un mapa interactivo el nivel de riesgo de cada barrio a partir de incidentes validados por la administración.

---

## Tecnologías Utilizadas

### **Frontend**
- **React 19** + **Vite 8** (Single Page Application - SPA)
- **React Router DOM 7** (Enrutamiento)
- **Leaflet 1.9** (Mapas interactivos y geoprocesamiento de GeoJSON)
- **Tailwind CSS 3** (Estilos utilitarios)

### **Backend**
- **Python 3.12+** + **Django 6.1**
- **Django REST Framework (DRF)** (API REST)
- **GeoDjango** (`django.contrib.gis`) + **GDAL / GEOS**
- **PostgreSQL** con extensión **PostGIS** (Base de datos espacial)

---

## Requisitos del Sistema
Python: >= 3.12   
Node.js: Compatible con Vite 8 / React 19 y npm   
Base de datos: PostgreSQL con extensión PostGIS instalada   
Librerías nativas GIS: GDAL 3.13+ y GEOS 3.14+ (requeridas por GeoDjango)   

---
## Guía de Instalación y Configuración

### Configuración del Backend (Django + PostGIS)
1. Ingresa al directorio del backend y crea un entorno virtual:
   ```bash
    cd backend
    python -m venv venv
    .\venv\Scripts\activate
   
2. Instala las dependencias del proyecto:
   ```bash
     pip install -r requirements.txt
     pip install Pillow
   
3. Crea y configura el archivo de variables de entorno .env copiando el ejemplo:
   ```bash
     Copy-Item .env.example .env
   
4. Ajusta las credenciales de la base de datos en .env:
   ```bash
      DJANGO_DEBUG= true
      DJANGO_SECRET_KEY= tu_clave_secreta
      DB_NAME= SECUSEO
      DB_USER= postgres
      DB_PASSWORD= tu_contraseña
      DB_HOST= 127.0.0.1
      DB_PORT= 5432
   
      En Windows (si usas Conda para GDAL/GEOS):
      GIS_DLL_DIRECTORY=C:\ruta_absoluta\backend\gis-runtime\Library\bin
  
5. Crea la base de datos en PostgreSQL y habilita la extensión PostGIS:
   ```bash
      CREATE DATABASE SECUSEO;
      \c SECUSEO;
      CREATE EXTENSION postgis;
  
6. Aplica las migraciones e importa los barrios de Funza desde el GeoJSON:
   ```bash
      python manage.py migrate
      python manage.py cargar_zonas
  
7. Crea el usuario administrador inicial:
   ```bash
      python manage.py createsuperuser
  
8. Inicia el servidor de desarrollo del backend:
   ```bash
      python manage.py runserver

El backend estará disponible en http://127.0.0.1:8000/.


### Configuración del Frontend (React + Vite)
1. Desde la raíz del proyecto, instala las dependencias de Node.js:
   ```bash
      npm install
2. Inicia el servidor de desarrollo:
   ```bash
      npm run dev

El frontend iniciará en http://localhost:5173/ y redirigirá las peticiones de API al servidor backend.
