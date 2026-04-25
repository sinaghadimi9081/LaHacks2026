from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from core.models import FoodItem
from core.notifications import NotificationService

class Command(BaseCommand):
    help = 'Check for expiring food items and send notifications to household members.'

    def handle(self, *args, **options):
        today = timezone.now().date()
        
        # We check for items expiring in 0, 1, and 3 days
        expiration_check_points = [
            (0, "expiring today"),
            (1, "expiring tomorrow"),
            (3, "expiring in 3 days"),
        ]

        for days, label in expiration_check_points:
            target_date = today + timedelta(days=days)
            items = FoodItem.objects.filter(
                expiration_date=target_date,
                status='available',
                household__isnull=False
            ).select_related('household')

            self.stdout.write(f"Checking items {label} ({target_date})... found {items.count()} items.")

            for item in items:
                NotificationService.notify_household_expiration(
                    household=item.household,
                    food_item=item,
                    days_left=days
                )
                self.stdout.write(self.style.SUCCESS(f"Notification sent for {item.name} in household {item.household.name}"))

        self.stdout.write(self.style.SUCCESS("Expiration check complete."))
