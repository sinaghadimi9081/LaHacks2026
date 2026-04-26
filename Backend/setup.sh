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
python scripts/install_python_certificates.py || \
  echo "Warning: Python certificate bootstrap failed. SMTP over TLS may fail until certs are configured."

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if [[ "$FRESH_DB" == true ]]; then
  echo "--fresh: removing db.sqlite3 and any auto-generated migration files."
  rm -f db.sqlite3
  find users households core posts receipts \
    -path "*/migrations/*.py" -not -name "__init__.py" -delete 2>/dev/null || true
  find users households core posts receipts \
    -path "*/migrations/*.pyc" -delete 2>/dev/null || true
fi

python scripts/rename_receipts_app.py
python manage.py makemigrations users households core posts receipts
ensure_tesseract() {
  if command -v tesseract >/dev/null 2>&1; then
    echo "tesseract already installed: $(tesseract --version 2>&1 | head -n 1)"
    return 0
  fi

  echo "tesseract not found — required by pytesseract for local receipt OCR."
  case "$(uname -s)" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Installing tesseract via Homebrew..."
        brew install tesseract || \
          echo "Warning: 'brew install tesseract' failed. Install it manually before running the seed script."
      else
        echo "Warning: Homebrew not found. Install Homebrew (https://brew.sh) and then run:"
        echo "  brew install tesseract"
      fi
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        echo "Installing tesseract via apt-get (sudo)..."
        sudo apt-get update && sudo apt-get install -y tesseract-ocr || \
          echo "Warning: apt-get install failed. Install tesseract-ocr manually."
      elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y tesseract || echo "Warning: dnf install failed."
      elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y tesseract || echo "Warning: yum install failed."
      elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -S --noconfirm tesseract || echo "Warning: pacman install failed."
      else
        echo "Warning: no known Linux package manager found. Install tesseract manually."
      fi
      ;;
    *)
      echo "Warning: unknown OS '$(uname -s)'. Install tesseract manually for receipt OCR."
      ;;
  esac
}

ensure_tesseract

python manage.py migrate

echo "Backend dependencies are installed and migrations are up to date."
echo "Use 'source $VENV_DIR/bin/activate' if you want the virtualenv in your shell."

if [[ "$RUN_SERVER" == true ]]; then
  exec python manage.py runserver
fi
