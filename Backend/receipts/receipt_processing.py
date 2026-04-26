from django.conf import settings

from .receipt_parser import (
    extract_receipt_total,
    extract_store_name,
    extract_text_from_receipt,
    parse_receipt_text,
)
from .result import (
    ReceiptProcessingError,
    ReceiptProcessingResult,
    ReceiptProviderAPIError,
    ReceiptProviderConfigurationError,
)
from . import veryfi_provider

__all__ = [
    "ReceiptProcessingError",
    "ReceiptProcessingResult",
    "ReceiptProviderAPIError",
    "ReceiptProviderConfigurationError",
    "process_receipt_image",
]


def process_receipt_image(image_path):
    provider = getattr(settings, "RECEIPT_PROCESSING_PROVIDER", "auto").strip().lower()

    if provider == "local":
        return _process_with_local_parser(image_path)
    if provider == "veryfi":
        return veryfi_provider.process(image_path)
    if provider == "auto":
        if veryfi_provider.is_configured():
            return veryfi_provider.process(image_path)
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
