from django.urls import path

from .views import (
    IncomingPostRequestListView,
    MyPostListView,
    NotificationListView,
    NotificationReadView,
    OutgoingPostRequestListView,
    PostClaimView,
    PostCreateView,
    PostDetailView,
    PostFeedView,
    PostLocationResolveView,
    PostRequestActionView,
    PostRequestMessageListCreateView,
)

urlpatterns = [
    path("share/", PostCreateView.as_view(), name="share-create"),
    path("share/feed/", PostFeedView.as_view(), name="share-feed"),
    path("share/location/resolve/", PostLocationResolveView.as_view(), name="share-location-resolve"),
    path("share/mine/", MyPostListView.as_view(), name="share-mine"),
    path("share/requests/incoming/", IncomingPostRequestListView.as_view(), name="share-request-incoming"),
    path("share/requests/outgoing/", OutgoingPostRequestListView.as_view(), name="share-request-outgoing"),
    path(
        "share/requests/<int:request_id>/messages/",
        PostRequestMessageListCreateView.as_view(),
        name="share-request-messages",
    ),
    path(
        "share/requests/<int:request_id>/<str:action>/",
        PostRequestActionView.as_view(),
        name="share-request-action",
    ),
    path("share/<int:pk>/", PostDetailView.as_view(), name="share-detail"),
    path("share/<int:post_id>/claim/", PostClaimView.as_view(), name="share-claim"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:notification_id>/read/", NotificationReadView.as_view(), name="notification-read"),
]
