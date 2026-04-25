from django.urls import path

from .views import AuthMeView, CSRFView, LoginView, LogoutView, RefreshView, SignupView

urlpatterns = [
    path("csrf/", CSRFView.as_view(), name="auth-csrf"),
    path("signup/", SignupView.as_view(), name="auth-signup"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("me/", AuthMeView.as_view(), name="auth-me"),
]
