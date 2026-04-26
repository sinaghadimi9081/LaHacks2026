from django.urls import path

from .views import (
    MySharePostListView,
    NotificationListView,
    NotificationReadView,
    SharePostClaimView,
    SharePostCreateView,
    SharePostDetailView,
    SharePostFeedView,
)

urlpatterns = [
    path("share/", SharePostCreateView.as_view(), name="share-create"),
    path("share/feed/", SharePostFeedView.as_view(), name="share-feed"),
    path("share/mine/", MySharePostListView.as_view(), name="share-mine"),
    path("share/<int:pk>/", SharePostDetailView.as_view(), name="share-detail"),
    path("share/<int:share_post_id>/claim/", SharePostClaimView.as_view(), name="share-claim"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:notification_id>/read/", NotificationReadView.as_view(), name="notification-read"),
]
