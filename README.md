# LabDesk — Proyecto práctico Django + React

Sistema CRUD de incidencias del laboratorio (actividad de clase).

Incluye búsqueda, filtros y orden, exportación Excel `.xlsx`, paginación, asignación
de responsable, aula/equipo, fecha límite, historial y cuentas con permisos por rol.

## 1. Backend (terminal A)

Requisitos: Python 3.10+ y pip disponibles.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py loaddata incidencias
python manage.py runserver
```

API: http://127.0.0.1:8000/api/

El administrador inicia sesión con la cuenta creada y puede dar de alta usuarios
en Django Admin (`/admin/`). Asigna el grupo `LabDesk soporte` para acceso de
soporte; un usuario sin grupo tiene el rol de solicitante. El grupo
`LabDesk administradores` permite administrar incidencias; la cuenta superusuario
también tiene ese permiso.

`loaddata` carga cinco incidencias de ejemplo para probar el panel. Si prefieres
empezar con una base vacía, omite ese comando. Los registros antiguos sin creador
solo son visibles para soporte y administración.

## 2. Frontend (terminal B)

Requisitos: Node.js compatible con Vite 7 y npm.

```powershell
cd frontend
npm install
npm run dev
```

Web: http://127.0.0.1:5173/
Si la API está en otra dirección, define `VITE_API_URL` (ver `frontend/.env.example`).
El frontend usa cookies de sesión y CSRF; no almacena credenciales ni tokens en el navegador.

## 3. Roles y seguimiento

Los solicitantes solo ven y actualizan incidencias propias, y pueden añadir
comentarios. Soporte puede consultar y actualizar todas, pero no eliminarlas.
Administración puede gestionar cualquier incidencia. El historial registra la
cuenta autenticada, no un nombre editable por el navegador. El acceso a la API
requiere sesión.

## 4. Pruebas
Pruebas automatizadas:

```bash
# Desde backend/
python manage.py test incidencias

# Desde frontend/
npm test
npm run build
```

## 5. Producción y HTTPS

No uses la configuración local en producción. Configura las variables de entorno
del servidor según `backend/.env.example`: una `DJANGO_SECRET_KEY` nueva, `DJANGO_DEBUG=False`,
`DJANGO_ALLOWED_HOSTS`, `DATABASE_URL` y los orígenes HTTPS exactos para CORS y CSRF.
La base PostgreSQL necesita una conexión TLS apropiada para tu proveedor.

Termina HTTPS en un proxy o plataforma con un certificado válido y configura
`DJANGO_BEHIND_PROXY=True` solo si el proxy establece `X-Forwarded-Proto: https`.
La redirección HTTPS, las cookies seguras y HSTS se activan en producción. Sirve
el frontend también por HTTPS y limita el acceso a Django Admin. La app no provisiona
un dominio ni un certificado: deben configurarse en el entorno de despliegue.
