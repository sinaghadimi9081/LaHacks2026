from django.urls import path

from .views import ImpactLogListView, MarketplaceProfileDetailView, MarketplaceProfileView, MeView

urlpatterns = [
    path("me/", MeView.as_view(), name="users-me"),
    path("me/impact/", ImpactLogListView.as_view(), name="users-me-impact"),
    path("profile/", MarketplaceProfileView.as_view(), name="users-profile"),
    path("profile/<int:user_id>/", MarketplaceProfileDetailView.as_view(), name="users-profile-detail"),
]
