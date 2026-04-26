from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=150, blank=True)
    profile_image = models.ImageField(upload_to="profile_images/", blank=True, null=True)
    default_household = models.ForeignKey(
        "households.Household",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_users",
    )

    # Cumulative environmental impact stats
    total_water_saved_gallons = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_co2_saved_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_electricity_saved_kwh = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_posts_shared = models.PositiveIntegerField(default=0)

    objects = UserManager()
    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.display_name or self.username

    @property
    def full_display_name(self):
        return self.display_name or self.get_full_name() or self.username
