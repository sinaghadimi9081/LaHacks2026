from decimal import Decimal, ROUND_HALF_UP
import re

from django.conf import settings
from django.db import models
from django.db.models import Q


_UNIT_SEGMENT_PATTERN = re.compile(r"\b(?:apt|apartment|unit|suite|ste|floor|fl|room|rm|#)\b", re.IGNORECASE)
_STREET_SEGMENT_PATTERN = re.compile(
    r"\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|way|pl|place|terrace|ter|circle|cir)\b",
    re.IGNORECASE,
)


class Post(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        PENDING = "pending", "Pending"
        CLAIMED = "claimed", "Claimed"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
        null=True,
        blank=True,
    )
    food_item = models.ForeignKey(
        "core.FoodItem",
        on_delete=models.SET_NULL,
        related_name="posts",
        null=True,
        blank=True,
    )
    item_name = models.CharField(max_length=255, blank=True, default="")
    quantity_label = models.CharField(max_length=100, blank=True, default="")
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    image_file = models.ImageField(upload_to="share_post_images/", blank=True, null=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    pickup_location = models.CharField(max_length=255)
    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    tags = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.AVAILABLE)
    claimed_by = models.CharField(max_length=255, blank=True, null=True)
    claimed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="claimed_posts",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def resolved_item_name(self):
        if self.item_name:
            return self.item_name
        if self.food_item_id:
            return self.food_item.name
        return self.title

    @property
    def resolved_quantity_label(self):
        if self.quantity_label:
            return self.quantity_label
        if self.food_item_id:
            return str(self.food_item.quantity)
        return ""

    @property
    def resolved_estimated_price(self):
        if self.estimated_price:
            return self.estimated_price
        if self.food_item_id:
            return self.food_item.estimated_price
        return self.estimated_price

    @property
    def resolved_image_url(self):
        if self.image_file:
            return self.image_file.url
        if self.image_url:
            return self.image_url
        if self.food_item_id:
            if self.food_item.image_file:
                return self.food_item.image_file.url
            return self.food_item.image_url
        return ""

    def _viewer_request_from_prefetch(self, user):
        prefetched = getattr(self, "_prefetched_objects_cache", {})
        requests = prefetched.get("match_requests")
        if requests is None:
            return None

        for post_request in requests:
            if post_request.requester_id == user.id:
                return post_request
        return None

    def get_request_for_user(self, user):
        if not user or not user.is_authenticated:
            return None

        prefetched_request = self._viewer_request_from_prefetch(user)
        if prefetched_request is not None:
            return prefetched_request

        return self.match_requests.select_related("requester").filter(requester=user).first()

    def get_pending_request(self):
        prefetched = getattr(self, "_prefetched_objects_cache", {})
        requests = prefetched.get("match_requests")
        if requests is not None:
            for post_request in requests:
                if post_request.status == PostRequest.Status.PENDING:
                    return post_request
            return None

        return self.match_requests.select_related("requester").filter(
            status=PostRequest.Status.PENDING
        ).first()

    def get_approved_request(self):
        prefetched = getattr(self, "_prefetched_objects_cache", {})
        requests = prefetched.get("match_requests")
        if requests is not None:
            for post_request in requests:
                if post_request.status == PostRequest.Status.APPROVED:
                    return post_request
            return None

        return self.match_requests.select_related("requester").filter(
            status=PostRequest.Status.APPROVED
        ).first()

    def get_viewer_request_status(self, user):
        if not user or not user.is_authenticated:
            return None

        if self.claimed_by_user_id == user.id and self.status == self.Status.CLAIMED:
            return PostRequest.Status.APPROVED

        post_request = self.get_request_for_user(user)
        return post_request.status if post_request else None

    def can_view_exact_location(self, user):
        if not user or not user.is_authenticated:
            return False
        if self.owner_id == user.id:
            return True
        if self.claimed_by_user_id == user.id and self.status == self.Status.CLAIMED:
            return True

        return self.get_viewer_request_status(user) == PostRequest.Status.APPROVED

    def get_public_pickup_location(self):
        if not self.pickup_location:
            return ""

        segments = [segment.strip() for segment in self.pickup_location.split(",") if segment.strip()]
        if not segments:
            return ""

        while segments and (
            any(character.isdigit() for character in segments[0])
            or _UNIT_SEGMENT_PATTERN.search(segments[0])
            or _STREET_SEGMENT_PATTERN.search(segments[0])
        ):
            segments.pop(0)

        if not segments:
            return "Approximate pickup area"

        return ", ".join(segments[:2])

    def _rounded_coordinate(self, value):
        if value in (None, ""):
            return None

        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def get_public_pickup_latitude(self):
        return self._rounded_coordinate(self.pickup_latitude)

    def get_public_pickup_longitude(self):
        return self._rounded_coordinate(self.pickup_longitude)


class PostRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        DECLINED = "declined", "Declined"

    class FulfillmentMethod(models.TextChoices):
        PICKUP = "pickup", "Pickup"
        DELIVERY = "delivery", "Simulated Delivery"

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="match_requests",
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_requests",
    )
    status = models.CharField(
        max_length=50,
        choices=Status.choices,
        default=Status.PENDING,
    )
    fulfillment_method = models.CharField(
        max_length=20,
        choices=FulfillmentMethod.choices,
        default=FulfillmentMethod.PICKUP,
    )
    dropoff_location = models.CharField(max_length=255, blank=True, default="")
    dropoff_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    dropoff_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["post", "requester"],
                name="unique_post_request_per_requester",
            ),
            models.UniqueConstraint(
                fields=["post"],
                condition=Q(status="pending"),
                name="unique_pending_post_request",
            ),
            models.UniqueConstraint(
                fields=["post"],
                condition=Q(status="approved"),
                name="unique_approved_post_request",
            ),
        ]

    def __str__(self):
        return f"{self.requester} -> {self.post} ({self.status})"


class PostRequestMessage(models.Model):
    post_request = models.ForeignKey(
        PostRequest,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_request_messages",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.sender} -> request {self.post_request_id}"
