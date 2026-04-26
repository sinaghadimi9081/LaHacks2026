#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${VENV_DIR:-.venv}"
RUN_SERVER=true
FRESH_DB=false
WITH_OLLAMA=false

for arg in "$@"; do
  case "$arg" in
    --no-run)
      RUN_SERVER=false
      ;;
    --fresh)
      FRESH_DB=true
      ;;
    --with-ollama)
      WITH_OLLAMA=true
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--no-run] [--fresh] [--with-ollama]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

python -m pip install --disable-pip-version-check -r requirements.txt
python scripts/install_python_certificates.py || \
  echo "Warning: Python certificate bootstrap failed. SMTP over TLS may fail until certs are configured."

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if [[ "$FRESH_DB" == true ]]; then
  echo "--fresh: removing db.sqlite3 only."
  rm -f db.sqlite3
fi

python scripts/rename_receipts_app.py
ensure_ollama() {
  local ollama_installed=false

  wait_for_ollama_server() {
    local attempts="${1:-15}"
    local i
    for ((i = 1; i <= attempts; i++)); do
      if ollama list >/dev/null 2>&1; then
        echo "Ollama server is reachable."
        return 0
      fi
      sleep 1
    done
    return 1
  }

  if command -v ollama >/dev/null 2>&1; then
    ollama_installed=true
    echo "ollama already installed: $(ollama --version 2>/dev/null | head -n 1 || echo 'available')"
    if wait_for_ollama_server 2; then
      return 0
    fi
  fi

  if [[ "$ollama_installed" == false ]]; then
    echo "ollama not found."
  else
    echo "ollama is installed, but the server is not running yet."
  fi

  case "$(uname -s)" in
    Darwin)
      if [[ "$ollama_installed" == false ]] && command -v brew >/dev/null 2>&1; then
        echo "Installing Ollama via Homebrew..."
        brew install --cask ollama || {
          echo "Warning: 'brew install --cask ollama' failed." >&2
          echo "Install Ollama manually: https://docs.ollama.com/macos" >&2
          return 1
        }
      elif [[ "$ollama_installed" == false ]]; then
        echo "Warning: Homebrew not found." >&2
        echo "Install Ollama manually: https://docs.ollama.com/macos" >&2
        return 1
      fi
      if [[ -d "/Applications/Ollama.app" ]]; then
        echo "Launching Ollama..."
        open "/Applications/Ollama.app" || echo "Warning: failed to launch Ollama automatically."
        if ! wait_for_ollama_server 10; then
          echo "Falling back to 'ollama serve' in the background..."
          nohup ollama serve >/tmp/neighborfridge-ollama.log 2>&1 &
          wait_for_ollama_server 10 || {
            echo "Warning: Ollama still did not start. Start it manually from /Applications/Ollama.app." >&2
            return 1
          }
        fi
      fi
      ;;
    Linux)
      if [[ "$ollama_installed" == false ]] && command -v curl >/dev/null 2>&1; then
        echo "Installing Ollama via official install script..."
        curl -fsSL https://ollama.com/install.sh | sh || {
          echo "Warning: Ollama install script failed." >&2
          echo "Install Ollama manually: https://docs.ollama.com/linux" >&2
          return 1
        }
      elif [[ "$ollama_installed" == false ]]; then
        echo "Warning: curl not found." >&2
        echo "Install Ollama manually: https://docs.ollama.com/linux" >&2
        return 1
      fi
      if command -v ollama >/dev/null 2>&1; then
        if ! wait_for_ollama_server 2; then
          echo "Starting Ollama server in the background..."
          nohup ollama serve >/tmp/neighborfridge-ollama.log 2>&1 &
          wait_for_ollama_server 10 || {
            echo "Warning: Ollama server did not start automatically." >&2
            return 1
          }
        fi
      fi
      ;;
    *)
      echo "Warning: unsupported OS for automatic Ollama install." >&2
      echo "Install Ollama manually: https://docs.ollama.com/" >&2
      return 1
      ;;
  esac
}

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

echo "Using committed Django migrations from the repo."
echo "If you are actively changing models, run 'python manage.py makemigrations' manually."

if [[ "$WITH_OLLAMA" == true ]]; then
  ensure_ollama || \
    echo "Warning: Ollama install did not complete. Follow the official docs, then rerun setup_ollama.py."
  python scripts/setup_ollama.py --pull || \
    echo "Warning: Ollama setup did not complete. Local LLM enrichment will stay disabled until Ollama is installed and running."
else
  echo "Optional local LLM setup: run './setup.sh --with-ollama --no-run' or 'python scripts/setup_ollama.py --pull'."
fi

echo "Backend dependencies are installed and migrations are up to date."
echo "Use 'source $VENV_DIR/bin/activate' if you want the virtualenv in your shell."

if [[ "$RUN_SERVER" == true ]]; then
  exec python manage.py runserver
fi
