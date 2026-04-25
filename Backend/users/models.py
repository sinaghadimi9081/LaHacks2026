from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=150, blank=True)
    default_household = models.ForeignKey(
        "households.Household",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_users",
    )

    objects = UserManager()
    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.display_name or self.username

    @property
    def full_display_name(self):
        return self.display_name or self.get_full_name() or self.username
