import os
import json
from django.conf import settings
from google import genai
from google.genai import types
from duckduckgo_search import DDGS
from core.models import ExpirationKnowledge

def verify_and_enrich_items(raw_items: list[dict]) -> list[dict]:
    """
    Takes a list of raw parsed receipt items (dicts), standardizes their names,
    estimates their categories and expiration dates using Gemini and DDG,
    and records the knowledge in ExpirationKnowledge.
    """
    if not raw_items:
        return []

    enriched_items = []
    items_to_verify = []

    # 1. Knowledge Base Check
    for item in raw_items:
        raw_name = item.get("name", "")
        try:
            # Check for an exact match in the knowledge base
            kb_match = ExpirationKnowledge.objects.filter(food_name__iexact=raw_name).first()
            if kb_match:
                item["standardized_name"] = kb_match.food_name
                item["category_tag"] = kb_match.category_tag
                item["expiration_days"] = kb_match.expiration_days
                enriched_items.append(item)
            else:
                items_to_verify.append(item)
        except Exception:
            items_to_verify.append(item)

    if not items_to_verify:
        return enriched_items

    # 2. Setup Gemini
    api_key = getattr(settings, "GEMINI_API_KEY", os.getenv("GEMINI_API_KEY"))
    if not api_key:
        # Fallback if no API key is provided
        for item in items_to_verify:
            item["standardized_name"] = item.get("name", "")
            item["category_tag"] = "unknown"
            item["expiration_days"] = 7
            enriched_items.append(item)
        return enriched_items

    client = genai.Client(api_key=api_key)

    # 3. DuckDuckGo Context Gathering
    # Only search for extremely short/ambiguous names to save time
    for item in items_to_verify:
        name = item.get("name", "")
        if len(name) < 6 and name.strip():
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(f"grocery item {name}", max_results=1))
                    if results:
                        item["ddg_context"] = results[0].get("title", "")
            except Exception:
                pass

    # 4. Gemini Processing
    prompt = (
        "You are an AI grocery assistant. I will provide a JSON array of raw receipt items. "
        "For each item, provide a 'standardized_name' (clear, capitalized food name), "
        "a 'category_tag' (e.g., 'dairy', 'produce', 'meat', 'pantry', 'frozen', 'bakery'), "
        "an 'expiration_days' integer (estimated shelf life in days from purchase), "
        "and an 'estimated_price' float (if you know it, otherwise keep the provided one or 0.00).\n\n"
        f"Input items:\n{json.dumps(items_to_verify)}\n\n"
        "Return a JSON array of objects strictly following this schema: "
        "[{'name': 'original raw name', 'standardized_name': '...', 'category_tag': '...', 'expiration_days': 14, 'estimated_price': 4.99}]"
    )

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        response_json = json.loads(response.text)
        result_map = {res.get("name"): res for res in response_json if isinstance(res, dict)}
        
        for item in items_to_verify:
            name = item.get("name")
            verified = result_map.get(name, {})
            
            item["standardized_name"] = verified.get("standardized_name", name)
            item["category_tag"] = verified.get("category_tag", "unknown")
            item["expiration_days"] = verified.get("expiration_days", 7)
            
            # If the OCR didn't catch a price but Gemini estimated one
            est_price = verified.get("estimated_price")
            if est_price is not None and (item.get("estimated_price") is None or float(item.get("estimated_price", 0)) == 0.0):
                item["estimated_price"] = str(est_price)
            
            item.pop("ddg_context", None)
            enriched_items.append(item)
            
            # 5. Knowledge Base Update
            try:
                ExpirationKnowledge.objects.get_or_create(
                    food_name=item["standardized_name"],
                    defaults={
                        "category_tag": item["category_tag"],
                        "expiration_days": item["expiration_days"],
                        "price": float(item.get("estimated_price") or 0.0)
                    }
                )
            except Exception:
                pass

    except Exception as e:
        print(f"Gemini Verification Error: {e}")
        # Fallback
        for item in items_to_verify:
            item["standardized_name"] = item.get("name", "")
            item["category_tag"] = "unknown"
            item["expiration_days"] = 7
            enriched_items.append(item)

    return enriched_items
