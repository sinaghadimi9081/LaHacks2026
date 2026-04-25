from rest_framework import serializers

from .models import Household, HouseholdMembership


class HouseholdMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    display_name = serializers.CharField(source="user.full_display_name", read_only=True)

    class Meta:
        model = HouseholdMembership
        fields = ["user_id", "username", "email", "display_name", "role", "status", "joined_at"]


class HouseholdSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()

    class Meta:
        model = Household
        fields = ["id", "name", "created_at", "members"]
        read_only_fields = ["id", "created_at", "members"]

    def get_members(self, obj):
        memberships = obj.memberships.select_related("user").order_by("id")
        return HouseholdMemberSerializer(memberships, many=True).data
