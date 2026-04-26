from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q


class LockerSite(models.Model):
    name = models.CharField(max_length=150, unique=True)
    address_label = models.CharField(max_length=255, blank=True, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class LockerCompartment(models.Model):
    class StorageType(models.TextChoices):
        DRY = "dry", "Dry"
        REFRIGERATED = "refrigerated", "Refrigerated"
        FROZEN = "frozen", "Frozen"

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        RESERVED = "reserved", "Reserved"
        OCCUPIED = "occupied", "Occupied"
        OUT_OF_SERVICE = "out_of_service", "Out of service"

    site = models.ForeignKey(
        LockerSite,
        on_delete=models.CASCADE,
        related_name="compartments",
    )
    storage_type = models.CharField(max_length=20, choices=StorageType.choices)
    label = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "label"],
                name="unique_compartment_label_per_site",
            )
        ]

    def __str__(self):
        return f"{self.site.name} - {self.label} ({self.storage_type})"


class LockerListing(models.Model):
    class Status(models.TextChoices):
        RESERVED = "reserved", "Reserved"
        AVAILABLE = "available", "Available"
        SOLD = "sold", "Sold"
        PICKED_UP = "picked_up", "Picked up"
        CANCELLED = "cancelled", "Cancelled"

    site = models.ForeignKey(
        LockerSite,
        on_delete=models.CASCADE,
        related_name="listings",
    )
    compartment = models.ForeignKey(
        LockerCompartment,
        on_delete=models.PROTECT,
        related_name="listings",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="locker_sales",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="locker_purchases",
    )
    food_item = models.ForeignKey(
        "core.FoodItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="locker_listings",
    )
    item_name = models.CharField(max_length=255)
    image_url = models.URLField(max_length=500, blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RESERVED)
    reserved_until = models.DateTimeField(null=True, blank=True)
    dropoff_code = models.CharField(max_length=6, blank=True, default="")
    pickup_code = models.CharField(max_length=6, blank=True, default="")
    escrow_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    escrow_released_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["compartment"],
                condition=Q(status__in=["reserved", "available", "sold"]),
                name="unique_active_listing_per_compartment",
            )
        ]

    def __str__(self):
        return f"{self.item_name} @ {self.site.name} ({self.status})"


class CreditTransaction(models.Model):
    class Kind(models.TextChoices):
        SIGNUP_BONUS = "signup_bonus", "Signup bonus"
        LOCKER_PURCHASE_ESCROW = "locker_purchase_escrow", "Locker purchase (escrow)"
        LOCKER_PAYOUT_RELEASE = "locker_payout_release", "Locker payout release"

    kind = models.CharField(max_length=50, choices=Kind.choices)
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_tx_out",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_tx_in",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    listing = models.ForeignKey(
        LockerListing,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind}: {self.amount}"

