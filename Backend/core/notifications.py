from django.conf import settings
from django.core.mail import send_mail
from .models import Notification
from households.models import HouseholdMembership

class NotificationService:
    @staticmethod
    def notify_household_expiration(household, food_item, days_left):
        """
        Notifies all active members of a household about an expiring food item.
        """
        memberships = HouseholdMembership.objects.filter(
            household=household,
            status=HouseholdMembership.Status.ACTIVE
        ).select_related('user')

        title = f"Expiration Alert: {food_item.name}"
        if days_left == 0:
            message = f"Your {food_item.name} expires today! Use it now or share it with neighbors."
        elif days_left == 1:
            message = f"Your {food_item.name} expires tomorrow. Consider cooking it or sharing it."
        else:
            message = f"Your {food_item.name} will expire in {days_left} days. Plan ahead!"

        for membership in memberships:
            user = membership.user
            # 1. Website Notification
            NotificationService._send_website_notification(user, title, message)
            
            # 2. Email Notification
            NotificationService._send_email(user, title, message)
            
            # 3. Mobile App Push (Placeholder)
            NotificationService._send_push_notification(user, title, message)
            
            # 4. App Ping (Placeholder)
            NotificationService._ping_app(user, title, message)

    @staticmethod
    def _send_website_notification(user, title, message):
        Notification.objects.create(
            user=user,
            title=title,
            message=message
        )

    @staticmethod
    def _send_email(user, title, message):
        if not user.email:
            return
        
        send_mail(
            subject=title,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

    @staticmethod
    def _send_push_notification(user, title, message):
        # Placeholder for mobile push notification logic
        pass

    @staticmethod
    def _ping_app(user, title, message):
        # Placeholder for in-app real-time ping
        pass
