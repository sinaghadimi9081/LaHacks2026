#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${VENV_DIR:-.venv}"
RUN_SERVER=true
FRESH_DB=false

for arg in "$@"; do
  case "$arg" in
    --no-run)
      RUN_SERVER=false
      ;;
    --fresh)
      FRESH_DB=true
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--no-run] [--fresh]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if [[ "$FRESH_DB" == true ]]; then
  echo "--fresh: removing db.sqlite3 and any auto-generated migration files."
  rm -f db.sqlite3
  find users households core posts receipts lockers \
    -path "*/migrations/*.py" -not -name "__init__.py" -delete 2>/dev/null || true
  find users households core posts receipts lockers \
    -path "*/migrations/*.pyc" -delete 2>/dev/null || true
fi

python scripts/rename_receipts_app.py
python manage.py makemigrations users households core posts receipts lockers
python manage.py migrate
python manage.py seed_lockers_demo

echo "Backend dependencies are installed and migrations are up to date."
echo "Use 'source $VENV_DIR/bin/activate' if you want the virtualenv in your shell."

if [[ "$RUN_SERVER" == true ]]; then
  exec python manage.py runserver
fi
