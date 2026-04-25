from django.urls import path

from .views import (
    MySharePostListView,
    ShareLocationResolveView,
    SharePostClaimView,
    SharePostCreateView,
    SharePostDetailView,
    SharePostFeedView,
)

urlpatterns = [
    path("share/", SharePostCreateView.as_view(), name="share-create"),
    path("share/feed/", SharePostFeedView.as_view(), name="share-feed"),
    path("share/location/resolve/", ShareLocationResolveView.as_view(), name="share-location-resolve"),
    path("share/mine/", MySharePostListView.as_view(), name="share-mine"),
    path("share/<int:pk>/", SharePostDetailView.as_view(), name="share-detail"),
    path("share/<int:share_post_id>/claim/", SharePostClaimView.as_view(), name="share-claim"),
]
