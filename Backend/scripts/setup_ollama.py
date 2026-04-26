#!/usr/bin/env python3
"""Bootstrap and verify local Ollama + Gemma 2 for NeighborFridge."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

import requests
try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - local fallback for bare Python
    load_dotenv = None


REPO_BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = REPO_BACKEND_DIR / ".env"
DEFAULT_URL = "http://localhost:11434"
DEFAULT_MODEL = "gemma2"


def info(message: str) -> None:
    print(f"· {message}")


def fail(message: str, exit_code: int = 1) -> int:
    print(f"✗ {message}")
    return exit_code


def success(message: str) -> None:
    print(f"✓ {message}")


def docs_url() -> str:
    if sys.platform == "darwin":
        return "https://docs.ollama.com/macos"
    if os.name == "nt":
        return "https://docs.ollama.com/windows"
    return "https://docs.ollama.com/linux"


def load_settings() -> tuple[str, str]:
    if load_dotenv is not None:
        load_dotenv(ENV_FILE, override=False)
    elif ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
    base_url = os.getenv("OLLAMA_URL", DEFAULT_URL).strip() or DEFAULT_URL
    model = os.getenv("OLLAMA_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    return base_url, model


def ollama_binary() -> str | None:
    return shutil.which("ollama")


def fetch_tags(base_url: str) -> tuple[bool, list[str], str | None]:
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=3)
        response.raise_for_status()
    except requests.RequestException as exc:
        return False, [], str(exc)

    payload = response.json()
    names: list[str] = []
    for model in payload.get("models", []):
        name = (model.get("name") or model.get("model") or "").strip()
        if name:
            names.append(name)
    return True, names, None


def model_present(installed_models: list[str], desired_model: str) -> bool:
    desired = desired_model.strip()
    normalized = {name.strip() for name in installed_models}
    if desired in normalized:
        return True
    if ":" not in desired and f"{desired}:latest" in normalized:
        return True
    return False


def pull_model(model: str) -> int:
    binary = ollama_binary()
    if not binary:
        return fail(
            "Ollama CLI was not found. Install Ollama first, then rerun this script.\n"
            f"  Docs: {docs_url()}"
        )

    info(f"Pulling Ollama model '{model}'...")
    try:
        subprocess.run([binary, "pull", model], check=True)
    except subprocess.CalledProcessError as exc:
        return fail(f"`ollama pull {model}` failed with exit code {exc.returncode}.")

    success(f"Model '{model}' is installed.")
    return 0


def print_server_help(base_url: str) -> None:
    if sys.platform == "darwin":
        info("Start the Ollama app, wait for the menu-bar icon, then rerun this script.")
    elif os.name == "nt":
        info("Launch Ollama from the Start menu, then rerun this script.")
    else:
        info("Run `ollama serve` in another terminal, then rerun this script.")
    info(f"NeighborFridge expects the Ollama API at {base_url}.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify and optionally install the Ollama model used by NeighborFridge."
    )
    parser.add_argument("--pull", action="store_true", help="Run `ollama pull` for the configured model.")
    parser.add_argument("--url", help="Override OLLAMA_URL for this check.")
    parser.add_argument("--model", help="Override OLLAMA_MODEL for this check.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env_url, env_model = load_settings()
    base_url = (args.url or env_url).strip() or DEFAULT_URL
    model = (args.model or env_model).strip() or DEFAULT_MODEL

    info(f"Configured Ollama URL: {base_url}")
    info(f"Configured Ollama model: {model}")

    binary = ollama_binary()
    if binary:
        success(f"Ollama CLI found at {binary}")
    else:
        info("Ollama CLI not found on PATH.")
        info(f"Install Ollama first: {docs_url()}")

    if args.pull:
        pull_status = pull_model(model)
        if pull_status != 0:
            return pull_status

    healthy, installed_models, error = fetch_tags(base_url)
    if not healthy:
        if binary:
            return fail(
                f"Ollama is installed, but the API is not reachable at {base_url}: {error}"
            )
        return fail(
            "Ollama is not installed yet.\n"
            f"  Install docs: {docs_url()}\n"
            f"  After install, rerun: python scripts/setup_ollama.py --pull --model {model}"
        )

    success(f"Ollama API is reachable at {base_url}")

    if installed_models:
        info(f"Installed models: {', '.join(installed_models)}")
    else:
        info("Ollama is running, but no models are installed yet.")

    if model_present(installed_models, model):
        success(f"NeighborFridge can use '{model}' right now.")
        return 0

    if args.pull:
        return fail(
            f"Ollama is running, but model '{model}' still does not appear in `/api/tags`."
        )

    info(f"NeighborFridge still needs the '{model}' model.")
    info(f"Run: python scripts/setup_ollama.py --pull --model {model}")
    info("If your laptop is weak on RAM/storage, use `OLLAMA_MODEL=gemma2:2b` in `.env`.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
