from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User


@override_settings(
    AUTH_COOKIE_ACCESS="test_access",
    AUTH_COOKIE_REFRESH="test_refresh",
)
class HouseholdEndpointTests(APITestCase):
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
