from django.utils import timezone
from rest_framework import serializers

from users.models import User

from .models import Household, HouseholdInvitation, HouseholdMembership


class HouseholdMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    display_name = serializers.CharField(source="user.full_display_name", read_only=True)

    class Meta:
        model = HouseholdMembership
        fields = [
            "user_id",
            "username",
            "email",
            "display_name",
            "role",
            "status",
            "can_upload_receipts",
            "can_post_share",
            "can_manage_members",
            "joined_at",
        ]


class HouseholdSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()

    class Meta:
        model = Household
        fields = ["id", "name", "created_at", "members"]
        read_only_fields = ["id", "created_at", "members"]

    def get_members(self, obj):
        memberships = obj.memberships.select_related("user").order_by("id")
        return HouseholdMemberSerializer(memberships, many=True).data


class HouseholdInvitationSerializer(serializers.ModelSerializer):
    household_name = serializers.CharField(source="household.name", read_only=True)
    invited_by_name = serializers.CharField(source="invited_by.full_display_name", read_only=True)
    invited_user_id = serializers.IntegerField(source="invited_user.id", read_only=True)

    class Meta:
        model = HouseholdInvitation
        fields = [
            "id",
            "household_name",
            "invited_email",
            "invited_user_id",
            "invited_by_name",
            "status",
            "created_at",
            "responded_at",
        ]


class HouseholdInvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        request = self.context["request"]
        household = self.context["household"]
        normalized_email = value.strip().lower()

        if request.user.email.lower() == normalized_email:
            raise serializers.ValidationError("You cannot invite yourself to this household.")

        invited_user = User.objects.filter(email__iexact=normalized_email).first()
        if invited_user is None:
            raise serializers.ValidationError("No user exists with that email yet.")

        is_member = HouseholdMembership.objects.filter(
            household=household,
            user=invited_user,
            status=HouseholdMembership.Status.ACTIVE,
        ).exists()
        if is_member:
            raise serializers.ValidationError("That user already belongs to this household.")

        has_pending_invite = HouseholdInvitation.objects.filter(
            household=household,
            invited_email=normalized_email,
            status=HouseholdInvitation.Status.PENDING,
        ).exists()
        if has_pending_invite:
            raise serializers.ValidationError("There is already a pending invite for that email.")

        self.context["invited_user"] = invited_user
        return normalized_email

    def create(self, validated_data):
        household = self.context["household"]
        request = self.context["request"]
        invited_user = self.context["invited_user"]

        return HouseholdInvitation.objects.create(
            household=household,
            invited_by=request.user,
            invited_user=invited_user,
            invited_email=validated_data["email"],
        )


class HouseholdMemberPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HouseholdMembership
        fields = ["can_upload_receipts", "can_post_share", "can_manage_members"]

    def validate_can_manage_members(self, value):
        if value and self.instance.role != HouseholdMembership.Role.OWNER:
            raise serializers.ValidationError("Only owners can manage members.")
        return value


def accept_invitation(invitation, user):
    membership, created = HouseholdMembership.objects.get_or_create(
        household=invitation.household,
        user=user,
        defaults={
            "role": HouseholdMembership.Role.MEMBER,
            "status": HouseholdMembership.Status.ACTIVE,
            "can_upload_receipts": True,
            "can_post_share": False,
            "can_manage_members": False,
        },
    )

    if not created and membership.status != HouseholdMembership.Status.ACTIVE:
        membership.status = HouseholdMembership.Status.ACTIVE
        membership.save(update_fields=["status"])

    invitation.status = HouseholdInvitation.Status.ACCEPTED
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=["status", "responded_at"])

    if user.default_household_id is None:
        user.default_household = invitation.household
        user.save(update_fields=["default_household"])

    return membership
