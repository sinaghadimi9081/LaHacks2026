import re
from difflib import SequenceMatcher

from core.services.grocery_db import ABBREVIATION_MAP, CATEGORY_KEYWORDS, GROCERY_DB

_NOISE_TOKENS = {
    "ORGANIC", "ORG", "LARGE", "LRG", "SMALL", "SM", "MEDIUM", "MD",
    "GALLON", "GAL", "POUND", "LB", "LBS", "OUNCE", "OZ", "PACK", "PK",
    "PKG", "COUNT", "CT", "QT", "PT", "XL", "EXTRA",
}


def expand_abbreviations(raw_name: str) -> str:
    words = raw_name.upper().strip().split()
    expanded = []
    for word in words:
        cleaned = re.sub(r'^\d+', '', word)
        expanded.append(ABBREVIATION_MAP.get(cleaned, ABBREVIATION_MAP.get(word, word)))
    return " ".join(expanded)


def fuzzy_match_db(raw_name: str) -> tuple | None:
    upper = raw_name.upper().strip()
    expanded = expand_abbreviations(raw_name)

    if upper in GROCERY_DB:
        return GROCERY_DB[upper]
    if expanded in GROCERY_DB:
        return GROCERY_DB[expanded]

    best_score = 0.0
    best_match = None

    meaningful_raw = set(upper.split()) - _NOISE_TOKENS
    meaningful_exp = set(expanded.split()) - _NOISE_TOKENS

    for db_key, db_value in GROCERY_DB.items():
        db_tokens = set(db_key.split())
        std_tokens = set(db_value[0].upper().split())

        raw_overlap = (
            len(meaningful_raw & db_tokens) / max(len(meaningful_raw), len(db_tokens))
            if meaningful_raw and db_tokens else 0
        )
        exp_overlap = (
            len(meaningful_exp & std_tokens) / max(len(meaningful_exp), len(std_tokens))
            if meaningful_exp and std_tokens else 0
        )
        token_score = max(raw_overlap, exp_overlap)

        if db_key in upper or upper in db_key:
            contain_score = 0.85
        elif db_key in expanded or expanded in db_key:
            contain_score = 0.80
        else:
            contain_score = 0

        fuzzy_score = max(
            SequenceMatcher(None, upper, db_key).ratio(),
            SequenceMatcher(None, expanded, db_key).ratio(),
            SequenceMatcher(None, expanded, db_value[0].upper()).ratio(),
        )

        score = max(token_score, contain_score, fuzzy_score)
        if score > best_score:
            best_score = score
            best_match = db_value

    return best_match if best_score >= 0.55 else None


def guess_category(name: str) -> str:
    expanded = expand_abbreviations(name).lower()
    text = f"{name.lower()} {expanded}"

    best_cat = "unknown"
    best_count = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text)
        if count > best_count:
            best_count = count
            best_cat = category

    return best_cat


def build_standardized_name(raw_name: str) -> str:
    expanded = expand_abbreviations(raw_name)
    noise = {"GALLON", "QUART", "PINT", "OUNCE", "POUND", "POUNDS",
             "PACK", "PACKAGE", "COUNT", "SMALL", "MEDIUM", "EXTRA LARGE"}
    words = expanded.split()
    clean = [w for w in words if w not in noise and not re.match(r'^\d+$', w)]
    if not clean:
        clean = words
    return " ".join(w.capitalize() for w in clean)
