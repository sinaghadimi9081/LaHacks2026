from decimal import Decimal

from rest_framework import serializers

from ..delivery_quotes import build_simulated_delivery_quote
from ..location_services import GeocodingError, geocode_address, reverse_geocode
from ..models import PostRequest
from .post import ApprovedPostReadSerializer, PostOwnerSerializer, PostReadSerializer


def _format_coordinate(value):
    if value in (None, ""):
        return None
    return f"{Decimal(str(value)):.6f}"


class PostRequestReadSerializer(serializers.ModelSerializer):
    requester = PostOwnerSerializer(read_only=True)
    post = serializers.SerializerMethodField()
    delivery_quote = serializers.SerializerMethodField()
    dropoff_latitude = serializers.SerializerMethodField()
    dropoff_longitude = serializers.SerializerMethodField()

    class Meta:
        model = PostRequest
        fields = [
            "id",
            "status",
            "fulfillment_method",
            "dropoff_location",
            "dropoff_latitude",
            "dropoff_longitude",
            "delivery_quote",
            "created_at",
            "responded_at",
            "requester",
            "post",
        ]
        read_only_fields = fields

    def get_post(self, obj):
        serializer_class = self.context.get("post_serializer_class")
        request = self.context.get("request")
        if serializer_class is None:
            if request is not None and obj.post.can_view_exact_location(request.user):
                serializer_class = ApprovedPostReadSerializer
            else:
                serializer_class = PostReadSerializer
        context = {
            "request": request,
            "reference_point": self.context.get("reference_point"),
            "distance_fn": self.context.get("distance_fn"),
        }
        return serializer_class(obj.post, context=context).data

    def get_dropoff_latitude(self, obj):
        return _format_coordinate(obj.dropoff_latitude)

    def get_dropoff_longitude(self, obj):
        return _format_coordinate(obj.dropoff_longitude)

    def get_delivery_quote(self, obj):
        request = self.context.get("request")
        reveal_exact_pickup = bool(request and obj.post.can_view_exact_location(request.user))
        return build_simulated_delivery_quote(obj, reveal_exact_pickup=reveal_exact_pickup)


class PostRequestWriteSerializer(serializers.Serializer):
    fulfillment_method = serializers.ChoiceField(
        choices=PostRequest.FulfillmentMethod.choices,
        required=False,
    )
    dropoff_location = serializers.CharField(required=False, allow_blank=True)
    dropoff_latitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        required=False,
        allow_null=True,
    )
    dropoff_longitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        has_dropoff_address = bool((attrs.get("dropoff_location") or "").strip())
        has_dropoff_coordinates = (
            attrs.get("dropoff_latitude") is not None or attrs.get("dropoff_longitude") is not None
        )
        fulfillment_method = attrs.get("fulfillment_method")

        if fulfillment_method is None and (has_dropoff_address or has_dropoff_coordinates):
            fulfillment_method = PostRequest.FulfillmentMethod.DELIVERY
            attrs["fulfillment_method"] = fulfillment_method

        if fulfillment_method != PostRequest.FulfillmentMethod.DELIVERY:
            return attrs

        try:
            self._resolve_dropoff(attrs)
        except GeocodingError as exc:
            raise serializers.ValidationError({"dropoff_location": str(exc)}) from exc

        return attrs

    def _resolve_dropoff(self, attrs):
        dropoff_location = attrs.get("dropoff_location")
        dropoff_location = (
            dropoff_location.strip() if isinstance(dropoff_location, str) else dropoff_location
        )
        latitude = attrs.get("dropoff_latitude")
        longitude = attrs.get("dropoff_longitude")

        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                "dropoff_latitude and dropoff_longitude must be provided together."
            )

        if latitude is not None and not (-90 <= latitude <= 90):
            raise serializers.ValidationError(
                {"dropoff_latitude": "Latitude must be between -90 and 90."}
            )
        if longitude is not None and not (-180 <= longitude <= 180):
            raise serializers.ValidationError(
                {"dropoff_longitude": "Longitude must be between -180 and 180."}
            )

        if dropoff_location and latitude is not None and longitude is not None:
            attrs["dropoff_location"] = dropoff_location
            return attrs
        if dropoff_location:
            resolved_location = geocode_address(dropoff_location)
            attrs["dropoff_location"] = resolved_location["pickup_location"]
            attrs["dropoff_latitude"] = resolved_location["pickup_latitude"]
            attrs["dropoff_longitude"] = resolved_location["pickup_longitude"]
            return attrs
        if latitude is not None and longitude is not None:
            resolved_location = reverse_geocode(latitude, longitude)
            attrs["dropoff_location"] = resolved_location["pickup_location"]
            attrs["dropoff_latitude"] = resolved_location["pickup_latitude"]
            attrs["dropoff_longitude"] = resolved_location["pickup_longitude"]
            return attrs

        raise serializers.ValidationError(
            {"dropoff_location": "Enter a dropoff address or send both dropoff coordinates for delivery."}
        )
