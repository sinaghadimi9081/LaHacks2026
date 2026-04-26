#!/usr/bin/env python3
"""
Best-effort CA bundle bootstrap for Python SMTP/HTTPS on local machines.

Why this exists:
- Some macOS Python installs do not have OpenSSL wired to a usable CA bundle.
- Django's SMTP backend uses Python's ssl module directly, so installing
  certifi alone is not always enough.

This script mirrors the practical effect of Python's "Install Certificates"
helper by pointing Python's OpenSSL CA file at certifi's bundle. It is safe
to run multiple times.
"""

from __future__ import annotations

import argparse
import shutil
import ssl
import sys
from pathlib import Path

import certifi


def install_cert_bundle(dry_run: bool = False) -> int:
    verify_paths = ssl.get_default_verify_paths()
    openssl_cafile = verify_paths.openssl_cafile

    if not openssl_cafile:
        print("No OpenSSL CA file path was reported by this Python build. Skipping.")
        return 0

    target = Path(openssl_cafile)
    source = Path(certifi.where())

    print(f"Python OpenSSL CA file: {target}")
    print(f"certifi bundle: {source}")

    try:
        if target.exists() or target.is_symlink():
            try:
                if target.resolve() == source.resolve():
                    print("Certificate bundle is already configured.")
                    return 0
            except OSError:
                pass
    except OSError:
        pass

    if dry_run:
        print("Dry run only. No files were changed.")
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists() or target.is_symlink():
        target.unlink()

    try:
        target.symlink_to(source)
        print("Installed certificate bundle via symlink.")
    except OSError:
        shutil.copyfile(source, target)
        print("Installed certificate bundle via copy.")

    target.chmod(0o644)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Install certifi's CA bundle for this Python runtime.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the target/source paths without changing anything.",
    )
    args = parser.parse_args()

    try:
        return install_cert_bundle(dry_run=args.dry_run)
    except PermissionError as exc:
        print(
            "Could not update the Python CA bundle automatically. "
            "Run this script with a Python install you control, or run your platform's "
            "certificate bootstrap helper manually.",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Certificate bootstrap failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
