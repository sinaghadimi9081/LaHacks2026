from django.urls import path

from .views import (
    MyPostListView,
    NotificationListView,
    NotificationReadView,
    PostClaimView,
    PostCreateView,
    PostDetailView,
    PostFeedView,
    PostLocationResolveView,
)

urlpatterns = [
    path("share/", PostCreateView.as_view(), name="share-create"),
    path("share/feed/", PostFeedView.as_view(), name="share-feed"),
    path("share/location/resolve/", PostLocationResolveView.as_view(), name="share-location-resolve"),
    path("share/mine/", MyPostListView.as_view(), name="share-mine"),
    path("share/<int:pk>/", PostDetailView.as_view(), name="share-detail"),
    path("share/<int:post_id>/claim/", PostClaimView.as_view(), name="share-claim"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:notification_id>/read/", NotificationReadView.as_view(), name="notification-read"),
]
