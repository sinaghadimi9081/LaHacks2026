from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)

        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token

        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if not raw_token:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception:
            # Treat invalid/expired cookies as anonymous so public endpoints
            # (like /api/auth/csrf/) still work even when the browser has stale
            # auth cookies from a prior session.
            return None
        self.enforce_csrf(request)
        return self.get_user(validated_token), validated_token

    def enforce_csrf(self, request):
        check = CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
