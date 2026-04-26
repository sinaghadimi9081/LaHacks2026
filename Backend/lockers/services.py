import secrets

from core.services.matching import guess_category


def generate_six_digit_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def required_storage_type_for_food_item(food_item):
    raw_category = (getattr(food_item, "category_tag", "") or "").strip().lower()
    if not raw_category:
        raw_category = guess_category(getattr(food_item, "name", "") or "")

    if raw_category == "frozen":
        return "frozen"
    if raw_category in {"dairy", "meat", "deli", "produce"}:
        return "refrigerated"
    return "dry"

