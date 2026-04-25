from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "project": "Backend",
            "message": "Django REST API is ready.",
            "auth": {
                "login": "/api/auth/login/",
                "logout": "/api/auth/logout/",
                "register": "/api/auth/registration/",
                "user": "/api/auth/user/",
                "token_refresh": "/api/auth/token/refresh/",
                "token_verify": "/api/auth/token/verify/",
            },
        }
    )
