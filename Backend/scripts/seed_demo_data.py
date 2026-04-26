#!/usr/bin/env python3
"""
Seed the NeighborFridge backend with demo users, share posts, claims,
and (optionally) generated receipts that the local OCR can scan without
hitting any external APIs.

Usage (server must be running):
    python scripts/seed_demo_data.py
    python scripts/seed_demo_data.py --reset             # wipe demo users first
    python scripts/seed_demo_data.py --base-url http://127.0.0.1:8000/api
    python scripts/seed_demo_data.py --no-receipts        # skip OCR step
    python scripts/seed_demo_data.py --skip-env-check     # don't touch .env

What it does:
    1. Forces RECEIPT_PROCESSING_PROVIDER=local in Backend/.env so receipt
       processing never calls Veryfi (or any other external service).
    2. Optionally runs `manage.py reset_demo_users` first (--reset) to wipe
       any existing demo accounts so the seed can re-create them with the
       shared password.
    3. Signs up 5 demo users (each with their own auto-created household).
    4. Logs each user in if signup says they already exist.
    5. Creates 2-3 share posts per user using real Unsplash food photos.
    6. Has several users claim each others' posts so the marketplace shows
       both 'available' and 'claimed' items.
    7. Generates a fake grocery receipt PNG per user using Pillow, uploads
       it through /api/receipts/upload/ (which uses pytesseract locally),
       and confirms the parsed items into the user's pantry.
"""

import argparse
import io
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

import requests


DEFAULT_BASE_URL = "http://127.0.0.1:8000/api"
SHARED_PASSWORD = "FreshFridge2026!"

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"
ENV_EXAMPLE_FILE = BACKEND_DIR / ".env.example"


# Real LA-area coordinates so OpenStreetMap doesn't have to be hit at all
# (PostWriteSerializer skips geocoding when location + lat + lng are all sent).
USERS = [
    {
        "username": "sinaghadimi",
        "email": "ghadimi.cna@gmail.com",
        "display_name": "Sina Ghadimi",
        "household_name": "Maple Court Co-op",
        "pickup_location": "Maple Court community fridge, Westwood, Los Angeles",
        "pickup_latitude": "34.068900",
        "pickup_longitude": "-118.445200",
    },
    {
        "username": "shervinss",
        "email": "shervinshahidi@ucla.edu",
        "display_name": "Shervin Shahidi",
        "household_name": "Oak Street House",
        "pickup_location": "Oak Street porch cooler, Santa Monica, CA",
        "pickup_latitude": "34.019500",
        "pickup_longitude": "-118.491200",
    },
    {
        "username": "mina",
        "email": "sinagh9081@gmail.com",
        "display_name": "Mina G.",
        "household_name": "Cedar Avenue Loft",
        "pickup_location": "Cedar Ave lobby shelf, Venice, CA",
        "pickup_latitude": "33.985000",
        "pickup_longitude": "-118.469500",
    },
    {
        "username": "tina",
        "email": "sina.ghadimi.home@gmail.com",
        "display_name": "Tina G.",
        "household_name": "Pine Street Bungalow",
        "pickup_location": "Pine Street front desk, Beverly Hills, CA",
        "pickup_latitude": "34.073600",
        "pickup_longitude": "-118.400400",
    },
    {
        "username": "hida",
        "email": "sinaghadimi@g.ucla.edu",
        "display_name": "Hida G.",
        "household_name": "Birch Lane Townhouse",
        "pickup_location": "Birch Lane shared fridge, Brentwood, Los Angeles",
        "pickup_latitude": "34.052400",
        "pickup_longitude": "-118.470700",
    },
]


# Each list is owned by USERS[i] (matched by index).
POSTS_BY_USER = [
    # 0 — sinaghadimi
    [
        {
            "title": "Honeycrisp apples",
            "item_name": "Honeycrisp apples",
            "quantity_label": "8 apples",
            "estimated_price": "6.75",
            "description": "Crisp and sweet from the weekend farmers market. Great for snacking, salads, or a quick crumble.",
            "image_url": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["snack plates", "salads", "crumble"],
        },
        {
            "title": "Sourdough starter",
            "item_name": "Sourdough starter",
            "quantity_label": "1 jar (8 oz)",
            "estimated_price": "0.00",
            "description": "Active starter, fed this morning. Bring your own clean jar if you want a split.",
            "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["bread", "pancakes", "pizza dough"],
        },
        {
            "title": "Greek yogurt tub",
            "item_name": "Greek yogurt",
            "quantity_label": "32 oz tub",
            "estimated_price": "5.50",
            "description": "Unopened. Leaving town tomorrow and would rather share than waste.",
            "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["breakfast bowls", "marinades", "dips"],
        },
    ],
    # 1 — shervinss
    [
        {
            "title": "Basil bouquet",
            "item_name": "Fresh basil",
            "quantity_label": "2 cups",
            "estimated_price": "3.50",
            "description": "Washed and bundled. Perfect for pesto night.",
            "image_url": "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["pesto", "pasta", "garnish"],
        },
        {
            "title": "Navel oranges",
            "item_name": "Navel oranges",
            "quantity_label": "6 oranges",
            "estimated_price": "5.00",
            "description": "Bright and juicy. Bought too many on a Costco run.",
            "image_url": "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["snacks", "juice", "salads"],
        },
    ],
    # 2 — mina
    [
        {
            "title": "Rainbow carrots",
            "item_name": "Rainbow carrots",
            "quantity_label": "1 bunch",
            "estimated_price": "4.25",
            "description": "Roasted these last week and they were amazing. Have an extra bunch.",
            "image_url": "https://images.unsplash.com/photo-1447175008436-054170c2e979?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["roast trays", "slaw", "stock"],
        },
        {
            "title": "Cherry tomatoes",
            "item_name": "Cherry tomatoes",
            "quantity_label": "1 pint",
            "estimated_price": "3.50",
            "description": "Ripe and sweet. Best used today — pasta, salad, or a sheet pan.",
            "image_url": "https://images.unsplash.com/photo-1546470427-e26264be0b0d?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["sauce", "salads", "salsa"],
        },
        {
            "title": "Spinach clamshell",
            "item_name": "Baby spinach",
            "quantity_label": "5 oz container",
            "estimated_price": "3.75",
            "description": "Unopened. Use today or tomorrow for the best texture.",
            "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["smoothies", "salads", "saute"],
        },
    ],
    # 3 — tina
    [
        {
            "title": "Pizza dough balls",
            "item_name": "Pizza dough",
            "quantity_label": "2 dough balls",
            "estimated_price": "4.00",
            "description": "Thawed in the fridge. Great for a quick dinner tonight.",
            "image_url": "https://images.unsplash.com/photo-1601924582970-9238bcb495d9?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["pizza", "flatbread", "garlic knots"],
        },
        {
            "title": "Mozzarella pearls",
            "item_name": "Mozzarella pearls",
            "quantity_label": "8 oz cup",
            "estimated_price": "6.50",
            "description": "Sealed cup, kept cold. Great with the basil someone is also sharing.",
            "image_url": "https://images.unsplash.com/photo-1627935722051-395636b0d8a5?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["salads", "pizza", "snack plates"],
        },
    ],
    # 4 — hida
    [
        {
            "title": "Lemons from the tree",
            "item_name": "Meyer lemons",
            "quantity_label": "10 lemons",
            "estimated_price": "0.00",
            "description": "Backyard tree is overflowing. Help yourself to a bag.",
            "image_url": "https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["lemonade", "marinades", "baking"],
        },
        {
            "title": "Cilantro bunch",
            "item_name": "Fresh cilantro",
            "quantity_label": "1 bunch",
            "estimated_price": "2.00",
            "description": "Still fragrant. Best for tacos or rice bowls this week.",
            "image_url": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["tacos", "rice bowls", "chutney"],
        },
        {
            "title": "Whole-grain bread loaf",
            "item_name": "Whole-grain bread",
            "quantity_label": "1 loaf",
            "estimated_price": "5.25",
            "description": "Bakery-fresh, sliced. Freezes well if you can't use it right away.",
            "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["sandwiches", "toast", "french toast"],
        },
    ],
]


# (claimer_index, owner_index, post_index_within_owner, action)
# Each entry first creates a PostRequest (the claimer pings the owner via
# PATCH /share/<id>/claim/). Then, depending on `action`:
#   "approve" - owner approves and the post becomes claimed
#   "deny"    - owner declines and the post returns to available
#   "request" - request stays pending so the marketplace shows it as
#               'pending review'
CLAIMS = [
    (1, 0, 0, "approve"),  # shervinss requests sinaghadimi's apples -> approved
    (2, 1, 0, "approve"),  # mina requests shervinss's basil -> approved
    (3, 2, 1, "approve"),  # tina requests mina's cherry tomatoes -> approved
    (4, 3, 0, "request"),  # hida requests tina's pizza dough -> pending
    (0, 4, 0, "request"),  # sinaghadimi requests hida's lemons -> pending
    (2, 0, 2, "approve"),  # mina requests sinaghadimi's yogurt -> approved
    (4, 2, 2, "deny"),     # hida requests mina's spinach -> denied
]


# Receipts: each user gets one fake grocery run.
# Names use abbreviated grocery-receipt style so core/services/grocery_db.py
# matches them locally without needing Ollama.
RECEIPTS_BY_USER = [
    # 0 — sinaghadimi
    {
        "store": "TRADER JOE'S",
        "items": [
            ("HNYCRSP APPL",   "6.75"),
            ("ORG BANNAS",     "1.99"),
            ("AVOCADO",        "1.49"),
            ("WHOLE MILK GAL", "4.29"),
            ("WHEAT BREAD",    "3.99"),
        ],
    },
    # 1 — shervinss
    {
        "store": "RALPHS",
        "items": [
            ("BASIL",          "2.99"),
            ("ROMA TOMATO",    "2.49"),
            ("MOZZARELLA",     "5.49"),
            ("OLIVE OIL",      "8.99"),
            ("PASTA",          "1.79"),
        ],
    },
    # 2 — mina
    {
        "store": "WHOLE FOODS",
        "items": [
            ("RAINBOW CARROT", "4.25"),
            ("BABY SPINACH",   "3.75"),
            ("GREEK YOGURT",   "5.50"),
            ("BLUEBERRIES",    "4.99"),
            ("EGGS DOZEN",     "5.49"),
        ],
    },
    # 3 — tina
    {
        "store": "TARGET",
        "items": [
            ("PIZZA DOUGH",    "3.99"),
            ("MOZZARELLA",     "5.49"),
            ("CHERRY TOMATO",  "3.50"),
            ("BUTTER",         "4.79"),
            ("PARMESAN",       "6.49"),
        ],
    },
    # 4 — hida
    {
        "store": "COSTCO WHOLESALE",
        "items": [
            ("LEMON",          "5.99"),
            ("CILANTRO",       "1.49"),
            ("CHICKEN BREAST", "14.99"),
            ("BROWN RICE",     "9.49"),
            ("OAT MILK",       "6.99"),
        ],
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _color(text, code):
    return f"\033[{code}m{text}\033[0m"


def info(message):
    print(_color("·", "36"), message)


def success(message):
    print(_color("✓", "32"), message)


def warn(message):
    print(_color("!", "33"), message)


def fail(message):
    print(_color("✗", "31"), message, file=sys.stderr)


def csrf_headers(session):
    token = session.cookies.get("csrftoken")
    if not token:
        return {}
    return {"X-CSRFToken": token}


def prime_csrf(session, base_url):
    response = session.get(f"{base_url}/auth/csrf/", timeout=15)
    response.raise_for_status()


# --- .env management ------------------------------------------------------


def ensure_local_ocr_in_env():
    """Force RECEIPT_PROCESSING_PROVIDER=local in Backend/.env (idempotent)."""
    if not ENV_FILE.exists():
        if ENV_EXAMPLE_FILE.exists():
            ENV_FILE.write_text(ENV_EXAMPLE_FILE.read_text())
            info(f"Created {ENV_FILE.name} from .env.example")
        else:
            ENV_FILE.write_text("")
            info(f"Created empty {ENV_FILE.name}")

    lines = ENV_FILE.read_text().splitlines()
    found = False
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("RECEIPT_PROCESSING_PROVIDER="):
            if stripped != "RECEIPT_PROCESSING_PROVIDER=local":
                new_lines.append("RECEIPT_PROCESSING_PROVIDER=local")
                info("Updated RECEIPT_PROCESSING_PROVIDER -> local in .env")
            else:
                new_lines.append(line)
            found = True
        else:
            new_lines.append(line)

    if not found:
        new_lines.append("RECEIPT_PROCESSING_PROVIDER=local")
        info("Added RECEIPT_PROCESSING_PROVIDER=local to .env")

    ENV_FILE.write_text("\n".join(new_lines).rstrip() + "\n")


# --- Auth -----------------------------------------------------------------


def signup_or_login(session, base_url, user):
    prime_csrf(session, base_url)

    payload = {
        "username": user["username"],
        "email": user["email"],
        "password": SHARED_PASSWORD,
        "password_confirm": SHARED_PASSWORD,
        "display_name": user["display_name"],
        "household_name": user["household_name"],
    }

    response = session.post(
        f"{base_url}/auth/signup/",
        json=payload,
        headers=csrf_headers(session),
        timeout=20,
    )

    if response.status_code == 201:
        success(f"Signed up {user['username']} <{user['email']}>")
        return response.json().get("user", {})

    detail = _short_error(response)
    info(
        f"Signup for {user['username']} returned {response.status_code} ({detail}); "
        "attempting login"
    )

    prime_csrf(session, base_url)
    login_response = session.post(
        f"{base_url}/auth/login/",
        json={"identifier": user["username"], "password": SHARED_PASSWORD},
        headers=csrf_headers(session),
        timeout=20,
    )
    if login_response.status_code != 200:
        raise RuntimeError(
            f"Login failed for {user['username']} (status {login_response.status_code}): "
            f"{_short_error(login_response)}. "
            "Re-run with --reset to wipe the existing accounts and start clean."
        )
    success(f"Logged in {user['username']} <{user['email']}>")
    return login_response.json().get("user", {})


# --- Posts / claims --------------------------------------------------------


def create_post(session, base_url, user, post_payload):
    body = {
        "title": post_payload["title"],
        "item_name": post_payload["item_name"],
        "quantity_label": post_payload["quantity_label"],
        "estimated_price": post_payload["estimated_price"],
        "description": post_payload["description"],
        "image_url": post_payload["image_url"],
        "pickup_location": user["pickup_location"],
        "pickup_latitude": user["pickup_latitude"],
        "pickup_longitude": user["pickup_longitude"],
        "tags": post_payload["recipe_uses"],
        "status": "available",
    }
    response = session.post(
        f"{base_url}/share/",
        json=body,
        headers=csrf_headers(session),
        timeout=30,
    )
    if response.status_code != 201:
        raise RuntimeError(
            f"Could not create post '{post_payload['title']}' for {user['username']} "
            f"(status {response.status_code}): {_short_error(response)}"
        )
    return response.json()


def request_post(session, base_url, post_id):
    """Create (or refresh) a PostRequest for the given post as the current user."""
    response = session.patch(
        f"{base_url}/share/{post_id}/claim/",
        json={},
        headers=csrf_headers(session),
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Request for post {post_id} failed (status {response.status_code}): "
            f"{_short_error(response)}"
        )
    return response.json()


def find_request_id(owner_session, base_url, post_id, requester_user_id):
    """As the owner, find the request_id matching (post_id, requester_user_id)."""
    response = owner_session.get(
        f"{base_url}/share/requests/incoming/?status=pending",
        headers=csrf_headers(owner_session),
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Could not list incoming requests (status {response.status_code}): "
            f"{_short_error(response)}"
        )
    requests_payload = response.json().get("requests", [])
    for entry in requests_payload:
        post = entry.get("post") or {}
        requester = entry.get("requester") or {}
        if post.get("id") == post_id and requester.get("id") == requester_user_id:
            return entry.get("id")
    return None


def respond_to_request(owner_session, base_url, request_id, action):
    """Owner approves or denies a pending PostRequest."""
    if action not in ("approve", "deny"):
        raise ValueError(f"Unknown request action: {action}")
    response = owner_session.patch(
        f"{base_url}/share/requests/{request_id}/{action}/",
        json={},
        headers=csrf_headers(owner_session),
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Could not {action} request {request_id} "
            f"(status {response.status_code}): {_short_error(response)}"
        )
    return response.json()


# --- Receipt generation + upload ------------------------------------------


def render_receipt_image(store, items, subtotal=None, tax=None, total=None):
    """Render a receipt-style PNG into bytes that pytesseract can parse."""
    from PIL import Image, ImageDraw, ImageFont

    width = 720
    height = 200 + 60 * len(items) + 260
    image = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(image)

    # Pillow >= 10 supports load_default(size=...). Fall back gracefully.
    try:
        font_big = ImageFont.load_default(size=42)
        font_med = ImageFont.load_default(size=32)
        font_small = ImageFont.load_default(size=26)
    except TypeError:
        font_big = ImageFont.load_default()
        font_med = font_big
        font_small = font_big

    pad_x = 50
    y = 40

    header = store.upper()
    header_box = draw.textbbox((0, 0), header, font=font_big)
    header_w = header_box[2] - header_box[0]
    draw.text(((width - header_w) // 2, y), header, fill="black", font=font_big)
    y += 70

    sub = "123 Main St  ·  Los Angeles, CA"
    sub_box = draw.textbbox((0, 0), sub, font=font_small)
    sub_w = sub_box[2] - sub_box[0]
    draw.text(((width - sub_w) // 2, y), sub, fill="black", font=font_small)
    y += 50

    draw.line([(pad_x, y), (width - pad_x, y)], fill="black", width=2)
    y += 30

    if subtotal is None:
        subtotal_value = sum(float(price) for _, price in items)
    else:
        subtotal_value = float(subtotal)

    if tax is None:
        tax_value = round(subtotal_value * 0.0975, 2)
    else:
        tax_value = float(tax)

    if total is None:
        total_value = round(subtotal_value + tax_value, 2)
    else:
        total_value = float(total)

    for name, price in items:
        line_name = name.upper()
        price_text = f"${float(price):.2f}"
        draw.text((pad_x, y), line_name, fill="black", font=font_med)
        price_box = draw.textbbox((0, 0), price_text, font=font_med)
        price_w = price_box[2] - price_box[0]
        draw.text((width - pad_x - price_w, y), price_text, fill="black", font=font_med)
        y += 50

    y += 10
    draw.line([(pad_x, y), (width - pad_x, y)], fill="black", width=2)
    y += 30

    def draw_total_line(label, amount, font):
        nonlocal y
        amount_text = f"${amount:.2f}"
        draw.text((pad_x, y), label, fill="black", font=font)
        amount_box = draw.textbbox((0, 0), amount_text, font=font)
        amount_w = amount_box[2] - amount_box[0]
        draw.text((width - pad_x - amount_w, y), amount_text, fill="black", font=font)
        y += 50

    draw_total_line("SUBTOTAL", subtotal_value, font_med)
    draw_total_line("TAX", tax_value, font_med)
    draw_total_line("TOTAL", total_value, font_big)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


def upload_and_confirm_receipt(session, base_url, user, receipt_def):
    image_buffer = render_receipt_image(receipt_def["store"], receipt_def["items"])
    file_name = f"receipt_{user['username']}.png"

    upload_response = session.post(
        f"{base_url}/receipts/upload/",
        files={"image": (file_name, image_buffer, "image/png")},
        headers=csrf_headers(session),
        timeout=120,
    )
    if upload_response.status_code != 201:
        raise RuntimeError(
            f"Receipt upload failed (status {upload_response.status_code}): "
            f"{_short_error(upload_response)}"
        )

    receipt_payload = upload_response.json()
    parsed_items = receipt_payload.get("parsed_items") or []
    # ReceiptSerializer renames `id` to `receipt_id`. Accept either to be safe.
    receipt_id = receipt_payload.get("receipt_id") or receipt_payload.get("id")
    if not receipt_id:
        raise RuntimeError("Receipt upload returned no receipt id.")

    if not parsed_items:
        warn(
            f"  {user['username']}: receipt #{receipt_id} uploaded but the local "
            "OCR found no items (tesseract may need to be installed)."
        )
        return receipt_payload

    confirm_items = []
    for item in parsed_items:
        confirm_items.append(
            {
                "id": item["id"],
                "selected": True,
                "name": item.get("name", ""),
                "standardized_name": item.get("standardized_name") or item.get("name", ""),
                "quantity": item.get("quantity") or 1,
                "expiration_days": item.get("expiration_days"),
                "estimated_price": item.get("estimated_price"),
                "image_url": item.get("image_url", ""),
                "description": item.get("description", ""),
            }
        )

    confirm_response = session.post(
        f"{base_url}/receipts/{receipt_id}/confirm/",
        json={"items": confirm_items},
        headers=csrf_headers(session),
        timeout=60,
    )
    if confirm_response.status_code not in (200, 201):
        raise RuntimeError(
            f"Receipt confirm failed (status {confirm_response.status_code}): "
            f"{_short_error(confirm_response)}"
        )

    payload = confirm_response.json()
    success(
        f"  {user['username']}: receipt #{receipt_id} ({receipt_def['store']}) "
        f"-> {payload.get('created_count', len(confirm_items))} pantry items"
    )
    return payload


# --- Misc -----------------------------------------------------------------


def _short_error(response) -> Optional[str]:
    try:
        data = response.json()
    except ValueError:
        return response.text[:200] or None

    if isinstance(data, dict):
        if "detail" in data:
            return str(data["detail"])
        flat = []
        for key, value in data.items():
            if isinstance(value, (list, tuple)):
                value = " ".join(str(item) for item in value)
            flat.append(f"{key}: {value}")
        return "; ".join(flat)
    return str(data)[:200]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Seed NeighborFridge demo data.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL,
                        help=f"API base URL (default: {DEFAULT_BASE_URL})")
    parser.add_argument("--no-receipts", action="store_true",
                        help="Skip generating + uploading fake receipts.")
    parser.add_argument("--skip-env-check", action="store_true",
                        help="Don't touch Backend/.env (assume it's already correct).")
    parser.add_argument("--reset", action="store_true",
                        help="Run `manage.py reset_demo_users` before seeding to wipe "
                             "any existing demo accounts (and their posts / receipts / "
                             "households) so the seed can re-create them with the "
                             "shared password.")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    if not args.skip_env_check:
        ensure_local_ocr_in_env()
        info(
            "Note: if the server was already running, restart it so the new "
            ".env value is picked up."
        )

    if args.reset:
        manage_py = BACKEND_DIR / "manage.py"
        if not manage_py.exists():
            fail(f"Cannot find manage.py at {manage_py} for --reset.")
            sys.exit(1)
        info("Running `manage.py reset_demo_users` to wipe existing demo accounts...")
        try:
            subprocess.run(
                [sys.executable, str(manage_py), "reset_demo_users"],
                cwd=str(BACKEND_DIR),
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            fail(f"reset_demo_users exited with status {exc.returncode}.")
            sys.exit(1)

    info(f"Using API base: {base_url}")

    try:
        requests.get(f"{base_url}/auth/csrf/", timeout=5)
    except requests.RequestException as exc:
        fail(f"Cannot reach {base_url}. Is the Django server running? ({exc})")
        sys.exit(1)

    sessions = []
    user_payloads = []
    for user in USERS:
        session = requests.Session()
        try:
            user_payload = signup_or_login(session, base_url, user)
        except Exception as exc:
            fail(str(exc))
            sys.exit(1)
        sessions.append(session)
        user_payloads.append(user_payload)

    posts_by_user = []
    for index, user in enumerate(USERS):
        owned = []
        for post in POSTS_BY_USER[index]:
            try:
                created = create_post(sessions[index], base_url, user, post)
                owned.append(created)
                success(
                    f"  {user['username']} posted #{created.get('id')} '{post['title']}'"
                )
            except Exception as exc:
                warn(str(exc))
        posts_by_user.append(owned)

    for claimer_idx, owner_idx, post_idx, action in CLAIMS:
        owner_posts = posts_by_user[owner_idx]
        if post_idx >= len(owner_posts):
            warn(
                f"Skipping claim: {USERS[owner_idx]['username']} has no post at index {post_idx}"
            )
            continue
        post = owner_posts[post_idx]
        claimer_username = USERS[claimer_idx]["username"]
        owner_username = USERS[owner_idx]["username"]
        post_title = post.get("title")
        post_id = post["id"]

        try:
            request_post(sessions[claimer_idx], base_url, post_id)
        except Exception as exc:
            warn(f"  {claimer_username} could not request #{post_id} ({exc})")
            continue

        if action == "request":
            success(
                f"  {claimer_username} requested #{post_id} '{post_title}' "
                f"from {owner_username} (still pending)"
            )
            continue

        claimer_user_id = (user_payloads[claimer_idx] or {}).get("id")
        try:
            request_id = find_request_id(
                sessions[owner_idx], base_url, post_id, claimer_user_id,
            )
            if request_id is None:
                raise RuntimeError(
                    f"could not locate the pending request from user_id={claimer_user_id}"
                )
            respond_to_request(sessions[owner_idx], base_url, request_id, action)
            verb = "approved" if action == "approve" else "denied"
            success(
                f"  {owner_username} {verb} {claimer_username}'s request "
                f"for #{post_id} '{post_title}'"
            )
        except Exception as exc:
            warn(
                f"  {owner_username} could not {action} {claimer_username}'s "
                f"request for #{post_id} ({exc})"
            )

    if not args.no_receipts:
        info("Generating + uploading fake receipts (local OCR only)...")
        try:
            from PIL import Image  # noqa: F401
        except ImportError:
            warn(
                "Pillow is not importable in this venv. Skipping receipts. "
                "Run pip install -r requirements.txt to fix."
            )
        else:
            for index, user in enumerate(USERS):
                try:
                    upload_and_confirm_receipt(
                        sessions[index],
                        base_url,
                        user,
                        RECEIPTS_BY_USER[index],
                    )
                except Exception as exc:
                    warn(f"  {user['username']}: receipt step failed ({exc})")

    print()
    print(_color("=" * 84, "36"))
    print(_color("Demo accounts (shared password)", "1;36"))
    print(_color("=" * 84, "36"))
    print(f"{'Username':<14}  {'Email':<34}  {'Display name':<22}")
    print(f"{'-'*14:<14}  {'-'*34:<34}  {'-'*22:<22}")
    for user in USERS:
        print(
            f"{user['username']:<14}  {user['email']:<34}  {user['display_name']:<22}"
        )
    print()
    print(f"Password for everyone: {_color(SHARED_PASSWORD, '1;33')}")
    print()
    print("Log in from the frontend with either the username or the email.")
    print("Each user owns their own household with the same shared password.")
    print()


if __name__ == "__main__":
    main()
