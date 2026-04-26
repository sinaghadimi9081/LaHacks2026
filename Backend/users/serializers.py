from decimal import Decimal

from django.contrib.auth import password_validation
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from households.models import Household, HouseholdMembership

from .models import User


class HouseholdSummarySerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Household
        fields = ["id", "name", "role", "status", "created_at"]

    def _membership(self, obj):
        memberships = self.context.get("memberships_by_household", {})
        return memberships.get(obj.id)

    def get_role(self, obj):
        membership = self._membership(obj)
        return membership.role if membership else None

    def get_status(self, obj):
        membership = self._membership(obj)
        return membership.status if membership else None


class UserSerializer(serializers.ModelSerializer):
    default_household = serializers.SerializerMethodField()
    households = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "display_name",
            "first_name",
            "last_name",
            "credits_balance",
            "profile_image_url",
            "default_household",
            "households",
            "date_joined",
            "total_water_saved_gallons",
            "total_co2_saved_kg",
            "total_electricity_saved_kwh",
            "total_posts_shared",
        ]
        read_only_fields = [
            "id",
            "date_joined",
            "households",
            "credits_balance",
            "total_water_saved_gallons",
            "total_co2_saved_kg",
            "total_electricity_saved_kwh",
            "total_posts_shared",
        ]

    def get_profile_image_url(self, obj):
        if not obj.profile_image:
            return ""

        request = self.context.get("request")
        if request is None:
            return obj.profile_image.url
        return request.build_absolute_uri(obj.profile_image.url)

    def get_default_household(self, obj):
        memberships = self.context.get("memberships_by_household", {})
        if not obj.default_household_id:
            return None
        serializer = HouseholdSummarySerializer(
            obj.default_household,
            context={"memberships_by_household": memberships},
        )
        return serializer.data

    def get_households(self, obj):
        memberships = self.context.get("memberships_by_household", {})
        households = self.context.get("households") or []
        serializer = HouseholdSummarySerializer(
            households,
            many=True,
            context={"memberships_by_household": memberships},
        )
        return serializer.data


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    household_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        password_validation.validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        household_name = validated_data.pop("household_name", "").strip()
        validated_data.pop("password_confirm")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            display_name=validated_data.get("display_name", "").strip(),
            credits_balance=Decimal("10.00"),
        )

        if not household_name:
            base_name = user.display_name or user.username
            household_name = f"{base_name}'s Fridge"

        household = Household.objects.create(
            name=household_name,
            created_by=user,
        )
        HouseholdMembership.objects.create(
            user=user,
            household=household,
            role=HouseholdMembership.Role.OWNER,
            status=HouseholdMembership.Status.ACTIVE,
            can_upload_receipts=True,
            can_post_share=True,
            can_manage_members=True,
        )
        user.default_household = household
        user.save(update_fields=["default_household"])

        def grant_signup_bonus(user_id):
            try:
                from lockers.models import CreditTransaction

                CreditTransaction.objects.create(
                    kind=CreditTransaction.Kind.SIGNUP_BONUS,
                    from_user=None,
                    to_user_id=user_id,
                    amount=Decimal("10.00"),
                )
            except Exception:
                pass

        transaction.on_commit(lambda: grant_signup_bonus(user.id))

        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs["identifier"].strip()
        password = attrs["password"]

        user = (
            User.objects.filter(
                Q(username__iexact=identifier) | Q(email__iexact=identifier)
            )
            .order_by("id")
            .first()
        )

        if user is None or not user.check_password(password):
            raise serializers.ValidationError("Invalid credentials.")

        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")

        attrs["user"] = user
        return attrs


class ProfileUpdateSerializer(serializers.ModelSerializer):
    default_household_id = serializers.IntegerField(required=False)

    class Meta:
        model = User
        fields = [
            "display_name",
            "first_name",
            "last_name",
            "profile_image",
            "default_household_id",
        ]

    def validate_default_household_id(self, value):
        user = self.context["request"].user
        is_member = HouseholdMembership.objects.filter(
            user=user,
            household_id=value,
            status=HouseholdMembership.Status.ACTIVE,
        ).exists()
        if not is_member:
            raise serializers.ValidationError("You do not belong to that household.")
        return value

    def update(self, instance, validated_data):
        default_household_id = validated_data.pop("default_household_id", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if default_household_id is not None:
            instance.default_household_id = default_household_id
        instance.save()
        return instance


class MarketplaceProfileSerializer(serializers.ModelSerializer):
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "profile_image_url"]

    def get_profile_image_url(self, obj):
        if not obj.profile_image:
            return ""

        request = self.context.get("request")
        if request is None:
            return obj.profile_image.url
        return request.build_absolute_uri(obj.profile_image.url)
