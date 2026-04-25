from django.contrib import admin

from .models import Household, HouseholdMembership


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_by", "created_at")
    search_fields = ("name", "created_by__username", "created_by__email")


@admin.register(HouseholdMembership)
class HouseholdMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "household", "user", "role", "status", "joined_at")
    search_fields = ("household__name", "user__username", "user__email")
