import logging

from django.conf import settings
from django.core.mail import send_mail
from .models import Notification
from households.models import HouseholdMembership

logger = logging.getLogger(__name__)


class NotificationService:
    # ------------------------------------------------------------------ #
    #  Household expiration alerts (existing)
    # ------------------------------------------------------------------ #
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

    # ------------------------------------------------------------------ #
    #  Welcome email - sent when a new account is created
    # ------------------------------------------------------------------ #
    @staticmethod
    def notify_welcome(user):
        title = "Welcome to NeighborFridge!"
        message = (
            f"Hi {user.full_display_name},\n\n"
            "Thanks for joining NeighborFridge - the easiest way to reduce food waste "
            "and share with your neighbors.\n\n"
            "Here's how to get started:\n"
            "  1. Upload a receipt to auto-track your groceries.\n"
            "  2. Check your pantry for items close to expiring.\n"
            "  3. Share food you won't use before it goes bad.\n\n"
            "Happy saving!\n"
            "- The NeighborFridge Team"
        )
        NotificationService._send_website_notification(user, title, message)
        NotificationService._send_email(user, title, message)

    # ------------------------------------------------------------------ #
    #  New share post - email the poster confirming their listing
    # ------------------------------------------------------------------ #
    @staticmethod
    def notify_new_share_post(share_post):
        user = share_post.owner
        if not user:
            return

        title = f'Your item "{share_post.title}" is now listed!'
        message = (
            f"Hi {user.full_display_name},\n\n"
            f'Your share post "{share_post.title}" has been published on NeighborFridge.\n\n'
            f"  Pickup: {share_post.pickup_location}\n"
            f"  Item: {share_post.resolved_item_name}\n\n"
            "Neighbors near you can now see and request this item. "
            "We'll notify you when someone sends a claim request.\n\n"
            "- The NeighborFridge Team"
        )
        NotificationService._send_website_notification(user, title, message)
        NotificationService._send_email(user, title, message)

    # ------------------------------------------------------------------ #
    #  Claim request - email the post owner when someone claims their item
    # ------------------------------------------------------------------ #
    @staticmethod
    def notify_claim_request(share_post, claimer):
        owner = share_post.owner
        if not owner:
            return

        title = f'Someone wants your "{share_post.title}"!'
        message = (
            f"Hi {owner.full_display_name},\n\n"
            f'{claimer.full_display_name} has requested to pick up your item '
            f'"{share_post.title}".\n\n'
            f"  Pickup: {share_post.pickup_location}\n"
            f"  Item: {share_post.resolved_item_name}\n\n"
            "Log in to NeighborFridge to approve or manage this request.\n\n"
            "- The NeighborFridge Team"
        )
        NotificationService._send_website_notification(owner, title, message)
        NotificationService._send_email(owner, title, message)

    # ------------------------------------------------------------------ #
    #  Low-level delivery channels
    # ------------------------------------------------------------------ #
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
        try:
            send_mail(
                subject=title,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            logger.exception("Failed to send email to %s", user.email)

    @staticmethod
    def _send_push_notification(user, title, message):
        # Placeholder for mobile push notification logic
        pass

    @staticmethod
    def _ping_app(user, title, message):
        # Placeholder for in-app real-time ping
        pass
