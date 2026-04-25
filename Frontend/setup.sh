#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RUN_SERVER=true

if [[ "${1:-}" == "--no-run" ]]; then
  RUN_SERVER=false
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

npm install

echo "Frontend dependencies are installed."

if [[ "$RUN_SERVER" == true ]]; then
  exec npm run dev -- --host 0.0.0.0
fi
