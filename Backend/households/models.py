from django.conf import settings
from django.db import models
from django.db.models import Q


class Household(models.Model):
    name = models.CharField(max_length=150)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_households",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class HouseholdMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        MEMBER = "member", "Member"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INVITED = "invited", "Invited"

    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="household_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    can_upload_receipts = models.BooleanField(default=True)
    can_post_share = models.BooleanField(default=True)
    can_manage_members = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "user"],
                name="unique_household_membership",
            ),
        ]

    def __str__(self):
        return f"{self.user} in {self.household}"


class HouseholdInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        REVOKED = "revoked", "Revoked"

    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_household_invitations",
    )
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="received_household_invitations",
    )
    invited_email = models.EmailField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "invited_email"],
                condition=Q(status="pending"),
                name="unique_pending_household_invitation",
            ),
        ]

    def save(self, *args, **kwargs):
        self.invited_email = (self.invited_email or "").strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invited_email} -> {self.household}"
