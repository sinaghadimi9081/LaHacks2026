from django.conf import settings
from django.db import models


class Post(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
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
