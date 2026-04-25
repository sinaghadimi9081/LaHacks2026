from django.urls import path

from .views import (
    HouseholdInvitationActionView,
    HouseholdInvitationListCreateView,
    HouseholdMeView,
    HouseholdMemberDetailView,
    HouseholdMembersView,
    IncomingInvitationListView,
)

urlpatterns = [
    path("me/", HouseholdMeView.as_view(), name="household-me"),
    path("me/members/", HouseholdMembersView.as_view(), name="household-members"),
    path("members/<int:user_id>/", HouseholdMemberDetailView.as_view(), name="household-member-detail"),
    path("me/invitations/", HouseholdInvitationListCreateView.as_view(), name="household-invitations"),
    path("invitations/", IncomingInvitationListView.as_view(), name="incoming-household-invitations"),
    path(
        "invitations/<int:invitation_id>/<str:action>/",
        HouseholdInvitationActionView.as_view(),
        name="household-invitation-action",
    ),
]
