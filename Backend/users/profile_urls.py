from django.urls import path

from .views import MarketplaceProfileDetailView, MarketplaceProfileView, MeView

urlpatterns = [
    path("me/", MeView.as_view(), name="users-me"),
    path("profile/", MarketplaceProfileView.as_view(), name="users-profile"),
    path("profile/<int:user_id>/", MarketplaceProfileDetailView.as_view(), name="users-profile-detail"),
]
