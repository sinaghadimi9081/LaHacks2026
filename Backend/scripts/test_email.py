#!/usr/bin/env python3
"""
Send a quick email using the current Django settings.

Examples:
    python scripts/test_email.py you@example.com
    python scripts/test_email.py you@example.com --subject "NeighborFridge test"
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.core.mail import send_mail  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a test email using Django settings.")
    parser.add_argument("recipient", help="Email address that should receive the test message.")
    parser.add_argument(
        "--subject",
        default="NeighborFridge test email",
        help="Subject line for the test email.",
    )
    parser.add_argument(
        "--message",
        default="NeighborFridge email is configured correctly.",
        help="Body content for the test email.",
    )
    args = parser.parse_args()

    delivered = send_mail(
        subject=args.subject,
        message=args.message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[args.recipient],
        fail_silently=False,
    )

    print(
        f"EMAIL_BACKEND={settings.EMAIL_BACKEND}\n"
        f"DEFAULT_FROM_EMAIL={settings.DEFAULT_FROM_EMAIL}\n"
        f"Delivered messages: {delivered}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
