#!/usr/bin/env python3
"""
Seed NeighborFridge demo data, but bias confirmed receipt items toward
near-expiration dates so expiration notifications can be demonstrated
immediately.

This keeps the original seed_demo_data.py intact and reuses the same demo
users, posts, and claims.

Usage (server must be running):
    python scripts/seed_demo_data_2.py
    python scripts/seed_demo_data_2.py --reset
    python scripts/seed_demo_data_2.py --base-url http://127.0.0.1:8000/api
    python scripts/seed_demo_data_2.py --skip-expiration-check

What it does:
    1. Seeds the same demo users / posts / claims as seed_demo_data.py.
    2. Uploads fake receipts through the normal OCR flow.
    3. Overrides confirmed expiration_days so each user gets items expiring
       today, tomorrow, and in 3 days.
    4. Immediately runs `manage.py check_expirations` so notification emails
       and in-app notifications fire right away for demo purposes.
"""

from __future__ import annotations

import argparse
import subprocess
import sys

from seed_demo_data import (
    BACKEND_DIR,
    DEFAULT_BASE_URL,
    RECEIPTS_BY_USER,
    USERS,
    _short_error,
    create_post,
    csrf_headers,
    ensure_local_ocr_in_env,
    fail,
    find_request_id,
    info,
    prime_csrf,
    render_receipt_image,
    request_post,
    respond_to_request,
    signup_or_login,
    success,
    warn,
)

import requests


EXPIRATION_DAY_PATTERN = [0, 1, 3, 1, 0]


def upload_and_confirm_near_expiration_receipt(
    session,
    base_url,
    user,
    receipt_def,
    expiration_pattern=None,
):
    if expiration_pattern is None:
        expiration_pattern = EXPIRATION_DAY_PATTERN

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
    receipt_id = receipt_payload.get("receipt_id") or receipt_payload.get("id")
    if not receipt_id:
        raise RuntimeError("Receipt upload returned no receipt id.")

    if not parsed_items:
        warn(
            f"  {user['username']}: receipt #{receipt_id} uploaded but OCR found no items."
        )
        return receipt_payload

    confirm_items = []
    for index, item in enumerate(parsed_items):
        forced_expiration_days = expiration_pattern[index % len(expiration_pattern)]
        confirm_items.append(
            {
                "id": item["id"],
                "selected": True,
                "name": item.get("name", ""),
                "standardized_name": item.get("standardized_name") or item.get("name", ""),
                "quantity": item.get("quantity") or 1,
                "expiration_days": forced_expiration_days,
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
        f"-> {payload.get('created_count', len(confirm_items))} pantry items "
        f"with demo expiration_days {expiration_pattern}"
    )
    return payload


def run_expiration_check():
    manage_py = BACKEND_DIR / "manage.py"
    info("Running `manage.py check_expirations` so demo notifications fire now...")
    subprocess.run(
        [sys.executable, str(manage_py), "check_expirations"],
        cwd=str(BACKEND_DIR),
        check=True,
    )
    success("Expiration notification command completed.")


def main():
    parser = argparse.ArgumentParser(
        description="Seed NeighborFridge demo data with near-expiration notifications."
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"API base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--skip-env-check",
        action="store_true",
        help="Don't touch Backend/.env (assume it's already correct).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Run `manage.py reset_demo_users` before seeding.",
    )
    parser.add_argument(
        "--skip-expiration-check",
        action="store_true",
        help="Seed near-expiring pantry items but do not run manage.py check_expirations.",
    )
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

    from seed_demo_data import CLAIMS, POSTS_BY_USER

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
                sessions[owner_idx], base_url, post_id, claimer_user_id
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

    info("Generating + uploading fake receipts with near-expiration overrides...")
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
                upload_and_confirm_near_expiration_receipt(
                    sessions[index],
                    base_url,
                    user,
                    RECEIPTS_BY_USER[index],
                )
            except Exception as exc:
                warn(f"  {user['username']}: near-expiration receipt step failed ({exc})")

    if not args.skip_expiration_check:
        try:
            run_expiration_check()
        except subprocess.CalledProcessError as exc:
            fail(f"check_expirations exited with status {exc.returncode}.")
            sys.exit(1)

    print()
    print("seed_demo_data_2 completed.")
    print("This demo seeds the normal app flow, then confirms receipt items with")
    print("expiration_days forced to 0 / 1 / 3 so expiration notifications fire immediately.")


if __name__ == "__main__":
    main()
