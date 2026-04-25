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

## Notes

- Add new apps beside `backend/`, for example `Users/`, `app1/`, and `app2/`.
- After creating an app, add it to `INSTALLED_APPS` in [`backend/settings.py`](./backend/settings.py).
