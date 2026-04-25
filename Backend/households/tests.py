from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from households.models import HouseholdInvitation, HouseholdMembership
from users.models import User


@override_settings(
    AUTH_COOKIE_ACCESS="test_access",
    AUTH_COOKIE_REFRESH="test_refresh",
)
class HouseholdEndpointTests(APITestCase):
    def create_user(self, username, email):
        user = User.objects.create_user(
            username=username,
            email=email,
            password="StrongPass123!",
            display_name=username.title(),
        )
        household_name = f"{username.title()}'s Fridge"
        household = user.created_households.model.objects.create(name=household_name, created_by=user)
        HouseholdMembership.objects.create(
            user=user,
            household=household,
            role=HouseholdMembership.Role.OWNER,
            status=HouseholdMembership.Status.ACTIVE,
            can_upload_receipts=True,
            can_post_share=True,
            can_manage_members=True,
        )
        user.default_household = household
        user.save(update_fields=["default_household"])
        return user

    def test_user_can_update_default_household_name(self):
        signup_response = self.client.post(
            reverse("auth-signup"),
            {
                "username": "owner",
                "email": "owner@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )

        self.client.cookies[settings.AUTH_COOKIE_ACCESS] = signup_response.cookies[settings.AUTH_COOKIE_ACCESS].value
        self.client.cookies["csrftoken"] = signup_response.data["csrfToken"]

        response = self.client.patch(
            reverse("household-me"),
            {"name": "Family Fridge"},
            format="json",
            HTTP_X_CSRFTOKEN=signup_response.data["csrfToken"],
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["household"]["name"], "Family Fridge")

        user = User.objects.get(username="owner")
        self.assertEqual(user.default_household.name, "Family Fridge")

    def test_owner_can_invite_existing_user_to_household(self):
        owner = self.create_user("owner", "owner@example.com")
        invited = self.create_user("friend", "friend@example.com")

        self.client.force_authenticate(user=owner)
        response = self.client.post(
            reverse("household-invitations"),
            {"email": invited.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["invitation"]["invited_email"], invited.email)
        self.assertTrue(
            HouseholdInvitation.objects.filter(
                household=owner.default_household,
                invited_user=invited,
                status=HouseholdInvitation.Status.PENDING,
            ).exists()
        )

    def test_invited_user_can_accept_household_invitation(self):
        owner = self.create_user("owner", "owner@example.com")
        invited = self.create_user("friend", "friend@example.com")
        invitation = HouseholdInvitation.objects.create(
            household=owner.default_household,
            invited_by=owner,
            invited_user=invited,
            invited_email=invited.email,
        )

        self.client.force_authenticate(user=invited)
        response = self.client.patch(
            reverse(
                "household-invitation-action",
                kwargs={"invitation_id": invitation.id, "action": "accept"},
            ),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        membership = HouseholdMembership.objects.get(
            household=owner.default_household,
            user=invited,
        )
        self.assertEqual(membership.status, HouseholdMembership.Status.ACTIVE)
        self.assertTrue(membership.can_upload_receipts)
        self.assertFalse(membership.can_post_share)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, HouseholdInvitation.Status.ACCEPTED)

    def test_owner_can_remove_member_from_household(self):
        owner = self.create_user("owner", "owner@example.com")
        invited = self.create_user("friend", "friend@example.com")
        HouseholdMembership.objects.create(
            household=owner.default_household,
            user=invited,
            role=HouseholdMembership.Role.MEMBER,
            status=HouseholdMembership.Status.ACTIVE,
            can_upload_receipts=True,
            can_post_share=False,
            can_manage_members=False,
        )

        self.client.force_authenticate(user=owner)
        response = self.client.delete(
            reverse("household-member-detail", kwargs={"user_id": invited.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            HouseholdMembership.objects.filter(
                household=owner.default_household,
                user=invited,
            ).exists()
        )
