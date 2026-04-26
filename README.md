# NeighborFridge

NeighborFridge is a full-stack food rescue MVP for households and nearby neighbors. It helps users turn grocery receipts into pantry inventory, flag items that need attention, share surplus food locally, coordinate pickup or locker handoff, and measure the financial and environmental impact of preventing waste.

## What the project does

- **Pantry dashboard**: track groceries, quantities, expiration dates, value at risk, and active share listings.
- **Receipt ingestion**: upload a grocery receipt, run OCR, review parsed items, and confirm them into pantry inventory.
- **Neighborhood marketplace**: post extra food, browse nearby listings, request pickup or simulated delivery, and unlock exact pickup details after approval.
- **Household collaboration**: manage a shared household, send invitations, and coordinate through an inbox tied to approved requests.
- **Smart lockers**: use a proof-of-concept locker flow with credits, site selection, reservation, dropoff, and pickup codes.
- **Impact tracking**: view dollars saved, items rescued, CO₂ avoided, items shared, and a household leaderboard.

## Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- React DnD
- React Leaflet / Leaflet
- React Toastify

### Backend

- Django 5
- Django REST Framework
- SQLite
- JWT auth in HTTP-only cookies
- `django-cors-headers`

### OCR and enrichment

- Local OCR with Tesseract via `pytesseract`
- Optional Veryfi receipt OCR provider
- Local item enrichment pipeline:
  1. `ExpirationKnowledge` cache
  2. local fuzzy grocery matching
  3. optional Ollama + `gemma2`

## Architecture at a glance

1. A user uploads a receipt through the React app.
2. Django processes the image with local OCR or Veryfi.
3. Parsed receipt items are enriched with names, categories, prices, and estimated shelf life.
4. The user confirms the parsed items into pantry inventory.
5. Pantry items can be monitored, shared in the marketplace, or routed through lockers.
6. Rescue and sharing activity feeds the impact dashboard and notifications.

The frontend proxies `/api` and `/media` requests to Django during development, so the app runs as two local processes:

- `Frontend/` on `http://127.0.0.1:5173`
- `Backend/` on `http://127.0.0.1:8000`

## Repository layout

```text
.
├── Backend/   Django API, models, auth, OCR, marketplace, lockers
├── Frontend/  React + Vite client
└── docs/      API reference and system documentation
```

Key areas:

- `Backend/backend/` — Django settings and root URL config
- `Backend/core/` — pantry items, impact, notifications
- `Backend/receipts/` — receipt upload, OCR, confirmation flow
- `Backend/posts/` — marketplace posts, claims, messaging, notifications
- `Backend/households/` — household membership and invitations
- `Backend/lockers/` — locker sites, listings, reserve/dropoff/pickup flow
- `Backend/users/` — auth and user profile APIs
- `Frontend/src/Features/` — user-facing screens by product area

## Local development

### Prerequisites

- Python 3
- Node.js and npm
- Tesseract OCR if you want local receipt parsing
- Optional: Ollama if you want local LLM enrichment
- Optional: Veryfi credentials if you want cloud receipt OCR

### 1) Start the backend

macOS / Linux:

```bash
cd Backend
./setup.sh
```

Windows PowerShell:

```powershell
cd Backend
.\setup.ps1
```

What the backend setup script does:

- creates `.venv` if needed
- installs Python dependencies
- copies `.env.example` to `.env` if missing
- applies migrations
- checks for Tesseract
- optionally installs or configures Ollama

If you want setup without immediately starting Django:

```bash
cd Backend
./setup.sh --no-run
source .venv/bin/activate
python manage.py runserver
```

### 2) Start the frontend

```bash
cd Frontend
cp .env.example .env
npm install
npm run dev
```

Then open `http://127.0.0.1:5173`.

## Configuration

### Frontend

`Frontend/.env.example` uses:

```env
VITE_API_BASE_URL=/api
```

That works with the Vite dev proxy defined in `Frontend/vite.config.js`.

### Backend

Important settings live in `Backend/.env.example`:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `RECEIPT_PROCESSING_PROVIDER=auto|veryfi|local`
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `VERYFI_CLIENT_ID`
- `VERYFI_CLIENT_SECRET`
- `VERYFI_USERNAME`
- `VERYFI_API_KEY`
- `EMAIL_BACKEND`

Default local behavior is developer-friendly:

- SQLite database
- console email backend
- cookie-based JWT auth
- local Vite ↔ Django integration

## Demo workflows

### Seed demo data

Start Django first, then run:

```bash
cd Backend
source .venv/bin/activate
python scripts/seed_demo_data.py --reset
```

This script seeds demo users, marketplace posts, claims, and fake grocery receipts that go through the normal OCR flow.

### Seed near-expiration demo data

```bash
cd Backend
source .venv/bin/activate
python scripts/seed_demo_data_2.py --reset
```

This variant biases pantry items toward expiring today, tomorrow, and in three days, then runs `manage.py check_expirations` so notification behavior is visible immediately.

## Useful commands

### Backend

```bash
cd Backend
source .venv/bin/activate
python manage.py runserver
python manage.py migrate
python manage.py createsuperuser
python manage.py test
python manage.py check_expirations
```

### Frontend

```bash
cd Frontend
npm run dev
npm run build
npm run lint
```

## API and docs

- `docs/api.md` — API reference
- `docs/data_pipelines.md` — receipt, pantry, sharing, and impact flows
- `docs/expiration_methodology.md` — shelf-life estimation pipeline
- `docs/notification_setup.md` — notification and email configuration
- `Backend/docs/backend_architecture.md` — backend architecture overview
- `Backend/docs/database_troubleshooting.md` — migration and SQLite troubleshooting
- `Backend/README.md` — backend-focused setup notes

## Notes on current scope

- The locker system is a proof-of-concept experience backed by demo-oriented flows.
- Marketplace delivery is simulated; the backend returns a quote, but no real courier integration exists.
- The project is structured like a hackathon MVP: strong end-to-end flows, pragmatic defaults, and room for production hardening.
