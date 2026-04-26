from decimal import Decimal

from rest_framework import serializers

from core.models import FoodItem, Notification

from .delivery_quotes import build_simulated_delivery_quote
from .location_services import GeocodingError, geocode_address, reverse_geocode
from .models import Post, PostRequest


def _format_coordinate(value):
    if value in (None, ""):
        return None
    return f"{Decimal(str(value)):.6f}"


class PostOwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(source="full_display_name", read_only=True)


class BasePostReadSerializer(serializers.ModelSerializer):
    owner = PostOwnerSerializer(read_only=True)
    claimed_by = serializers.SerializerMethodField()
    food_item = serializers.SerializerMethodField()
    distance_miles = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    exact_location_visible = serializers.SerializerMethodField()
    viewer_request_status = serializers.SerializerMethodField()
    public_pickup_location = serializers.SerializerMethodField()
    public_pickup_latitude = serializers.SerializerMethodField()
    public_pickup_longitude = serializers.SerializerMethodField()
    pickup_location = serializers.SerializerMethodField()
    pickup_latitude = serializers.SerializerMethodField()
    pickup_longitude = serializers.SerializerMethodField()
    viewer_fulfillment_method = serializers.SerializerMethodField()
    viewer_delivery_quote = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "owner",
            "is_owner",
            "food_item_id",
            "item_name",
            "quantity_label",
            "estimated_price",
            "image_url",
            "image_file",
            "food_item",
            "title",
            "description",
            "pickup_location",
            "pickup_latitude",
            "pickup_longitude",
            "public_pickup_location",
            "public_pickup_latitude",
            "public_pickup_longitude",
            "distance_miles",
            "tags",
            "status",
            "claimed_by",
            "viewer_request_status",
            "viewer_fulfillment_method",
            "viewer_delivery_quote",
            "exact_location_visible",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_claimed_by(self, obj):
        if obj.claimed_by:
            return obj.claimed_by
        if obj.claimed_by_user_id:
            return obj.claimed_by_user.full_display_name
        return ""

    def get_food_item(self, obj):
        request = self.context.get("request")
        image_url = obj.resolved_image_url
        if request is not None and image_url and not image_url.startswith("http"):
            image_url = request.build_absolute_uri(image_url)

        food_item = obj.food_item
        expiration_date = None
        owner_name = obj.owner.full_display_name if obj.owner_id else ""
        item_status = obj.status

        if food_item is not None:
            expiration_date = food_item.expiration_date
            owner_name = food_item.owner_name or owner_name
            item_status = food_item.status or item_status

        return {
            "id": obj.food_item_id,
            "name": obj.resolved_item_name,
            "quantity": obj.resolved_quantity_label,
            "estimated_price": obj.resolved_estimated_price,
            "status": item_status,
            "owner_name": owner_name,
            "image": image_url,
            "expiration_date": expiration_date,
            "recipe_uses": obj.tags or [],
        }

    def _distance_coordinates(self, obj):
        raise NotImplementedError

    def get_distance_miles(self, obj):
        reference_point = self.context.get("reference_point")
        latitude, longitude = self._distance_coordinates(obj)
        if not reference_point or latitude is None or longitude is None:
            return None

        ref_latitude, ref_longitude = reference_point
        return round(
            self.context["distance_fn"](
                ref_latitude,
                ref_longitude,
                float(latitude),
                float(longitude),
            ),
            2,
        )

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.owner_id == request.user.id)

    def get_viewer_request_status(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        return obj.get_viewer_request_status(request.user)

    def _get_viewer_request(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        return obj.get_request_for_user(request.user)

    def get_viewer_fulfillment_method(self, obj):
        post_request = self._get_viewer_request(obj)
        return post_request.fulfillment_method if post_request else None

    def get_viewer_delivery_quote(self, obj):
        post_request = self._get_viewer_request(obj)
        if post_request is None:
            return None

        request = self.context.get("request")
        return build_simulated_delivery_quote(
            post_request,
            reveal_exact_pickup=obj.can_view_exact_location(request.user) if request else False,
        )

    def get_public_pickup_location(self, obj):
        return obj.get_public_pickup_location()

    def get_public_pickup_latitude(self, obj):
        return _format_coordinate(obj.get_public_pickup_latitude())

    def get_public_pickup_longitude(self, obj):
        return _format_coordinate(obj.get_public_pickup_longitude())


class PostReadSerializer(BasePostReadSerializer):
    def _distance_coordinates(self, obj):
        return obj.get_public_pickup_latitude(), obj.get_public_pickup_longitude()

    def get_pickup_location(self, obj):
        return obj.get_public_pickup_location()

    def get_pickup_latitude(self, obj):
        return _format_coordinate(obj.get_public_pickup_latitude())

    def get_pickup_longitude(self, obj):
        return _format_coordinate(obj.get_public_pickup_longitude())

    def get_exact_location_visible(self, obj):
        return False


class ApprovedPostReadSerializer(BasePostReadSerializer):
    def _distance_coordinates(self, obj):
        return obj.pickup_latitude, obj.pickup_longitude

    def get_pickup_location(self, obj):
        return obj.pickup_location

    def get_pickup_latitude(self, obj):
        return _format_coordinate(obj.pickup_latitude)

    def get_pickup_longitude(self, obj):
        return _format_coordinate(obj.pickup_longitude)

    def get_exact_location_visible(self, obj):
        return True


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
        serializer_context = {
            "request": request,
            "reference_point": self.context.get("reference_point"),
            "distance_fn": self.context.get("distance_fn"),
        }
        return serializer_class(obj.post, context=serializer_context).data

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
            raise serializers.ValidationError({"dropoff_latitude": "Latitude must be between -90 and 90."})
        if longitude is not None and not (-180 <= longitude <= 180):
            raise serializers.ValidationError({"dropoff_longitude": "Longitude must be between -180 and 180."})

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


class PostWriteSerializer(serializers.ModelSerializer):
    food_item_id = serializers.PrimaryKeyRelatedField(
        source="food_item",
        queryset=FoodItem.objects.all(),
        required=False,
        allow_null=True,
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )
    recipe_uses = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Post
        fields = [
            "food_item_id",
            "item_name",
            "quantity_label",
            "estimated_price",
            "image_url",
            "image_file",
            "title",
            "description",
            "pickup_location",
            "pickup_latitude",
            "pickup_longitude",
            "tags",
            "recipe_uses",
            "status",
        ]
        extra_kwargs = {
            "item_name": {"required": False, "allow_blank": True},
            "quantity_label": {"required": False, "allow_blank": True},
            "estimated_price": {"required": False},
            "image_url": {"required": False, "allow_blank": True, "allow_null": True},
            "description": {"required": False, "allow_blank": True, "allow_null": True},
            "pickup_location": {"required": False, "allow_blank": True},
            "status": {"required": False},
        }

    def _clean_tags(self, value):
        if value is None:
            return []
        if isinstance(value, str):
            value = value.split(",")
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list of strings.")

        cleaned_tags = []
        for tag in value:
            normalized_tag = str(tag).strip()
            if normalized_tag and normalized_tag not in cleaned_tags:
                cleaned_tags.append(normalized_tag)
        return cleaned_tags[:12]

    def validate_tags(self, value):
        return self._clean_tags(value)

    def validate_recipe_uses(self, value):
        return self._clean_tags(value)

    def validate(self, attrs):
        tags = attrs.pop("recipe_uses", None)
        if tags is not None and "tags" not in attrs:
            attrs["tags"] = tags

        submitted_status = attrs.get("status")
        if submitted_status is not None and submitted_status != Post.Status.AVAILABLE:
            raise serializers.ValidationError(
                {"status": "Marketplace request status is managed by the server."}
            )

        food_item = attrs.get("food_item")
        item_name = attrs.get("item_name")
        if self.instance is not None:
            food_item = food_item if "food_item" in attrs else self.instance.food_item
            item_name = item_name if "item_name" in attrs else self.instance.item_name

        if not (food_item or (item_name or "").strip()):
            raise serializers.ValidationError(
                {"item_name": "Provide an item_name or a food_item_id."}
            )

        try:
            self._resolve_location(attrs)
        except GeocodingError as exc:
            raise serializers.ValidationError({"pickup_location": str(exc)}) from exc

        return attrs

    def _fill_from_food_item(self, validated_data):
        food_item = validated_data.get("food_item")
        if food_item is None:
            return validated_data

        validated_data.setdefault("item_name", food_item.name)
        validated_data.setdefault("quantity_label", str(food_item.quantity))
        validated_data.setdefault("estimated_price", food_item.estimated_price)
        validated_data.setdefault("image_url", food_item.image_url)
        return validated_data

    def _resolve_location(self, attrs):
        location_fields = {"pickup_location", "pickup_latitude", "pickup_longitude"}
        if self.instance is not None and not any(field in attrs for field in location_fields):
            return attrs

        pickup_location = attrs.get("pickup_location")
        pickup_location = pickup_location.strip() if isinstance(pickup_location, str) else pickup_location
        latitude = attrs.get("pickup_latitude")
        longitude = attrs.get("pickup_longitude")

        if self.instance is not None:
            if pickup_location is None:
                pickup_location = self.instance.pickup_location
            if "pickup_latitude" not in attrs:
                latitude = self.instance.pickup_latitude
            if "pickup_longitude" not in attrs:
                longitude = self.instance.pickup_longitude

        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                "pickup_latitude and pickup_longitude must be provided together."
            )

        if latitude is not None and not (-90 <= latitude <= 90):
            raise serializers.ValidationError({"pickup_latitude": "Latitude must be between -90 and 90."})
        if longitude is not None and not (-180 <= longitude <= 180):
            raise serializers.ValidationError({"pickup_longitude": "Longitude must be between -180 and 180."})

        if pickup_location and latitude is not None and longitude is not None:
            attrs["pickup_location"] = pickup_location
            return attrs
        if pickup_location:
            attrs.update(geocode_address(pickup_location))
            return attrs
        if latitude is not None and longitude is not None:
            attrs.update(reverse_geocode(latitude, longitude))
            return attrs

        raise serializers.ValidationError(
            {"pickup_location": "Enter an address or use your current location."}
        )

    def create(self, validated_data):
        validated_data = self._fill_from_food_item(validated_data)
        validated_data.setdefault("owner", self.context["request"].user)
        validated_data.setdefault("status", Post.Status.AVAILABLE)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._fill_from_food_item(validated_data)
        return super().update(instance, validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "is_read", "created_at"]
        read_only_fields = ["id", "title", "message", "created_at"]
