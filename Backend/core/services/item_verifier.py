from core.models import ExpirationKnowledge
from core.services.enrichment import ollama_enrich
from core.services.grocery_db import CATEGORY_DEFAULTS
from core.services.matching import build_standardized_name, fuzzy_match_db, guess_category


def _enrich_single_item(item: dict) -> dict:
    raw_name = item.get("name", "")
    match = fuzzy_match_db(raw_name)

    if match:
        std_name, category, exp_days, description = match
        item["standardized_name"] = std_name
        item["category_tag"] = category
        item["expiration_days"] = exp_days
        item["description"] = description
    else:
        item["standardized_name"] = build_standardized_name(raw_name)
        item["category_tag"] = guess_category(raw_name)
        item["expiration_days"] = CATEGORY_DEFAULTS.get(item["category_tag"], 7)
        item["description"] = ""

    item["image_url"] = ""
    return item


def verify_and_enrich_items(raw_items: list[dict], store_name: str = "") -> list[dict]:
    if not raw_items:
        return []

    enriched_items = []
    items_to_verify = []

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

    matched_locally = []
    unmatched = []

    for item in items_to_verify:
        match = fuzzy_match_db(item.get("name", ""))
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

    if unmatched:
        ollama_result = ollama_enrich(unmatched)
        if ollama_result:
            enriched_items.extend(ollama_result)
        else:
            for item in unmatched:
                enriched_items.append(_enrich_single_item(item))

    for item in enriched_items:
        if item in items_to_verify:
            try:
                ExpirationKnowledge.objects.get_or_create(
                    food_name=item["standardized_name"],
                    defaults={
                        "category_tag": item["category_tag"],
                        "expiration_days": item["expiration_days"],
                        "price": float(item.get("estimated_price") or 0.0),
                        "description": item.get("description", ""),
                        "image_url": item.get("image_url", ""),
                    },
                )
            except Exception:
                pass

    return enriched_items
