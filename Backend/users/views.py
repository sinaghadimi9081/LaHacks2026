from django.conf import settings
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from core.notifications import NotificationService
from households.models import HouseholdMembership

from .models import User
from .serializers import (
    LoginSerializer,
    MarketplaceProfileSerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
    UserSerializer,
)


def set_auth_cookies(response, access_token, refresh_token=None):
    cookie_kwargs = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "domain": settings.AUTH_COOKIE_DOMAIN,
        "path": "/",
    }
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        access_token,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        **cookie_kwargs,
    )
    if refresh_token is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH,
            refresh_token,
            max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            **cookie_kwargs,
        )


def clear_auth_cookies(response):
    response.delete_cookie(
        settings.AUTH_COOKIE_ACCESS,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def auth_response_for_user(user, request, status_code=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    response = Response(
        {"user": serialize_user(user, request=request)},
        status=status_code,
    )
    set_auth_cookies(response, str(refresh.access_token), str(refresh))
    response.data["csrfToken"] = get_token(request)
    return response


def serialize_user(user, request=None):
    memberships = HouseholdMembership.objects.filter(user=user).select_related("household")
    households = [membership.household for membership in memberships]
    memberships_by_household = {
        membership.household_id: membership
        for membership in memberships
    }
    return UserSerializer(
        user,
        context={
            "request": request,
            "households": households,
            "memberships_by_household": memberships_by_household,
        },
    ).data


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        NotificationService.notify_welcome(user)

        return auth_response_for_user(user, request, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return auth_response_for_user(user, request)


class LogoutView(APIView):
    def post(self, request):
        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        response = Response({"detail": "Logged out."}, status=status.HTTP_200_OK)
        clear_auth_cookies(response)
        return response


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH) or request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token not provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)

        response = Response(
            {"detail": "Token refreshed.", "csrfToken": get_token(request)},
            status=status.HTTP_200_OK,
        )
        set_auth_cookies(
            response,
            serializer.validated_data["access"],
            serializer.validated_data.get("refresh"),
        )
        return response


@method_decorator(ensure_csrf_cookie, name="dispatch")
class AuthMeView(APIView):
    def get(self, request):
        response = Response(
            {"user": serialize_user(request.user, request=request)},
            status=status.HTTP_200_OK,
        )
        response.data["csrfToken"] = get_token(request)
        return response


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileUpdateSerializer

    def get_object(self):
        return self.request.user

    def get(self, request, *args, **kwargs):
        return Response(
            {"user": serialize_user(request.user, request=request)},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, *args, **kwargs):
        response = super().patch(request, *args, **kwargs)
        response.data = {"user": serialize_user(request.user, request=request)}
        return response


class MarketplaceProfileView(APIView):
    def get(self, request):
        serializer = MarketplaceProfileSerializer(request.user, context={"request": request})
        return Response({"profile": serializer.data}, status=status.HTTP_200_OK)


class MarketplaceProfileDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = MarketplaceProfileSerializer
    lookup_url_kwarg = "user_id"

    def get(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, context={"request": request})
        return Response({"profile": serializer.data}, status=status.HTTP_200_OK)


class ImpactLogListView(APIView):
    """Return paginated impact-log history and cumulative totals for the
    authenticated user.  ``GET /api/users/me/impact/``"""

    def get(self, request):
        from core.models import ImpactLog

        logs = (
            ImpactLog.objects
            .filter(user=request.user)
            .order_by("-created_at")
            .values(
                "id",
                "action",
                "dollars_saved",
                "water_saved_gallons",
                "co2_saved_kg",
                "electricity_saved_kwh",
                "created_at",
            )
        )

        user = request.user
        return Response(
            {
                "logs": list(logs),
                "totals": {
                    "water_saved_gallons": str(user.total_water_saved_gallons),
                    "co2_saved_kg": str(user.total_co2_saved_kg),
                    "electricity_saved_kwh": str(user.total_electricity_saved_kwh),
                    "total_posts_shared": user.total_posts_shared,
                },
            },
            status=status.HTTP_200_OK,
        )
