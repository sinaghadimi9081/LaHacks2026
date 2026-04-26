from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HouseholdInvitation, HouseholdMembership
from .serializers import (
    HouseholdInvitationCreateSerializer,
    HouseholdInvitationSerializer,
    HouseholdMemberPermissionSerializer,
    HouseholdMemberSerializer,
    HouseholdSerializer,
    accept_invitation,
)


def current_household_membership(user):
    if not user.default_household_id:
        raise PermissionDenied("You do not have an active household.")

    membership = HouseholdMembership.objects.filter(
        household_id=user.default_household_id,
        user=user,
        status=HouseholdMembership.Status.ACTIVE,
    ).first()
    if membership is None:
        raise PermissionDenied("You do not have access to that household.")
    return membership


def require_member_manager(user):
    membership = current_household_membership(user)
    if not membership.can_manage_members and membership.role != HouseholdMembership.Role.OWNER:
        raise PermissionDenied("You do not have permission to manage members.")
    return membership


class HouseholdMeView(generics.RetrieveUpdateAPIView):
    serializer_class = HouseholdSerializer

    def get_object(self):
        return self.request.user.default_household

    def get(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response({"household": serializer.data})

    def patch(self, request, *args, **kwargs):
        response = super().patch(request, *args, **kwargs)
        response.data = {"household": response.data}
        return response


class HouseholdMembersView(APIView):
    def get(self, request):
        household = current_household_membership(request.user).household
        memberships = household.memberships.select_related("user").order_by("id")
        serializer = HouseholdMemberSerializer(memberships, many=True)
        return Response({"members": serializer.data}, status=status.HTTP_200_OK)


class HouseholdMemberDetailView(APIView):
    def get_object(self, request, user_id):
        household = require_member_manager(request.user).household
        return get_object_or_404(
            HouseholdMembership.objects.select_related("user"),
            household=household,
            user_id=user_id,
        )

    def patch(self, request, user_id):
        membership = self.get_object(request, user_id)
        serializer = HouseholdMemberPermissionSerializer(
            membership,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"member": HouseholdMemberSerializer(membership).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, user_id):
        membership = self.get_object(request, user_id)

        if membership.user_id == request.user.id:
            return Response(
                {"detail": "Use a leave-household flow instead of removing yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if membership.role == HouseholdMembership.Role.OWNER:
            return Response(
                {"detail": "Owners cannot be removed from the household."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership.delete()
        return Response({"detail": "Member removed."}, status=status.HTTP_200_OK)


class HouseholdInvitationListCreateView(APIView):
    def get(self, request):
        household = current_household_membership(request.user).household
        invitations = household.invitations.select_related("invited_by", "invited_user").all()
        serializer = HouseholdInvitationSerializer(invitations, many=True)
        return Response({"invitations": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        household = require_member_manager(request.user).household
        serializer = HouseholdInvitationCreateSerializer(
            data=request.data,
            context={"request": request, "household": household},
        )
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()
        return Response(
            {"invitation": HouseholdInvitationSerializer(invitation).data},
            status=status.HTTP_201_CREATED,
        )


class IncomingInvitationListView(APIView):
    def get(self, request):
        invitations = HouseholdInvitation.objects.filter(
            invited_user=request.user,
            status=HouseholdInvitation.Status.PENDING,
        ).select_related("household", "invited_by")
        serializer = HouseholdInvitationSerializer(invitations, many=True)
        return Response({"invitations": serializer.data}, status=status.HTTP_200_OK)


class HouseholdInvitationActionView(APIView):
    def get_object(self, request, invitation_id):
        return get_object_or_404(
            HouseholdInvitation.objects.select_related("household", "invited_by", "invited_user"),
            id=invitation_id,
            invited_user=request.user,
            status=HouseholdInvitation.Status.PENDING,
        )

    def patch(self, request, invitation_id, action):
        invitation = self.get_object(request, invitation_id)

        if action == "accept":
            accept_invitation(invitation, request.user)
        elif action == "decline":
            invitation.status = HouseholdInvitation.Status.DECLINED
            invitation.responded_at = timezone.now()
            invitation.save(update_fields=["status", "responded_at"])
        else:
            return Response({"detail": "Unsupported invitation action."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"invitation": HouseholdInvitationSerializer(invitation).data},
            status=status.HTTP_200_OK,
        )
