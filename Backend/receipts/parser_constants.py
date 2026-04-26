import re

IGNORED_ALPHA_SNIPPETS = {
    "approved", "auth", "balance", "benefits", "card", "cash", "change",
    "circle", "coupon", "credit", "debit", "discount", "earnings",
    "itemssold", "livebetter", "loyalty", "manager", "mastercard", "member",
    "mid", "open", "purchase", "price", "receipt", "regular", "rrn",
    "savemoney", "savings", "subtotal", "tax", "thank", "tid", "total",
    "visa", "walmart",
}
ITEM_REJECTION_SNIPPETS = {"greenbagpts", "loyaltydiv", "rewardscustomer", "savedyou"}
HEADER_BLACKLIST = {"grocery"}
STATUS_TOKENS = {"F", "R", "T", "X", "Y", "I", "O", "S"}
TRAILING_DEPARTMENT_CODES = {"BE", "BF", "CT", "EA", "KG", "LB", "OZ", "PK", "TF"}

STORE_HEADER_NOISE = {
    "approved", "auth", "balance", "cashier", "credit", "customer", "debit",
    "grocery", "hello", "itemsold", "manager", "open", "pharmacy", "purchase",
    "receipt", "register", "savings", "store", "subtotal", "tax", "thank",
    "total", "transaction", "visa", "welcome", "your",
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
TOTAL_CANDIDATE_PRIORITY = {
    "balance": 4, "amountdue": 3, "totaldue": 3, "total": 2, "due": 1,
}

OCR_TRANSLATION = str.maketrans({
    "_": " ", "«": " ", "“": " ", "”": " ", "‘": "'",
    "`": "'", "—": " ", "–": " ", "~": " ", " ": " ",
})

LEADING_SKU_PATTERN = re.compile(r"^(?:\d{5,}\s+)+")
SKU_TOKEN_PATTERN = re.compile(r"\b\d{5,}[A-Za-z0-9]*\b")
SHORT_LEADING_CODE_PATTERN = re.compile(r"^[A-Za-z]-")
LEADING_STORE_CODE_PATTERN = re.compile(r"^(?:(?:SC|DB|GB)\s+)+", re.IGNORECASE)
NON_ITEM_CHARS_PATTERN = re.compile(r"[^A-Za-z0-9&'()/%+.-]+")
TRAILING_NUMERIC_NOISE_PATTERN = re.compile(r"^\d{1,4}$")
TRAILING_MIXED_CODE_PATTERN = re.compile(r"^\d[A-Za-z0-9]{1,3}$")
QUANTITY_AT_PRICE_PATTERN = re.compile(
    r"^\s*(\d+)\s*@\s*\$?\d+[.,]?\d{0,2}\s+(.+)$", re.IGNORECASE
)
QUANTITY_AT_FOR_PATTERN = re.compile(
    r"^\s*(\d+)\s+AT\s+\d+\s+FOR\b.*$", re.IGNORECASE
)
QUANTITY_X_PATTERN = re.compile(r"^\s*(\d+)\s*[xX]\s*(.+)$")
LEADING_QUANTITY_PATTERN = re.compile(r"^\s*(\d+)\s+(.+)$")
WEIGHT_FRAGMENT_PATTERN = re.compile(
    r"^\s*\d+(?:[.,]\d+)?\s*(?:lb|1b|ib|kg|oz)\b", re.IGNORECASE
)
EXPLICIT_PRICE_PATTERN = re.compile(r"(?<!\d)(?:\d+\.\d{2}|[Oo0]\d{2})(?!\d)")
SPLIT_PRICE_PATTERN = re.compile(
    r"(?P<prefix>.*?)(?<!\d)(?P<whole>[Oo0]?\d{1,3})\s+(?P<cents>\d{2})$"
)
ADDRESS_HINT_PATTERN = re.compile(
    r"\b(?:ave|avenue|blvd|boulevard|st|street|rd|road|dr|drive|ln|lane|"
    r"way|hwy|highway|pkwy|parkway|suite|ste|apt|unit)\b",
    re.IGNORECASE,
)
PHONE_PATTERN = re.compile(r"\(?\d{3}\)?\s*[-)\s]\s*\d{3}\s*[-\s]\s*\d{4}")
