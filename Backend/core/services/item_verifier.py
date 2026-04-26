import os
import json
import re
import requests
from difflib import SequenceMatcher
from core.models import ExpirationKnowledge
from core.services.grocery_db import (
    GROCERY_DB, ABBREVIATION_MAP, CATEGORY_KEYWORDS,
    CATEGORY_DEFAULTS
)

# Ollama config
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2")


def _expand_abbreviations(raw_name: str) -> str:
    """Expand common receipt abbreviations to full words."""
    words = raw_name.upper().strip().split()
    expanded = []
    for word in words:
        cleaned = re.sub(r'^\d+', '', word)
        expanded.append(ABBREVIATION_MAP.get(cleaned, ABBREVIATION_MAP.get(word, word)))
    return " ".join(expanded)


def _fuzzy_match_db(raw_name: str) -> tuple | None:
    """
    Try to match raw_name against GROCERY_DB using:
    1. Exact match on raw name
    2. Exact match on expanded name
    3. Token-based matching (individual words)
    4. Fuzzy ratio matching
    """
    upper = raw_name.upper().strip()
    expanded = _expand_abbreviations(raw_name)

    # 1. Direct exact match
    if upper in GROCERY_DB:
        return GROCERY_DB[upper]

    # 2. Try expanded name exact match
    if expanded in GROCERY_DB:
        return GROCERY_DB[expanded]

    # 3. Token-based scoring: count how many meaningful tokens overlap
    best_score = 0.0
    best_match = None

    raw_tokens = set(upper.split())
    exp_tokens = set(expanded.split())
    # Remove noise tokens for matching
    noise = {"ORGANIC", "ORG", "LARGE", "LRG", "SMALL", "SM", "MEDIUM", "MD",
             "GALLON", "GAL", "POUND", "LB", "LBS", "OUNCE", "OZ", "PACK", "PK",
             "PKG", "COUNT", "CT", "QT", "PT", "XL", "EXTRA"}
    meaningful_raw = raw_tokens - noise
    meaningful_exp = exp_tokens - noise

    for db_key, db_value in GROCERY_DB.items():
        db_tokens = set(db_key.split())
        std_tokens = set(db_value[0].upper().split())

        # Token overlap scoring
        if meaningful_raw and db_tokens:
            raw_overlap = len(meaningful_raw & db_tokens) / max(len(meaningful_raw), len(db_tokens))
        else:
            raw_overlap = 0

        if meaningful_exp and std_tokens:
            exp_overlap = len(meaningful_exp & std_tokens) / max(len(meaningful_exp), len(std_tokens))
        else:
            exp_overlap = 0

        token_score = max(raw_overlap, exp_overlap)

        # Containment check
        if db_key in upper or upper in db_key:
            contain_score = 0.85
        elif db_key in expanded or expanded in db_key:
            contain_score = 0.80
        else:
            contain_score = 0

        # Fuzzy ratio
        fuzzy_score = max(
            SequenceMatcher(None, upper, db_key).ratio(),
            SequenceMatcher(None, expanded, db_key).ratio(),
            SequenceMatcher(None, expanded, db_value[0].upper()).ratio()
        )

        # Combined score: best of all methods
        score = max(token_score, contain_score, fuzzy_score)

        if score > best_score:
            best_score = score
            best_match = db_value

    if best_score >= 0.55:
        return best_match
    return None


def _guess_category(name: str) -> str:
    """Guess category from keywords in the expanded name."""
    expanded = _expand_abbreviations(name).lower()
    raw_lower = name.lower()
    text = f"{raw_lower} {expanded}"

    best_cat = "unknown"
    best_count = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text)
        if count > best_count:
            best_count = count
            best_cat = category

    return best_cat


def _build_standardized_name(raw_name: str) -> str:
    """Build a human-readable name from the expanded abbreviations."""
    expanded = _expand_abbreviations(raw_name)
    noise = {"GALLON", "QUART", "PINT", "OUNCE", "POUND", "POUNDS",
             "PACK", "PACKAGE", "COUNT", "SMALL", "MEDIUM", "EXTRA LARGE"}
    words = expanded.split()
    clean = [w for w in words if w not in noise and not re.match(r'^\d+$', w)]
    if not clean:
        clean = words
    return " ".join(w.capitalize() for w in clean)


def _ollama_enrich(items: list[dict]) -> list[dict] | None:
    """
    Use a local Ollama model to enrich items that couldn't be matched locally.
    Returns enriched items or None if Ollama is not available.
    """
    # Quick health check
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
                "options": {"temperature": 0.1, "num_predict": 1024}
            },
            timeout=30
        )
        if resp.status_code != 200:
            return None

        raw_text = resp.json().get("response", "")

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'\[.*\]', raw_text, re.DOTALL)
        if not json_match:
            return None

        result = json.loads(json_match.group())
        if not isinstance(result, list):
            return None

        # Map results back to items by index
        enriched = []
        for i, item in enumerate(items):
            if i < len(result) and isinstance(result[i], dict):
                ai = result[i]
                item["standardized_name"] = ai.get("standardized_name") or _build_standardized_name(item.get("name", ""))
                item["category_tag"] = ai.get("category_tag") or _guess_category(item.get("name", ""))
                item["expiration_days"] = ai.get("expiration_days") or CATEGORY_DEFAULTS.get(item.get("category_tag", ""), 7)
                item["description"] = ai.get("description") or ""
            item["image_url"] = ""
            enriched.append(item)

        return enriched

    except Exception:
        return None


def _enrich_single_item(item: dict) -> dict:
    """Enrich a single item using the local grocery database."""
    raw_name = item.get("name", "")

    match = _fuzzy_match_db(raw_name)

    if match:
        std_name, category, exp_days, description = match
        item["standardized_name"] = std_name
        item["category_tag"] = category
        item["expiration_days"] = exp_days
        item["description"] = description
    else:
        std_name = _build_standardized_name(raw_name)
        category = _guess_category(raw_name)
        item["standardized_name"] = std_name
        item["category_tag"] = category
        item["expiration_days"] = CATEGORY_DEFAULTS.get(category, 7)
        item["description"] = ""

    item["image_url"] = ""
    return item


def verify_and_enrich_items(raw_items: list[dict], store_name: str = "") -> list[dict]:
    """
    Takes a list of raw parsed receipt items (dicts), standardizes their names,
    estimates their categories and expiration dates.

    Pipeline:
    1. Check ExpirationKnowledge DB cache
    2. Local grocery DB fuzzy matching (instant, 150+ items)
    3. Ollama local LLM fallback (for unmatched items, no API key needed)

    Results are cached in ExpirationKnowledge for future lookups.
    """
    if not raw_items:
        return []

    enriched_items = []
    items_to_verify = []

    # 1. Knowledge Base Check (DB cache from previous enrichments)
    for item in raw_items:
        raw_name = item.get("name", "")
        try:
            kb_match = ExpirationKnowledge.objects.filter(food_name__iexact=raw_name).first()
            if kb_match:
                item["standardized_name"] = kb_match.food_name
                item["category_tag"] = kb_match.category_tag
                item["expiration_days"] = kb_match.expiration_days
                item["image_url"] = kb_match.image_url
                item["description"] = kb_match.description
                enriched_items.append(item)
            else:
                items_to_verify.append(item)
        except Exception:
            items_to_verify.append(item)

    if not items_to_verify:
        return enriched_items

    # 2. Local fuzzy matching
    matched_locally = []
    unmatched = []

    for item in items_to_verify:
        raw_name = item.get("name", "")
        match = _fuzzy_match_db(raw_name)
        if match:
            std_name, category, exp_days, description = match
            item["standardized_name"] = std_name
            item["category_tag"] = category
            item["expiration_days"] = exp_days
            item["description"] = description
            item["image_url"] = ""
            matched_locally.append(item)
        else:
            unmatched.append(item)

    enriched_items.extend(matched_locally)

    # 3. Ollama fallback for unmatched items
    if unmatched:
        ollama_result = _ollama_enrich(unmatched)
        if ollama_result:
            enriched_items.extend(ollama_result)
        else:
            # Final fallback: abbreviation expansion + category guessing
            for item in unmatched:
                _enrich_single_item(item)
                enriched_items.append(item)

    # 4. Cache all results in ExpirationKnowledge
    for item in enriched_items:
        if item in items_to_verify:  # Only cache newly enriched items
            try:
                ExpirationKnowledge.objects.get_or_create(
                    food_name=item["standardized_name"],
                    defaults={
                        "category_tag": item["category_tag"],
                        "expiration_days": item["expiration_days"],
                        "price": float(item.get("estimated_price") or 0.0),
                        "description": item.get("description", ""),
                        "image_url": item.get("image_url", "")
                    }
                )
            except Exception:
                pass

    return enriched_items
