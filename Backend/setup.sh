#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${VENV_DIR:-.venv}"
RUN_SERVER=true

if [[ "${1:-}" == "--no-run" ]]; then
  RUN_SERVER=false
fi

if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

python manage.py migrate

echo "Backend dependencies are installed and migrations are up to date."
echo "Use 'source $VENV_DIR/bin/activate' if you want the virtualenv in your shell."

if [[ "$RUN_SERVER" == true ]]; then
  exec python manage.py runserver
fi
