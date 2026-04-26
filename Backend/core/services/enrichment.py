import json
import os
import re

import requests

from core.services.grocery_db import CATEGORY_DEFAULTS
from core.services.matching import build_standardized_name, guess_category

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2")


def ollama_enrich(items: list[dict]) -> list[dict] | None:
    try:
        health = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        if health.status_code != 200:
            return None
    except Exception:
        return None

    names_list = [item.get("name", "") for item in items]
    prompt = (
        "You are a grocery item identifier. Given these abbreviated receipt item names, "
        "return a JSON array where each object has:\n"
        "- \"name\": the original receipt name (MUST match exactly)\n"
        "- \"standardized_name\": the full, human-readable product name\n"
        "- \"category_tag\": one of: produce, dairy, meat, bakery, pantry, frozen, beverage, condiment, deli\n"
        "- \"expiration_days\": estimated shelf life in days from purchase (integer)\n"
        "- \"description\": a short 1-sentence description\n\n"
        f"Receipt items: {json.dumps(names_list)}\n\n"
        "Return ONLY valid JSON array, no markdown, no explanation."
    )

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 1024},
            },
            timeout=30,
        )
        if resp.status_code != 200:
            return None

        raw_text = resp.json().get("response", "")
        json_match = re.search(r'\[.*\]', raw_text, re.DOTALL)
        if not json_match:
            return None

        result = json.loads(json_match.group())
        if not isinstance(result, list):
            return None

        enriched = []
        for i, item in enumerate(items):
            if i < len(result) and isinstance(result[i], dict):
                ai = result[i]
                item["standardized_name"] = ai.get("standardized_name") or build_standardized_name(item.get("name", ""))
                item["category_tag"] = ai.get("category_tag") or guess_category(item.get("name", ""))
                item["expiration_days"] = ai.get("expiration_days") or CATEGORY_DEFAULTS.get(item.get("category_tag", ""), 7)
                item["description"] = ai.get("description") or ""
            item["image_url"] = ""
            enriched.append(item)

        return enriched

    except Exception:
        return None
