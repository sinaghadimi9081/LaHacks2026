import re
from decimal import Decimal, InvalidOperation

from .parser_constants import (
    ADDRESS_HINT_PATTERN,
    EXPLICIT_PRICE_PATTERN,
    HEADER_BLACKLIST,
    IGNORED_ALPHA_SNIPPETS,
    ITEM_REJECTION_SNIPPETS,
    KNOWN_STORE_PATTERNS,
    LEADING_QUANTITY_PATTERN,
    LEADING_SKU_PATTERN,
    LEADING_STORE_CODE_PATTERN,
    NON_ITEM_CHARS_PATTERN,
    OCR_TRANSLATION,
    PHONE_PATTERN,
    QUANTITY_AT_FOR_PATTERN,
    QUANTITY_AT_PRICE_PATTERN,
    QUANTITY_X_PATTERN,
    SHORT_LEADING_CODE_PATTERN,
    SKU_TOKEN_PATTERN,
    SPLIT_PRICE_PATTERN,
    STATUS_TOKENS,
    STORE_HEADER_NOISE,
    TOTAL_CANDIDATE_PRIORITY,
    TRAILING_DEPARTMENT_CODES,
    TRAILING_MIXED_CODE_PATTERN,
    TRAILING_NUMERIC_NOISE_PATTERN,
    WEIGHT_FRAGMENT_PATTERN,
)


class ReceiptOCRConfigurationError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def _load_ocr_dependencies():
    try:
        from PIL import Image, ImageEnhance, ImageOps
    except ImportError as exc:
        raise ReceiptOCRConfigurationError(
            "Pillow is not installed. Run `pip install -r requirements.txt`."
        ) from exc
    try:
        import pytesseract
    except ImportError as exc:
        raise ReceiptOCRConfigurationError(
            "pytesseract is not installed. Run `pip install -r requirements.txt`."
        ) from exc
    return Image, ImageEnhance, ImageOps, pytesseract


def _generate_ocr_text_candidates(image_path):
    Image, ImageEnhance, ImageOps, pytesseract = _load_ocr_dependencies()
    try:
        with Image.open(image_path) as image:
            base = ImageOps.exif_transpose(image)
            gray2x = ImageOps.autocontrast(
                base.convert("L").resize((base.width * 2, base.height * 2))
            )
            thresh2x = gray2x.point(lambda p: 255 if p > 160 else 0)
            contrast2x = ImageEnhance.Contrast(gray2x).enhance(2.0)
            bottom = base.crop((0, max(0, base.height // 2), base.width, base.height))
            bottom_gray3x = ImageOps.autocontrast(
                bottom.convert("L").resize((bottom.width * 3, bottom.height * 3))
            )
            candidates = [
                (base, "--oem 3 --psm 3"),
                (base, "--oem 3 --psm 4"),
                (gray2x, "--oem 3 --psm 4"),
                (thresh2x, "--oem 3 --psm 4"),
                (contrast2x, "--oem 3 --psm 6"),
                (contrast2x, "--oem 3 --psm 4"),
                (bottom_gray3x, "--oem 3 --psm 4"),
                (bottom_gray3x, "--oem 3 --psm 6"),
            ]
            texts = []
            for img, cfg in candidates:
                text = pytesseract.image_to_string(img, config=cfg).strip()
                if text:
                    texts.append(text)
            return list(dict.fromkeys(texts))
    except pytesseract.TesseractNotFoundError as exc:
        raise ReceiptOCRConfigurationError(
            "Tesseract OCR is not installed. On macOS, run `brew install tesseract`."
        ) from exc


def extract_text_from_receipt(image_path):
    best_text, best_score = "", (-1, -1, -1)
    for raw_text in _generate_ocr_text_candidates(image_path):
        score = _score_ocr_text(raw_text)
        if score > best_score:
            best_score, best_text = score, raw_text
    return best_text


# ---------------------------------------------------------------------------
# Text normalization helpers
# ---------------------------------------------------------------------------

def _normalize_line(line):
    normalized = line.translate(OCR_TRANSLATION)
    normalized = re.sub(r"(?<=\d)\s*[.,]\s*(?=\d{2}\b)", ".", normalized)
    return re.sub(r"\s{2,}", " ", normalized).strip()


def _compact_alpha(line):
    return re.sub(r"[^A-Za-z]+", "", line).lower()


def _is_ignored_line(line):
    compact = _compact_alpha(line)
    if "%" in line:
        return True
    if re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line):
        return True
    if re.search(r"\b\d{1,2}:\d{2}\b", line):
        return True
    if re.search(r"\b\d{5}(?:-\d{4})?\b", line):
        return True
    if re.search(r"\b\d{3}[-\s]\d{3}[-\s]\d{4}\b", line):
        return True
    if not compact:
        return bool(re.fullmatch(r"[^\d]*\$?\d+\.\d{2}[^\d]*", line))
    return any(s in compact for s in IGNORED_ALPHA_SNIPPETS)


def _score_ocr_text(raw_text):
    items = parse_receipt_text(raw_text)
    price_lines = nonempty = 0
    for raw_line in raw_text.splitlines():
        line = _normalize_line(raw_line)
        if not line:
            continue
        nonempty += 1
        if not _is_ignored_line(line) and _extract_price_from_line(line) is not None:
            price_lines += 1
    return len(items), price_lines, nonempty


# ---------------------------------------------------------------------------
# Store name extraction
# ---------------------------------------------------------------------------

def extract_store_name(raw_text):
    normalized_lines = [
        _normalize_line(l) for l in raw_text.splitlines() if _normalize_line(l)
    ]
    compact_full = "".join(_compact_alpha(l) for l in normalized_lines)

    for store_name, aliases in KNOWN_STORE_PATTERNS:
        if any(alias in compact_full for alias in aliases):
            return store_name

    ranked = []
    for i, line in enumerate(normalized_lines[:8]):
        candidate = _clean_store_candidate(line)
        if not candidate:
            continue
        score = (5 if i == 0 else 3 if i == 1 else 1)
        if line.upper() == line:
            score += 2
        word_count = len(candidate.split())
        if 1 <= word_count <= 4:
            score += 2
        if not re.search(r"\d", candidate):
            score += 2
        ranked.append((score, i, candidate))

    if not ranked:
        return ""
    ranked.sort(key=lambda item: (item[0], -item[1]), reverse=True)
    return ranked[0][2]


def _clean_store_candidate(line):
    if _extract_price_from_line(line) is not None:
        return ""
    if PHONE_PATTERN.search(line):
        return ""
    if re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line):
        return ""
    if re.search(r"\b\d{1,2}:\d{2}\b", line):
        return ""
    if ADDRESS_HINT_PATTERN.search(line):
        return ""
    if re.match(r"^\d", line):
        return ""

    compact = _compact_alpha(line)
    if not compact or compact in HEADER_BLACKLIST:
        return ""
    if any(noise in compact for noise in STORE_HEADER_NOISE):
        return ""

    alpha = sum(c.isalpha() for c in line)
    digits = sum(c.isdigit() for c in line)
    if alpha < 3 or digits > alpha:
        return ""

    cleaned = re.sub(r"[^A-Za-z0-9&'./ -]+", " ", line)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" -./")
    if not cleaned or len(cleaned) > 40:
        return ""
    return cleaned.title()


# ---------------------------------------------------------------------------
# Total extraction
# ---------------------------------------------------------------------------

def extract_receipt_total(image_path, raw_text=""):
    if raw_text:
        total = extract_receipt_total_from_text(raw_text)
        if total is not None:
            return total

    best_total, best_priority = None, -1
    try:
        for text in _generate_ocr_text_candidates(image_path):
            total, priority = _extract_receipt_total_candidate(text)
            if total is not None and priority > best_priority:
                best_total, best_priority = total, priority
    except (FileNotFoundError, OSError):
        return None
    return best_total


def _extract_receipt_total_candidate(raw_text):
    ranked = []
    for rev_i, raw_line in enumerate(reversed(raw_text.splitlines())):
        line = _normalize_line(raw_line)
        if not line:
            continue
        compact = _compact_alpha(line)
        priority = max(
            (p for kw, p in TOTAL_CANDIDATE_PRIORITY.items() if kw in compact), default=0
        )
        if priority == 0 or "subtotal" in compact or "savedyou" in compact:
            continue
        price_data = _extract_price_from_line(line)
        if price_data is None:
            continue
        try:
            value = Decimal(price_data[1])
        except InvalidOperation:
            continue
        if value < Decimal("0.50"):
            continue
        ranked.append((priority, rev_i, price_data[1]))

    if not ranked:
        return None, -1
    ranked.sort(key=lambda x: (x[0], -x[1]), reverse=True)
    return ranked[0][2], ranked[0][0]


def extract_receipt_total_from_text(raw_text):
    total, _ = _extract_receipt_total_candidate(raw_text)
    return total


# ---------------------------------------------------------------------------
# Price extraction
# ---------------------------------------------------------------------------

def _normalize_price_text(raw):
    normalized = raw.replace(",", ".").replace(" ", "").lstrip("$")
    if re.fullmatch(r"[Oo0]\d{2}", normalized):
        return f"0.{normalized[-2:]}"
    if re.fullmatch(r"\d{3}", normalized):
        return f"{normalized[:-2]}.{normalized[-2:]}"
    return normalized


def _strip_trailing_noise_tokens(line):
    tokens = line.split()
    while tokens:
        token = tokens[-1].strip(".,:;|!%*`~")
        upper = token.upper()
        if not token:
            tokens.pop()
        elif upper in STATUS_TOKENS:
            tokens.pop()
        elif len(token) == 1 and not token.isdigit():
            tokens.pop()
        elif len(token) == 1 and token.isdigit() and re.search(r"\d+\.\d{2}", " ".join(tokens[:-1])):
            tokens.pop()
        else:
            break
    return " ".join(tokens)


def _extract_price_from_line(line):
    stripped = _strip_trailing_noise_tokens(line)
    stripped = re.sub(r"(?<=\d)\s*[.,]\s*(?=\d{2}\b)", ".", stripped)

    explicit = list(EXPLICIT_PRICE_PATTERN.finditer(stripped))
    if explicit:
        m = explicit[-1]
        return stripped[: m.start()].strip(), _normalize_price_text(m.group())

    m = SPLIT_PRICE_PATTERN.search(stripped)
    if m:
        return m.group("prefix").strip(), _normalize_price_text(
            f'{m.group("whole")}.{m.group("cents")}'
        )
    return None


# ---------------------------------------------------------------------------
# Item name cleaning
# ---------------------------------------------------------------------------

def _strip_leading_codes(text):
    return LEADING_SKU_PATTERN.sub("", text).strip()


def _strip_trailing_codes(text):
    tokens = text.split()
    while tokens:
        token = tokens[-1].strip(".,:;*-/")
        upper = token.upper()
        if not token:
            tokens.pop()
        elif upper in TRAILING_DEPARTMENT_CODES or upper in STATUS_TOKENS:
            tokens.pop()
        elif TRAILING_MIXED_CODE_PATTERN.fullmatch(token):
            tokens.pop()
        elif len(tokens) > 1 and TRAILING_NUMERIC_NOISE_PATTERN.fullmatch(token):
            tokens.pop()
        else:
            break
    return " ".join(tokens)


def _clean_item_name(name):
    cleaned = _strip_leading_codes(name)
    cleaned = LEADING_STORE_CODE_PATTERN.sub("", cleaned)
    cleaned = SKU_TOKEN_PATTERN.sub(" ", cleaned)
    cleaned = SHORT_LEADING_CODE_PATTERN.sub("", cleaned)
    cleaned = NON_ITEM_CHARS_PATTERN.sub(" ", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" -.:*#$/")
    cleaned = _strip_trailing_codes(cleaned)
    return cleaned.strip(" -.:*#$/")


def _has_strong_name(item_name):
    if not item_name:
        return False
    compact = _compact_alpha(item_name)
    if len(compact) >= 3 and compact not in HEADER_BLACKLIST:
        return True
    alnum = re.sub(r"[^A-Za-z0-9]+", "", item_name)
    return (
        len(item_name.split()) == 1
        and len(alnum) >= 4
        and bool(re.search(r"[A-Za-z]", item_name))
        and bool(re.search(r"\d", item_name))
    )


def _should_reject_item_line(line_without_price, item_name):
    compact = _compact_alpha(item_name)
    if any(s in compact for s in ITEM_REJECTION_SNIPPETS) or "save" in compact:
        return True
    if re.match(r"^(?:GB|DB)\b", line_without_price.strip(), re.IGNORECASE):
        return True
    alnum = re.sub(r"[^A-Za-z0-9]+", "", item_name)
    digits = sum(c.isdigit() for c in alnum)
    alpha = sum(c.isalpha() for c in alnum)
    return digits >= 6 and alpha <= 6


def _looks_like_item_header(line):
    if _is_ignored_line(line):
        return False
    cleaned = _clean_item_name(line)
    if not _has_strong_name(cleaned):
        return False
    return _compact_alpha(cleaned) not in HEADER_BLACKLIST


# ---------------------------------------------------------------------------
# Quantity parsing
# ---------------------------------------------------------------------------

def _looks_like_quantity_fragment(line_without_price):
    if QUANTITY_AT_FOR_PATTERN.match(line_without_price):
        return True
    if WEIGHT_FRAGMENT_PATTERN.match(line_without_price):
        return True
    compact = re.sub(r"[^A-Za-z]+", "", line_without_price).lower()
    return compact in {"lb", "ib", "kg", "oz"} or (
        re.search(r"[@/]", line_without_price)
        and not re.search(r"[A-Za-z]{3,}", line_without_price)
    )


def _extract_quantity_and_name(line_without_price):
    quantity = 1
    item_name = _strip_leading_codes(line_without_price)

    if QUANTITY_AT_FOR_PATTERN.match(item_name):
        quantity = max(1, int(QUANTITY_AT_FOR_PATTERN.match(item_name).group(1)))
        return quantity, ""

    m = QUANTITY_AT_PRICE_PATTERN.match(item_name)
    if m:
        return max(1, int(m.group(1))), m.group(2)

    m = QUANTITY_X_PATTERN.match(item_name)
    if m:
        return max(1, int(m.group(1))), m.group(2)

    if _looks_like_quantity_fragment(item_name):
        return quantity, ""

    m = LEADING_QUANTITY_PATTERN.match(item_name)
    if m:
        quantity = max(1, int(m.group(1)))
        item_name = m.group(2)

    return quantity, item_name


# ---------------------------------------------------------------------------
# Main parse function
# ---------------------------------------------------------------------------

def parse_receipt_text(raw_text):
    parsed_items = []
    pending_name = None

    for raw_line in raw_text.splitlines():
        line = _normalize_line(raw_line)
        if not line:
            continue

        if _is_ignored_line(line):
            pending_name = None
            continue

        price_data = _extract_price_from_line(line)
        if price_data is None:
            if _looks_like_item_header(line):
                pending_name = _clean_item_name(line)
            continue

        line_without_price, price_text = price_data

        try:
            price_value = Decimal(price_text)
        except InvalidOperation:
            continue

        if price_value < Decimal("0.05"):
            pending_name = None
            continue

        quantity, item_name = _extract_quantity_and_name(line_without_price)
        item_name = _clean_item_name(item_name)

        if pending_name and (
            _looks_like_quantity_fragment(line_without_price)
            or (not _has_strong_name(item_name) and bool(re.search(r"[A-Za-z]", line_without_price)))
        ):
            item_name = pending_name

        item_name = _clean_item_name(item_name)
        if not _has_strong_name(item_name) or _should_reject_item_line(line_without_price, item_name):
            pending_name = None
            continue

        parsed_items.append({"name": item_name, "estimated_price": price_text, "quantity": quantity})
        pending_name = None

    return parsed_items
