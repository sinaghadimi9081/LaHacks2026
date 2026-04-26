#!/usr/bin/env python3

import sqlite3
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BASE_DIR / "db.sqlite3"


def table_exists(cursor, table_name):
    row = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def main():
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DB_PATH
    if not db_path.exists():
        print(f"No SQLite database found at {db_path}, skipping receipts app rename.")
        return 0

    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()

    cursor.execute("PRAGMA foreign_keys = OFF;")

    if table_exists(cursor, "api_receipt") and not table_exists(cursor, "receipts_receipt"):
      cursor.execute("ALTER TABLE api_receipt RENAME TO receipts_receipt;")

    if table_exists(cursor, "api_parsedreceiptitem") and not table_exists(cursor, "receipts_parsedreceiptitem"):
      cursor.execute("ALTER TABLE api_parsedreceiptitem RENAME TO receipts_parsedreceiptitem;")

    cursor.execute(
        """
        UPDATE django_migrations
        SET app = 'receipts'
        WHERE app = 'api'
        """
    )
    cursor.execute(
        """
        UPDATE django_content_type
        SET app_label = 'receipts'
        WHERE app_label = 'api'
        """
    )

    connection.commit()
    connection.close()
    print(f"Receipts app label migration completed for {db_path}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
