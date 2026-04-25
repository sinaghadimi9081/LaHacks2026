from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from households.models import HouseholdMembership
from users.models import User


@override_settings(
    AUTH_COOKIE_ACCESS="test_access",
    AUTH_COOKIE_REFRESH="test_refresh",
)
class AuthFlowTests(APITestCase):
    def test_signup_creates_user_and_default_household(self):
        response = self.client.post(
            reverse("auth-signup"),
            {
                "username": "sina",
                "email": "sina@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "display_name": "Sina",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn(settings.AUTH_COOKIE_ACCESS, response.cookies)
        self.assertIn(settings.AUTH_COOKIE_REFRESH, response.cookies)

        user = User.objects.get(username="sina")
        self.assertEqual(user.email, "sina@example.com")
        self.assertIsNotNone(user.default_household)

        membership = HouseholdMembership.objects.get(user=user, household=user.default_household)
        self.assertEqual(membership.role, HouseholdMembership.Role.OWNER)

    def test_login_by_email_returns_current_user(self):
        signup = self.client.post(
            reverse("auth-signup"),
            {
                "username": "neighbor",
                "email": "neighbor@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )
        refresh = signup.cookies[settings.AUTH_COOKIE_REFRESH].value
        self.client.cookies.clear()

        response = self.client.post(
            reverse("auth-login"),
            {"identifier": "neighbor@example.com", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.cookies[settings.AUTH_COOKIE_ACCESS] = response.cookies[settings.AUTH_COOKIE_ACCESS].value
        self.client.cookies["csrftoken"] = response.data["csrfToken"]

        me_response = self.client.get(reverse("auth-me"))
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["user"]["username"], "neighbor")

        refresh_response = self.client.post(reverse("auth-refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
