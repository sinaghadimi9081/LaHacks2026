from dataclasses import dataclass


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
