import base64
import calendar
import datetime
import hashlib
import hmac
import mimetypes
import os
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import requests
from django.conf import settings

from .receipt_parser import (
    extract_receipt_total,
    extract_store_name,
    extract_text_from_receipt,
    parse_receipt_text,
)

VERYFI_IGNORED_LINE_TYPES = {
    "delivery",
    "discount",
    "donation",
    "fee",
    "giftcard",
    "parking",
    "payment",
    "refund",
    "service",
    "tax",
    "toll",
    "transportation",
}
VERYFI_REJECTED_NAME_SNIPPETS = {
    "balance",
    "blnc",
    "green bag",
    "loyalty div",
    "rewards customer",
    "saved you",
    "stouff save",
    "trgt bx",
}
VERYFI_FRAGMENT_REJECTION_PATTERN = re.compile(
    r"(?:saved you|stouff save|loyalty div|green bag|rewards customer|blnc|balance)",
    re.IGNORECASE,
)
VERYFI_MASKED_CARD_PATTERN = re.compile(r"\*{2,}")
VERYFI_PRICE_ONLY_PATTERN = re.compile(r"^\$?\d+(?:\.\d{2})?(?:\s*[A-Z])?$")
VERYFI_OCR_NOISE_PATTERN = re.compile(r"^[<+|*#@=%]+$")


@dataclass
class ReceiptProcessingResult:
    raw_text: str
    store_name: str
    detected_total: str | None
    parsed_items: list[dict]


class ReceiptProcessingError(RuntimeError):
    pass


class ReceiptProviderConfigurationError(ReceiptProcessingError):
    pass


class ReceiptProviderAPIError(ReceiptProcessingError):
    pass


def process_receipt_image(image_path):
    provider = getattr(settings, "RECEIPT_PROCESSING_PROVIDER", "auto").strip().lower()

    if provider == "local":
        return _process_with_local_parser(image_path)
    if provider == "veryfi":
        return _process_with_veryfi(image_path)
    if provider == "auto":
        if _veryfi_is_configured():
            return _process_with_veryfi(image_path)
        return _process_with_local_parser(image_path)

    raise ReceiptProviderConfigurationError(
        f'Unsupported receipt processing provider "{provider}". '
        'Use "auto", "veryfi", or "local".'
    )


def _process_with_local_parser(image_path):
    raw_text = extract_text_from_receipt(image_path)
    return ReceiptProcessingResult(
        raw_text=raw_text,
        store_name=extract_store_name(raw_text),
        detected_total=extract_receipt_total(image_path, raw_text=raw_text),
        parsed_items=parse_receipt_text(raw_text),
    )


def _process_with_veryfi(image_path):
    config = _get_veryfi_config()
    timestamp = _veryfi_timestamp_milliseconds()
    signature = _create_veryfi_signature(config["client_secret"], {}, timestamp)
    api_url = f'{config["api_url"].rstrip("/")}/api/v8/partner/documents'
    file_name = os.path.basename(image_path)
    content_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    headers = {
        "Accept": "application/json",
        "CLIENT-ID": config["client_id"],
        "AUTHORIZATION": f'apikey {config["username"]}:{config["api_key"]}',
        "X-VERYFI-REQUEST-TIMESTAMP": str(timestamp),
        "X-VERYFI-REQUEST-SIGNATURE": signature,
    }
    request_data = {
        "file_name": file_name,
        "document_type": "receipt",
        "async": "false",
        "boost_mode": "false",
        "compute": str(config["compute"]).lower(),
        "parse_address": "false",
        "auto_delete": str(config["auto_delete"]).lower(),
    }

    try:
        with open(image_path, "rb") as receipt_file:
            response = requests.post(
                api_url,
                headers=headers,
                data=request_data,
                files={"file": (file_name, receipt_file, content_type)},
                timeout=120,
            )
    except requests.RequestException as exc:
        raise ReceiptProviderAPIError(f"Veryfi request failed: {exc}") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400 or payload.get("status") == "fail":
        error_message = payload.get("error") or response.text or "Unknown Veryfi error."
        raise ReceiptProviderAPIError(
            f"Veryfi request failed with status {response.status_code}: {error_message}"
        )

    return map_veryfi_document_to_receipt_result(payload, image_path=image_path)


def map_veryfi_document_to_receipt_result(payload, image_path):
    raw_text = (payload.get("ocr_text") or "").strip()
    if not raw_text:
        raw_text = extract_text_from_receipt(image_path)

    parsed_items = _parse_veryfi_line_items(payload.get("line_items") or [])
    if not parsed_items:
        parsed_items = parse_receipt_text(raw_text)

    store_name = _extract_store_name_from_veryfi(payload, raw_text)
    detected_total = _extract_receipt_total_from_veryfi(payload)
    if detected_total is None:
        detected_total = extract_receipt_total(image_path, raw_text=raw_text)

    return ReceiptProcessingResult(
        raw_text=raw_text,
        store_name=store_name,
        detected_total=detected_total,
        parsed_items=parsed_items,
    )


def _extract_store_name_from_veryfi(payload, raw_text):
    vendor = payload.get("vendor") or {}
    if isinstance(vendor, dict):
        for field_name in ("name", "raw_name", "logo_name"):
            value = vendor.get(field_name)
            if isinstance(value, str) and value.strip():
                return _clean_store_name(value)

    for value in payload.get("vendors") or []:
        if isinstance(value, str) and value.strip():
            return _clean_store_name(value)

    return extract_store_name(raw_text)


def _extract_receipt_total_from_veryfi(payload):
    for field_name in ("total", "balance", "subtotal"):
        value = _format_decimal_string(payload.get(field_name))
        if value is not None:
            return value
    return None


def _parse_veryfi_line_items(line_items):
    parsed_items = []

    for line_item in sorted(
        [item for item in line_items if isinstance(item, dict)],
        key=lambda item: item.get("order") or 0,
    ):
        line_type = str(line_item.get("type") or "").strip().lower()
        if line_type in VERYFI_IGNORED_LINE_TYPES:
            continue

        name = _extract_veryfi_item_name(line_item)
        price_text = _extract_veryfi_item_price(line_item)
        if not name or price_text is None:
            continue

        if _should_skip_veryfi_line_item(line_item, name):
            continue

        parsed_items.append(
            {
                "name": name[:100],
                "estimated_price": price_text,
                "quantity": _normalize_quantity(line_item.get("quantity")),
            }
        )

    return parsed_items


def _extract_veryfi_item_name(line_item):
    product_details = line_item.get("product_details") or []
    product_info = line_item.get("product_info") or {}
    candidates = []

    if isinstance(product_details, list):
        for product_detail in product_details:
            if not isinstance(product_detail, dict):
                continue
            candidates.extend(
                [
                    product_detail.get("product_name"),
                    product_detail.get("brand"),
                ]
            )

    if isinstance(product_info, dict):
        candidates.extend(
            [
                product_info.get("expanded_description"),
                product_info.get("brand"),
            ]
        )

    candidates.extend(
        [
            line_item.get("normalized_description"),
            line_item.get("expanded_description"),
            line_item.get("description"),
            line_item.get("full_description"),
            line_item.get("text"),
        ]
    )

    for candidate in candidates:
        for fragment in _split_veryfi_name_fragments(candidate):
            cleaned = _clean_line_item_name(fragment)
            if cleaned:
                return cleaned

    return ""


def _split_veryfi_name_fragments(value):
    if not isinstance(value, str):
        return []

    fragments = []
    seen = set()
    for fragment in re.split(r"[\n\r\t]+", value):
        cleaned_fragment = fragment.strip()
        if not cleaned_fragment:
            continue
        if VERYFI_OCR_NOISE_PATTERN.fullmatch(cleaned_fragment):
            continue
        if VERYFI_PRICE_ONLY_PATTERN.fullmatch(cleaned_fragment):
            continue
        if VERYFI_FRAGMENT_REJECTION_PATTERN.search(cleaned_fragment):
            continue

        dedupe_key = cleaned_fragment.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        fragments.append(cleaned_fragment)

    return fragments


def _extract_veryfi_item_price(line_item):
    for field_name in ("total", "net_total", "gross_total", "subtotal"):
        price_text = _format_decimal_string(line_item.get(field_name))
        if price_text is not None:
            return price_text

    unit_price = _parse_decimal(line_item.get("price"))
    quantity = _normalize_quantity(line_item.get("quantity"))
    if unit_price is None:
        return None

    if quantity > 1:
        return _decimal_to_string(unit_price * Decimal(quantity))

    return _decimal_to_string(unit_price)


def _normalize_quantity(value):
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return 1

    if quantity <= 0:
        return 1
    if quantity == quantity.to_integral_value():
        return int(quantity)

    return 1


def _should_skip_veryfi_line_item(line_item, name):
    lower_name = name.lower()
    if any(snippet in lower_name for snippet in VERYFI_REJECTED_NAME_SNIPPETS):
        return True

    raw_text = " ".join(
        str(line_item.get(field_name) or "")
        for field_name in ("text", "description", "full_description")
    ).lower()
    if VERYFI_MASKED_CARD_PATTERN.search(raw_text) and (
        "balance" in raw_text or "blnc" in raw_text or "trgt bx" in raw_text
    ):
        return True

    return False


def _clean_line_item_name(value):
    if not isinstance(value, str):
        return ""

    cleaned = re.sub(r"\s+", " ", value)
    cleaned = re.sub(r"\s*<[+>]\s*", " ", cleaned)
    cleaned = re.sub(r"\s+[A-Z]$", "", cleaned)
    cleaned = cleaned.strip(" -:;,.")
    if not cleaned:
        return ""

    if re.fullmatch(r"[\d\W_]+", cleaned):
        return ""

    return cleaned


def _clean_store_name(value):
    cleaned = re.sub(r"\s+", " ", value).strip(" -:;,.")
    return cleaned[:150]


def _get_veryfi_config():
    config = {
        "api_url": getattr(settings, "VERYFI_API_URL", "https://api.veryfi.com"),
        "client_id": getattr(settings, "VERYFI_CLIENT_ID", "").strip(),
        "client_secret": getattr(settings, "VERYFI_CLIENT_SECRET", "").strip(),
        "username": getattr(settings, "VERYFI_USERNAME", "").strip(),
        "api_key": getattr(settings, "VERYFI_API_KEY", "").strip(),
        "auto_delete": getattr(settings, "VERYFI_AUTO_DELETE", True),
        "compute": getattr(settings, "VERYFI_COMPUTE", True),
    }

    missing = [
        field_name
        for field_name in ("client_id", "client_secret", "username", "api_key")
        if not config[field_name]
    ]
    if missing:
        raise ReceiptProviderConfigurationError(
            "Veryfi is selected, but these settings are missing: "
            + ", ".join(f"VERYFI_{field_name.upper()}" for field_name in missing)
        )

    return config


def _veryfi_is_configured():
    return all(
        (
            getattr(settings, "VERYFI_CLIENT_ID", "").strip(),
            getattr(settings, "VERYFI_CLIENT_SECRET", "").strip(),
            getattr(settings, "VERYFI_USERNAME", "").strip(),
            getattr(settings, "VERYFI_API_KEY", "").strip(),
        )
    )


def _veryfi_timestamp_milliseconds():
    utc_seconds = calendar.timegm(datetime.datetime.utcnow().utctimetuple())
    return utc_seconds * 1000


def _create_veryfi_signature(secret, payload, timestamp):
    payload_parts = [f"timestamp:{timestamp}"]
    for key, value in payload.items():
        payload_parts.append(f"{key}:{value}")

    digest = hmac.new(
        secret.encode("utf-8"),
        msg=",".join(payload_parts).encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    return base64.b64encode(digest).decode("utf-8").strip()


def _format_decimal_string(value):
    decimal_value = _parse_decimal(value)
    if decimal_value is None:
        return None
    return _decimal_to_string(decimal_value)


def _parse_decimal(value):
    if value in (None, ""):
        return None

    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None

    if decimal_value <= 0:
        return None
    return decimal_value


def _decimal_to_string(value):
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
