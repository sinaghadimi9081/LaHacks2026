from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("NeighborFridge", {"fields": ("display_name", "default_household")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("NeighborFridge", {"fields": ("email", "display_name")}),
    )
    list_display = ("id", "username", "email", "display_name", "is_staff")
    search_fields = ("username", "email", "display_name")
