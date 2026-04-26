from rest_framework import serializers

from .models import LockerListing, LockerSite


class LockerSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LockerSite
        fields = ["id", "name", "address_label", "latitude", "longitude", "description", "is_active"]
        read_only_fields = fields


class LockerListingSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_address_label = serializers.CharField(source="site.address_label", read_only=True)
    site_latitude = serializers.DecimalField(source="site.latitude", max_digits=9, decimal_places=6, read_only=True)
    site_longitude = serializers.DecimalField(source="site.longitude", max_digits=9, decimal_places=6, read_only=True)
    compartment_label = serializers.CharField(source="compartment.label", read_only=True)
    storage_type = serializers.CharField(source="compartment.storage_type", read_only=True)
    is_seller = serializers.SerializerMethodField()
    is_buyer = serializers.SerializerMethodField()
    dropoff_code = serializers.SerializerMethodField()
    pickup_code = serializers.SerializerMethodField()

    class Meta:
        model = LockerListing
        fields = [
            "id",
            "status",
            "item_name",
            "image_url",
            "price",
            "site",
            "site_name",
            "site_address_label",
            "site_latitude",
            "site_longitude",
            "compartment_label",
            "storage_type",
            "reserved_until",
            "is_seller",
            "is_buyer",
            "dropoff_code",
            "pickup_code",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _user_id(self):
        request = self.context.get("request")
        return getattr(getattr(request, "user", None), "id", None)

    def get_is_seller(self, obj):
        return obj.seller_id == self._user_id()

    def get_is_buyer(self, obj):
        return obj.buyer_id == self._user_id()

    def get_dropoff_code(self, obj):
        user_id = self._user_id()
        if user_id and obj.seller_id == user_id and obj.status == LockerListing.Status.RESERVED:
            return obj.dropoff_code or ""
        return ""

    def get_pickup_code(self, obj):
        user_id = self._user_id()
        if user_id and obj.buyer_id == user_id and obj.status in (LockerListing.Status.SOLD, LockerListing.Status.PICKED_UP):
            return obj.pickup_code or ""
        return ""

