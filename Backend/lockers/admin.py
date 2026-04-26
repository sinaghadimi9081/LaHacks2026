from django.contrib import admin

from .models import CreditTransaction, LockerCompartment, LockerListing, LockerSite


@admin.register(LockerSite)
class LockerSiteAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "address_label", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "address_label")


@admin.register(LockerCompartment)
class LockerCompartmentAdmin(admin.ModelAdmin):
    list_display = ("id", "site", "label", "storage_type", "status")
    list_filter = ("site", "storage_type", "status")
    search_fields = ("label",)


@admin.register(LockerListing)
class LockerListingAdmin(admin.ModelAdmin):
    list_display = ("id", "site", "compartment", "item_name", "price", "status", "seller", "buyer")
    list_filter = ("site", "status")
    search_fields = ("item_name", "seller__username", "buyer__username")


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "amount", "from_user", "to_user", "listing", "created_at")
    list_filter = ("kind",)

