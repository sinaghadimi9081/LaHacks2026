"""Delete the demo users seeded by scripts/seed_demo_data.py.

Cascades across Household, HouseholdMembership, Post (owned), Receipt
(uploaded), and ParsedReceiptItem. Useful when seed_demo_data.py reports
'A user with that username already exists' but login fails because the
existing password doesn't match the seed script's shared password.

Examples:
    python manage.py reset_demo_users
    python manage.py reset_demo_users --usernames sinaghadimi mina
    python manage.py reset_demo_users --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from users.models import User


# Keep in sync with scripts/seed_demo_data.py.
DEMO_USERNAMES = ["sinaghadimi", "shervinss", "mina", "tina", "hida"]


class Command(BaseCommand):
    help = (
        "Delete the demo users created by seed_demo_data.py "
        "(plus cascaded households, posts, and receipts)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--usernames",
            nargs="*",
            default=DEMO_USERNAMES,
            help=f"Usernames to delete (default: {' '.join(DEMO_USERNAMES)})",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show which users would be deleted without deleting anything.",
        )

    def handle(self, *args, **options):
        usernames = options["usernames"]
        users = User.objects.filter(username__in=usernames)
        found = list(users.values_list("username", flat=True))

        if not found:
            self.stdout.write(self.style.WARNING(
                f"No matching users found among: {', '.join(usernames)}"
            ))
            return

        self.stdout.write(f"Matched {len(found)} demo user(s): {', '.join(found)}")

        if options["dry_run"]:
            self.stdout.write(self.style.NOTICE("--dry-run set; nothing was deleted."))
            return

        with transaction.atomic():
            deleted_count, deleted_by_model = users.delete()

        self.stdout.write(self.style.SUCCESS(
            f"Deleted {deleted_count} row(s) across cascaded tables."
        ))
        for model_label, row_count in sorted(deleted_by_model.items()):
            self.stdout.write(f"  · {model_label}: {row_count}")
