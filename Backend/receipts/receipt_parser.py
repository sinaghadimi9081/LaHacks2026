import re
from decimal import Decimal, InvalidOperation


IGNORED_ALPHA_SNIPPETS = {
    "approved",
    "auth",
    "balance",
    "benefits",
    "card",
    "cash",
    "change",
    "circle",
    "coupon",
    "credit",
    "debit",
    "discount",
    "earnings",
    "itemssold",
    "livebetter",
    "loyalty",
    "manager",
    "mastercard",
    "member",
    "mid",
    "open",
    "purchase",
    "price",
    "receipt",
    "regular",
    "rrn",
    "savemoney",
    "savings",
    "subtotal",
    "tax",
    "thank",
    "tid",
    "total",
    "visa",
    "walmart",
}
ITEM_REJECTION_SNIPPETS = {
    "greenbagpts",
    "loyaltydiv",
    "rewardscustomer",
    "savedyou",
}
HEADER_BLACKLIST = {"grocery"}
STATUS_TOKENS = {"F", "R", "T", "X", "Y", "I", "O", "S"}
TRAILING_DEPARTMENT_CODES = {
    "BE",
    "BF",
    "CT",
    "EA",
    "KG",
    "LB",
    "OZ",
    "PK",
    "TF",
}
OCR_TRANSLATION = str.maketrans(
    {
        "_": " ",
        "«": " ",
        "“": " ",
        "”": " ",
        "’": "'",
        "`": "'",
        "—": " ",
        "–": " ",
        "~": " ",
        "\u00a0": " ",
    }
)
LEADING_SKU_PATTERN = re.compile(r"^(?:\d{5,}\s+)+")
SKU_TOKEN_PATTERN = re.compile(r"\b\d{5,}[A-Za-z0-9]*\b")
SHORT_LEADING_CODE_PATTERN = re.compile(r"^[A-Za-z]-")
LEADING_STORE_CODE_PATTERN = re.compile(r"^(?:(?:SC|DB|GB)\s+)+", re.IGNORECASE)
NON_ITEM_CHARS_PATTERN = re.compile(r"[^A-Za-z0-9&'()/%+.-]+")
TRAILING_NUMERIC_NOISE_PATTERN = re.compile(r"^\d{1,4}$")
TRAILING_MIXED_CODE_PATTERN = re.compile(r"^\d[A-Za-z0-9]{1,3}$")
QUANTITY_AT_PRICE_PATTERN = re.compile(
    r"^\s*(\d+)\s*@\s*\$?\d+[.,]?\d{0,2}\s+(.+)$",
    re.IGNORECASE,
)
QUANTITY_AT_FOR_PATTERN = re.compile(
    r"^\s*(\d+)\s+AT\s+\d+\s+FOR\b.*$",
    re.IGNORECASE,
)
QUANTITY_X_PATTERN = re.compile(r"^\s*(\d+)\s*[xX]\s*(.+)$")
LEADING_QUANTITY_PATTERN = re.compile(r"^\s*(\d+)\s+(.+)$")
WEIGHT_FRAGMENT_PATTERN = re.compile(
    r"^\s*\d+(?:[.,]\d+)?\s*(?:lb|1b|ib|kg|oz)\b",
    re.IGNORECASE,
)
EXPLICIT_PRICE_PATTERN = re.compile(r"(?<!\d)(?:\d+\.\d{2}|[Oo0]\d{2})(?!\d)")
SPLIT_PRICE_PATTERN = re.compile(r"(?P<prefix>.*?)(?<!\d)(?P<whole>[Oo0]?\d{1,3})\s+(?P<cents>\d{2})$")
TOTAL_CANDIDATE_PRIORITY = {
    "balance": 4,
    "amountdue": 3,
    "totaldue": 3,
    "total": 2,
    "due": 1,
}
KNOWN_STORE_PATTERNS = (
    ("Target", ("target", "targetcircle")),
    ("Walmart", ("walmart", "savemoneylivebetter", "almart")),
    ("Ralphs", ("ralphs",)),
    ("Kroger", ("kroger",)),
    ("Costco", ("costco", "costcowholesale")),
    ("Trader Joe's", ("traderjoes", "traderjoe")),
    ("Whole Foods", ("wholefoods",)),
    ("Safeway", ("safeway",)),
    ("Albertsons", ("albertsons",)),
    ("Sprouts", ("sprouts",)),
    ("Aldi", ("aldi",)),
    ("Food 4 Less", ("food4less",)),
    ("Vons", ("vons",)),
)
STORE_HEADER_NOISE = {
    "approved",
    "auth",
    "balance",
    "cashier",
    "credit",
    "customer",
    "debit",
    "grocery",
    "hello",
    "itemsold",
    "manager",
    "open",
    "pharmacy",
    "purchase",
    "receipt",
    "register",
    "savings",
    "store",
    "subtotal",
    "tax",
    "thank",
    "total",
    "transaction",
    "visa",
    "welcome",
    "your",
}
ADDRESS_HINT_PATTERN = re.compile(
    r"\b(?:ave|avenue|blvd|boulevard|st|street|rd|road|dr|drive|ln|lane|way|hwy|highway|pkwy|parkway|suite|ste|apt|unit)\b",
    re.IGNORECASE,
)
PHONE_PATTERN = re.compile(r"\(?\d{3}\)?\s*[-)\s]\s*\d{3}\s*[-\s]\s*\d{4}")


class ReceiptOCRConfigurationError(RuntimeError):
    pass


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
            base_image = ImageOps.exif_transpose(image)
            grayscale_2x = ImageOps.autocontrast(
                base_image.convert("L").resize(
                    (base_image.width * 2, base_image.height * 2)
                )
            )
            threshold_2x = grayscale_2x.point(lambda pixel: 255 if pixel > 160 else 0)
            contrast_2x = ImageEnhance.Contrast(grayscale_2x).enhance(2.0)
            bottom_crop = base_image.crop(
                (0, max(0, base_image.height // 2), base_image.width, base_image.height)
            )
            bottom_gray_3x = ImageOps.autocontrast(
                bottom_crop.convert("L").resize(
                    (bottom_crop.width * 3, bottom_crop.height * 3)
                )
            )

            candidates = [
                (base_image, "--oem 3 --psm 3"),
                (base_image, "--oem 3 --psm 4"),
                (grayscale_2x, "--oem 3 --psm 4"),
                (threshold_2x, "--oem 3 --psm 4"),
                (contrast_2x, "--oem 3 --psm 6"),
                (contrast_2x, "--oem 3 --psm 4"),
                (bottom_gray_3x, "--oem 3 --psm 4"),
                (bottom_gray_3x, "--oem 3 --psm 6"),
            ]

            texts = []
            for prepared_image, config in candidates:
                raw_text = pytesseract.image_to_string(prepared_image, config=config).strip()
                if raw_text:
                    texts.append(raw_text)

            return list(dict.fromkeys(texts))
    except pytesseract.TesseractNotFoundError as exc:
        raise ReceiptOCRConfigurationError(
            "Tesseract OCR is not installed. On macOS, run `brew install tesseract`."
        ) from exc


def extract_text_from_receipt(image_path):
    best_text = ""
    best_score = (-1, -1, -1)

    for raw_text in _generate_ocr_text_candidates(image_path):
        score = _score_ocr_text(raw_text)
        if score > best_score:
            best_score = score
            best_text = raw_text

    return best_text


def extract_store_name(raw_text):
    normalized_lines = [
        _normalize_line(raw_line)
        for raw_line in raw_text.splitlines()
        if _normalize_line(raw_line)
    ]
    compact_lines = [_compact_alpha(line) for line in normalized_lines]
    compact_full_text = "".join(compact_lines)

    for store_name, aliases in KNOWN_STORE_PATTERNS:
        if any(alias in compact_full_text for alias in aliases):
            return store_name

    ranked_candidates = []
    for index, line in enumerate(normalized_lines[:8]):
        candidate = _clean_store_candidate(line)
        if not candidate:
            continue

        score = 0
        if index == 0:
            score += 5
        elif index == 1:
            score += 3
        else:
            score += 1

        if line.upper() == line:
            score += 2

        word_count = len(candidate.split())
        if 1 <= word_count <= 4:
            score += 2

        if not re.search(r"\d", candidate):
            score += 2

        ranked_candidates.append((score, index, candidate))

    if not ranked_candidates:
        return ""

    ranked_candidates.sort(key=lambda item: (item[0], -item[1]), reverse=True)
    return ranked_candidates[0][2]


def extract_receipt_total(image_path, raw_text=""):
    if raw_text:
        total = extract_receipt_total_from_text(raw_text)
        if total is not None:
            return total

    best_total = None
    best_priority = -1

    try:
        for candidate_text in _generate_ocr_text_candidates(image_path):
            total, priority = _extract_receipt_total_candidate(candidate_text)
            if total is not None and priority > best_priority:
                best_total = total
                best_priority = priority
    except (FileNotFoundError, OSError):
        return None

    return best_total


def _score_ocr_text(raw_text):
    parsed_items = parse_receipt_text(raw_text)
    price_lines = 0
    nonempty_lines = 0

    for raw_line in raw_text.splitlines():
        normalized_line = _normalize_line(raw_line)
        if not normalized_line:
            continue

        nonempty_lines += 1
        if _is_ignored_line(normalized_line):
            continue

        if _extract_price_from_line(normalized_line) is not None:
            price_lines += 1

    return len(parsed_items), price_lines, nonempty_lines


def _normalize_line(line):
    normalized = line.translate(OCR_TRANSLATION)
    normalized = re.sub(r"(?<=\d)\s*[.,]\s*(?=\d{2}\b)", ".", normalized)
    normalized = re.sub(r"\s{2,}", " ", normalized)
    return normalized.strip()


def _compact_alpha(line):
    return re.sub(r"[^A-Za-z]+", "", line).lower()


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

    compact_alpha = _compact_alpha(line)
    if not compact_alpha:
        return ""
    if compact_alpha in HEADER_BLACKLIST:
        return ""
    if any(noise in compact_alpha for noise in STORE_HEADER_NOISE):
        return ""

    alpha_count = sum(character.isalpha() for character in line)
    digit_count = sum(character.isdigit() for character in line)
    if alpha_count < 3 or digit_count > alpha_count:
        return ""

    cleaned = re.sub(r"[^A-Za-z0-9&'./ -]+", " ", line)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" -./")
    if not cleaned:
        return ""
    if len(cleaned) > 40:
        return ""

    return cleaned.title()


def _is_ignored_line(line):
    compact_alpha = _compact_alpha(line)
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
    if not compact_alpha:
        return bool(re.fullmatch(r"[^\d]*\$?\d+\.\d{2}[^\d]*", line))

    return any(snippet in compact_alpha for snippet in IGNORED_ALPHA_SNIPPETS)


def _strip_leading_codes(text):
    return LEADING_SKU_PATTERN.sub("", text).strip()


def _strip_trailing_codes(text):
    tokens = text.split()

    while tokens:
        token = tokens[-1].strip(".,:;*-/")
        upper_token = token.upper()

        if not token:
            tokens.pop()
            continue
        if upper_token in TRAILING_DEPARTMENT_CODES or upper_token in STATUS_TOKENS:
            tokens.pop()
            continue
        if TRAILING_MIXED_CODE_PATTERN.fullmatch(token):
            tokens.pop()
            continue
        if len(tokens) > 1 and TRAILING_NUMERIC_NOISE_PATTERN.fullmatch(token):
            tokens.pop()
            continue
        break

    return " ".join(tokens)


def _clean_item_name(name):
    cleaned = _strip_leading_codes(name)
    cleaned = LEADING_STORE_CODE_PATTERN.sub("", cleaned)
    cleaned = SKU_TOKEN_PATTERN.sub(" ", cleaned)
    cleaned = SHORT_LEADING_CODE_PATTERN.sub("", cleaned)
    cleaned = NON_ITEM_CHARS_PATTERN.sub(" ", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = cleaned.strip(" -.:*#$/")
    cleaned = _strip_trailing_codes(cleaned)
    cleaned = cleaned.strip(" -.:*#$/")
    return cleaned


def _strip_trailing_noise_tokens(line):
    tokens = line.split()

    while tokens:
        token = tokens[-1].strip(".,:;|!%*`~")
        upper_token = token.upper()

        if not token:
            tokens.pop()
            continue
        if upper_token in STATUS_TOKENS:
            tokens.pop()
            continue
        if len(token) == 1 and not token.isdigit():
            tokens.pop()
            continue
        if len(token) == 1 and token.isdigit():
            joined = " ".join(tokens[:-1])
            if re.search(r"\d+\.\d{2}", joined):
                tokens.pop()
                continue
        break

    return " ".join(tokens)


def _normalize_price_text(raw_price):
    normalized = raw_price.replace(",", ".").replace(" ", "").lstrip("$")

    if re.fullmatch(r"[Oo0]\d{2}", normalized):
        normalized = f"0.{normalized[-2:]}"
    elif re.fullmatch(r"\d{3}", normalized):
        normalized = f"{normalized[:-2]}.{normalized[-2:]}"

    return normalized


def _extract_price_from_line(line):
    stripped_line = _strip_trailing_noise_tokens(line)
    stripped_line = re.sub(r"(?<=\d)\s*[.,]\s*(?=\d{2}\b)", ".", stripped_line)

    explicit_matches = list(EXPLICIT_PRICE_PATTERN.finditer(stripped_line))
    if explicit_matches:
        price_match = explicit_matches[-1]
        return stripped_line[: price_match.start()].strip(), _normalize_price_text(
            price_match.group()
        )

    split_match = SPLIT_PRICE_PATTERN.search(stripped_line)
    if split_match:
        return split_match.group("prefix").strip(), _normalize_price_text(
            f'{split_match.group("whole")}.{split_match.group("cents")}'
        )

    return None


def _looks_like_quantity_fragment(line_without_price):
    if QUANTITY_AT_FOR_PATTERN.match(line_without_price):
        return True
    if WEIGHT_FRAGMENT_PATTERN.match(line_without_price):
        return True

    compact = re.sub(r"[^A-Za-z]+", "", line_without_price).lower()
    return compact in {"lb", "ib", "kg", "oz"} or (
        re.search(r"[@/]", line_without_price) and not re.search(r"[A-Za-z]{3,}", line_without_price)
    )


def _extract_quantity_and_name(line_without_price):
    quantity = 1
    item_name = _strip_leading_codes(line_without_price)

    if QUANTITY_AT_FOR_PATTERN.match(item_name):
        quantity = max(1, int(QUANTITY_AT_FOR_PATTERN.match(item_name).group(1)))
        return quantity, ""

    match = QUANTITY_AT_PRICE_PATTERN.match(item_name)
    if match:
        quantity = max(1, int(match.group(1)))
        item_name = match.group(2)
        return quantity, item_name

    match = QUANTITY_X_PATTERN.match(item_name)
    if match:
        quantity = max(1, int(match.group(1)))
        item_name = match.group(2)
        return quantity, item_name

    if _looks_like_quantity_fragment(item_name):
        return quantity, ""

    match = LEADING_QUANTITY_PATTERN.match(item_name)
    if match:
        quantity = max(1, int(match.group(1)))
        item_name = match.group(2)

    return quantity, item_name


def _has_strong_name(item_name):
    if not item_name:
        return False

    compact_alpha = _compact_alpha(item_name)
    if len(compact_alpha) >= 3 and compact_alpha not in HEADER_BLACKLIST:
        return True

    compact_alnum = re.sub(r"[^A-Za-z0-9]+", "", item_name)
    return (
        len(item_name.split()) == 1
        and len(compact_alnum) >= 4
        and bool(re.search(r"[A-Za-z]", item_name))
        and bool(re.search(r"\d", item_name))
    )


def _should_reject_item_line(line_without_price, item_name):
    compact_alpha = _compact_alpha(item_name)
    if any(snippet in compact_alpha for snippet in ITEM_REJECTION_SNIPPETS):
        return True
    if "save" in compact_alpha:
        return True
    if re.match(r"^(?:GB|DB)\b", line_without_price.strip(), re.IGNORECASE):
        return True

    compact_alnum = re.sub(r"[^A-Za-z0-9]+", "", item_name)
    digit_count = sum(character.isdigit() for character in compact_alnum)
    alpha_count = sum(character.isalpha() for character in compact_alnum)
    if digit_count >= 6 and alpha_count <= 6:
        return True

    return False


def _looks_like_item_header(line):
    if _is_ignored_line(line):
        return False

    cleaned = _clean_item_name(line)
    if not _has_strong_name(cleaned):
        return False

    if _compact_alpha(cleaned) in HEADER_BLACKLIST:
        return False

    return True


def _extract_receipt_total_candidate(raw_text):
    ranked_candidates = []
    lines = raw_text.splitlines()

    for reverse_index, raw_line in enumerate(reversed(lines)):
        line = _normalize_line(raw_line)
        if not line:
            continue

        compact_alpha = _compact_alpha(line)
        priority = 0
        for keyword, keyword_priority in TOTAL_CANDIDATE_PRIORITY.items():
            if keyword in compact_alpha:
                priority = max(priority, keyword_priority)

        if priority == 0:
            continue

        if "subtotal" in compact_alpha or "savedyou" in compact_alpha:
            continue

        price_data = _extract_price_from_line(line)
        if price_data is None:
            continue

        _, price_text = price_data
        try:
            price_value = Decimal(price_text)
        except InvalidOperation:
            continue

        if price_value < Decimal("0.50"):
            continue

        ranked_candidates.append((priority, reverse_index, price_text))

    if not ranked_candidates:
        return None, -1

    ranked_candidates.sort(key=lambda item: (item[0], -item[1]), reverse=True)
    best_priority, _, best_price_text = ranked_candidates[0]
    return best_price_text, best_priority


def extract_receipt_total_from_text(raw_text):
    total, _ = _extract_receipt_total_candidate(raw_text)
    return total


def parse_receipt_text(raw_text):
    parsed_items = []
    pending_name = None

    for raw_line in raw_text.splitlines():
        normalized_line = _normalize_line(raw_line)
        if not normalized_line:
            continue

        if _is_ignored_line(normalized_line):
            pending_name = None
            continue

        price_data = _extract_price_from_line(normalized_line)
        if price_data is None:
            if _looks_like_item_header(normalized_line):
                pending_name = _clean_item_name(normalized_line)
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
        if not _has_strong_name(item_name) or _should_reject_item_line(
            line_without_price,
            item_name,
        ):
            pending_name = None
            continue

        parsed_items.append(
            {
                "name": item_name,
                "estimated_price": price_text,
                "quantity": quantity,
            }
        )
        pending_name = None

    return parsed_items
