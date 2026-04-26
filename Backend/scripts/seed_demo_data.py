#!/usr/bin/env python3
"""
Seed the NeighborFridge backend with demo users, share posts, and claims.

Usage (server must be running):
    python scripts/seed_demo_data.py
    python scripts/seed_demo_data.py --base-url http://127.0.0.1:8000/api

What it does:
    1. Signs up 6 demo users (each with their own auto-created household).
    2. Logs each user in if signup says they already exist.
    3. Creates 2-3 share posts per user using real Unsplash food photos.
    4. Has several users claim each others' posts so the marketplace shows
       both 'available' and 'claimed' items.
    5. Prints a credentials table at the end so you can log in as any user
       from the frontend.

The script is idempotent for users (it logs in if the username already
exists), but posts are appended on every run. Use ./setup.sh --fresh
beforehand if you want a clean slate.
"""

import argparse
import sys
from typing import Optional

import requests


DEFAULT_BASE_URL = "http://127.0.0.1:8000/api"
SHARED_PASSWORD = "FreshFridge2026!"


# Real LA-area coordinates so OpenStreetMap doesn't have to be hit at all
# (PostWriteSerializer skips geocoding when location + lat + lng are all sent).
USERS = [
    {
        "username": "anthony",
        "email": "anthony@neighborfridge.test",
        "display_name": "Anthony Park",
        "household_name": "Maple Court Co-op",
        "pickup_location": "Maple Court community fridge, Westwood, Los Angeles",
        "pickup_latitude": "34.068900",
        "pickup_longitude": "-118.445200",
    },
    {
        "username": "maya",
        "email": "maya@neighborfridge.test",
        "display_name": "Maya Chen",
        "household_name": "Oak Street House",
        "pickup_location": "Oak Street porch cooler, Santa Monica, CA",
        "pickup_latitude": "34.019500",
        "pickup_longitude": "-118.491200",
    },
    {
        "username": "leo",
        "email": "leo@neighborfridge.test",
        "display_name": "Leo Park",
        "household_name": "Cedar Avenue Loft",
        "pickup_location": "Cedar Ave lobby shelf, Venice, CA",
        "pickup_latitude": "33.985000",
        "pickup_longitude": "-118.469500",
    },
    {
        "username": "nora",
        "email": "nora@neighborfridge.test",
        "display_name": "Nora Ali",
        "household_name": "Pine Street Bungalow",
        "pickup_location": "Pine Street front desk, Beverly Hills, CA",
        "pickup_latitude": "34.073600",
        "pickup_longitude": "-118.400400",
    },
    {
        "username": "mateo",
        "email": "mateo@neighborfridge.test",
        "display_name": "Mateo Diaz",
        "household_name": "Juniper Avenue Studio",
        "pickup_location": "Juniper Ave porch cooler, Culver City, CA",
        "pickup_latitude": "34.021100",
        "pickup_longitude": "-118.396500",
    },
    {
        "username": "priya",
        "email": "priya@neighborfridge.test",
        "display_name": "Priya Shah",
        "household_name": "Birch Lane Townhouse",
        "pickup_location": "Birch Lane shared fridge, Brentwood, Los Angeles",
        "pickup_latitude": "34.052400",
        "pickup_longitude": "-118.470700",
    },
]


# Each list is owned by USERS[i] (matched by index).
POSTS_BY_USER = [
    # 0 — Anthony
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
    ],
    # 1 — Maya
    [
        {
            "title": "Rainbow carrots",
            "item_name": "Rainbow carrots",
            "quantity_label": "1 bunch",
            "estimated_price": "4.25",
            "description": "Roasted these last week and they were amazing. Have an extra bunch I won't get to.",
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
            "title": "Greek yogurt tub",
            "item_name": "Greek yogurt",
            "quantity_label": "32 oz tub",
            "estimated_price": "5.50",
            "description": "Unopened. Leaving town tomorrow and would rather share than waste.",
            "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["breakfast bowls", "marinades", "dips"],
        },
    ],
    # 2 — Leo
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
            "description": "Bright and juicy. We bought too many on a Costco run.",
            "image_url": "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["snacks", "juice", "salads"],
        },
    ],
    # 3 — Nora
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
        {
            "title": "Roma tomatoes",
            "item_name": "Roma tomatoes",
            "quantity_label": "5 tomatoes",
            "estimated_price": "3.25",
            "description": "Ripe and ready. Plan to use these soon after pickup.",
            "image_url": "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["sauce", "sandwiches", "salsa"],
        },
    ],
    # 4 — Mateo
    [
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
            "title": "Baby carrots",
            "item_name": "Baby carrots",
            "quantity_label": "12 oz bag",
            "estimated_price": "2.50",
            "description": "Sealed bag. Easy pickup for anyone packing lunches.",
            "image_url": "https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["lunch sides", "hummus", "stir fry"],
        },
    ],
    # 5 — Priya
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
            "title": "Spinach clamshell",
            "item_name": "Baby spinach",
            "quantity_label": "5 oz container",
            "estimated_price": "3.75",
            "description": "Unopened. Use today or tomorrow for the best texture.",
            "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80",
            "recipe_uses": ["smoothies", "salads", "saute"],
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


# (claimer_index, owner_index, post_index_within_owner)
# Build a believable mix of available + claimed posts across the feed.
CLAIMS = [
    (1, 0, 0),  # Maya claims Anthony's apples
    (2, 1, 1),  # Leo claims Maya's cherry tomatoes
    (3, 2, 0),  # Nora claims Leo's basil
    (4, 3, 0),  # Mateo claims Nora's pizza dough
    (5, 4, 1),  # Priya claims Mateo's baby carrots
    (0, 5, 0),  # Anthony claims Priya's lemons
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
    """Hit /auth/csrf/ to make sure a csrftoken cookie exists in the jar."""
    response = session.get(f"{base_url}/auth/csrf/", timeout=15)
    response.raise_for_status()


def signup_or_login(session, base_url, user):
    """Try signup; if user exists, log in instead. Returns the user payload."""
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
        success(f"Signed up {user['username']} ({user['display_name']})")
        return response.json().get("user", {})

    # Likely already exists — try login.
    detail = _short_error(response)
    info(f"Signup for {user['username']} returned {response.status_code} ({detail}); attempting login")

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
            f"{_short_error(login_response)}"
        )
    success(f"Logged in {user['username']}")
    return login_response.json().get("user", {})


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


def claim_post(session, base_url, post_id):
    response = session.patch(
        f"{base_url}/share/{post_id}/claim/",
        json={},
        headers=csrf_headers(session),
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Claim failed for post {post_id} (status {response.status_code}): "
            f"{_short_error(response)}"
        )
    return response.json()


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
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"API base URL (default: {DEFAULT_BASE_URL})",
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    info(f"Using API base: {base_url}")

    # Quick reachability check.
    try:
        requests.get(f"{base_url}/auth/csrf/", timeout=5)
    except requests.RequestException as exc:
        fail(f"Cannot reach {base_url}. Is the Django server running? ({exc})")
        sys.exit(1)

    # 1. Sign up / log in every user with their own session.
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

    # 2. Create posts. Track them so we can claim by index later.
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

    # 3. Claims.
    for claimer_idx, owner_idx, post_idx in CLAIMS:
        owner_posts = posts_by_user[owner_idx]
        if post_idx >= len(owner_posts):
            warn(
                f"Skipping claim: {USERS[owner_idx]['username']} has no post at index {post_idx}"
            )
            continue
        post = owner_posts[post_idx]
        try:
            claim_post(sessions[claimer_idx], base_url, post["id"])
            success(
                f"  {USERS[claimer_idx]['username']} claimed "
                f"#{post['id']} '{post.get('title')}' from {USERS[owner_idx]['username']}"
            )
        except Exception as exc:
            warn(str(exc))

    # 4. Print credentials table.
    print()
    print(_color("=" * 72, "36"))
    print(_color("Demo accounts", "1;36"))
    print(_color("=" * 72, "36"))
    print(f"{'Username':<10}  {'Password':<20}  Display name")
    print(f"{'-' * 10:<10}  {'-' * 20:<20}  {'-' * 30}")
    for user in USERS:
        print(f"{user['username']:<10}  {SHARED_PASSWORD:<20}  {user['display_name']}")
    print()
    print("Log in from the frontend with any username (or its email) and the shared")
    print(f"password '{SHARED_PASSWORD}'. Each user owns their own household.")
    print()


if __name__ == "__main__":
    main()
