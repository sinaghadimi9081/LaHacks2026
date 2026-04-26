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

Enable local Ollama + Gemma 2 setup during backend bootstrap:

```bash
./setup.sh --with-ollama --no-run
```

Windows PowerShell:

```powershell
.\setup.ps1 --with-ollama -NoRun
```

## Ollama / Gemma 2

NeighborFridge uses local Ollama as an optional fallback for receipt item enrichment and inventory tips. The backend already expects:

- `OLLAMA_URL=http://localhost:11434`
- `OLLAMA_MODEL=gemma2`

That means yes: each teammate who wants local Gemma 2 needs Ollama installed on their own laptop.

Official install docs:

- macOS: [docs.ollama.com/macos](https://docs.ollama.com/macos)
- Windows: [docs.ollama.com/windows](https://docs.ollama.com/windows)
- Linux: [docs.ollama.com/linux](https://docs.ollama.com/linux)
- Gemma 2 model page: [ollama.com/library/gemma2](https://ollama.com/library/gemma2)

Fastest teammate flow:

```bash
cd Backend
./setup.sh --with-ollama --no-run
python scripts/setup_ollama.py
```

Or on Windows:

```powershell
cd Backend
.\setup.ps1 --with-ollama -NoRun
python scripts/setup_ollama.py
```

What the helper does:

- reads `OLLAMA_URL` and `OLLAMA_MODEL` from `.env`
- checks whether the `ollama` CLI is installed
- checks whether the Ollama server is reachable
- optionally runs `ollama pull <model>`

What `--with-ollama` now does:

- macOS: tries `brew install --cask ollama`, then launches the app
- Linux: tries Ollama's official install script, then starts `ollama serve`
- Windows PowerShell: tries `winget install Ollama.Ollama`, then launches the app

If automatic install fails, the scripts fall back to the official Ollama docs links above.

If a laptop cannot comfortably run the default 9B model, set this in `.env` before pulling:

```env
OLLAMA_MODEL=gemma2:2b
```

## Email Setup

NeighborFridge now defaults to Django's console email backend in local dev, so teammates can run the app without SMTP credentials.

If someone wants real email delivery locally:

1. Copy `Backend/.env.example` to `Backend/.env` if they do not already have one.
2. Set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`.
3. Set `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD`.
4. For Gmail, use a Google app password, not the normal account password.

The setup scripts install `certifi` and run [`scripts/install_python_certificates.py`](./scripts/install_python_certificates.py) as a best-effort fix for Python TLS certificate issues on local machines.

To test email after configuration:

```bash
python scripts/test_email.py your-email@example.com
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
