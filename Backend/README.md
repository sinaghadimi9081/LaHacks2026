# Backend

Main Django project configuration lives in [`backend/`](./backend).

## Setup

macOS / Linux:

```bash
./setup.sh
```

Windows PowerShell:

```powershell
.\setup.ps1
```

Windows Command Prompt:

```bat
setup.cmd
```

Install dependencies without starting the server:

```bash
./setup.sh --no-run
```

## Common Django Commands

Run the development server:

```bash
python manage.py runserver
```

Create a superuser:

```bash
python manage.py createsuperuser
```

Apply migrations:

```bash
python manage.py migrate
```

Create new migrations:

```bash
python manage.py makemigrations
```

Create a new app:

```bash
python manage.py startapp Users
```

Run tests:

```bash
python manage.py test
```

Open the Django shell:

```bash
python manage.py shell
```

Collect static files:

```bash
python manage.py collectstatic
```

## Auth Endpoints

Bootstrap CSRF for cookie-authenticated requests:

```bash
GET /api/auth/csrf/
```

Auth:

```bash
POST /api/auth/signup/
POST /api/auth/login/
POST /api/auth/logout/
POST /api/auth/refresh/
GET  /api/auth/me/
```

User and household profile:

```bash
GET   /api/users/me/
PATCH /api/users/me/
GET   /api/households/me/
PATCH /api/households/me/
```

## Notes

- **Troubleshooting Database/Migrations**: See [`docs/database_troubleshooting.md`](./docs/database_troubleshooting.md) for how to fix DB errors or safely reset your SQLite database.
- Add new apps beside `backend/`, for example `Users/`, `app1/`, and `app2/`.
- After creating an app, add it to `INSTALLED_APPS` in [`backend/settings.py`](./backend/settings.py).
- Cookie auth uses HttpOnly JWT cookies. For `PATCH`, `POST`, and `DELETE` requests from the frontend, send the CSRF token returned by `/api/auth/csrf/`, `/api/auth/login/`, or `/api/auth/me/`.
