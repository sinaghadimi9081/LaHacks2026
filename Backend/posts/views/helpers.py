from math import asin, cos, radians, sin, sqrt

from django.db.models import Prefetch, Q
from rest_framework.exceptions import ValidationError

from ..models import Post, PostRequest
from ..serializers import ApprovedPostReadSerializer, PostReadSerializer


_POST_REQUEST_PREFETCH = Prefetch(
    "match_requests",
    queryset=PostRequest.objects.select_related("requester"),
)
_REQUEST_POST_PREFETCH = Prefetch(
    "post__match_requests",
    queryset=PostRequest.objects.select_related("requester"),
)


def distance_miles(lat_a, lng_a, lat_b, lng_b):
    r = 3958.8
    dlat = radians(lat_b - lat_a)
    dlng = radians(lng_b - lng_a)
    a = sin(dlat / 2) ** 2 + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))


def serializer_context(request):
    reference_point = None
    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")
    if lat is not None and lng is not None:
        try:
            reference_point = (float(lat), float(lng))
        except ValueError as exc:
            raise ValidationError({"detail": "lat and lng must be valid numbers."}) from exc
    return {"request": request, "reference_point": reference_point, "distance_fn": distance_miles}


def post_queryset():
    return Post.objects.select_related("owner", "claimed_by_user", "food_item").prefetch_related(
        _POST_REQUEST_PREFETCH
    )


def request_queryset():
    return PostRequest.objects.select_related(
        "requester", "post", "post__owner", "post__claimed_by_user", "post__food_item"
    ).prefetch_related(_REQUEST_POST_PREFETCH)


def get_post_serializer_class(post, user):
    if post.can_view_exact_location(user):
        return ApprovedPostReadSerializer
    return PostReadSerializer


def serialize_post(post, request, *, force_public=False):
    cls = PostReadSerializer if force_public else get_post_serializer_class(post, request.user)
    return cls(post, context=serializer_context(request)).data


def filtered_posts(request, base_queryset):
    queryset = base_queryset.select_related(
        "owner", "claimed_by_user", "food_item"
    ).prefetch_related(_POST_REQUEST_PREFETCH)

    status_value = request.query_params.get("status")
    if status_value:
        queryset = queryset.filter(status=status_value)

    search = request.query_params.get("search", "").strip()
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(pickup_location__icontains=search)
            | Q(item_name__icontains=search)
            | Q(food_item__name__icontains=search)
            | Q(claimed_by__icontains=search)
        )

    for raw_tag in request.query_params.getlist("tag"):
        for tag in raw_tag.split(","):
            tag = tag.strip()
            if tag:
                queryset = queryset.filter(tags__icontains=tag)

    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")
    radius = request.query_params.get("radius_miles")
    if lat is not None or lng is not None or radius is not None:
        if lat is None or lng is None or radius is None:
            raise ValidationError(
                {"detail": "lat, lng, and radius_miles must be provided together for location filters."}
            )
        try:
            lat, lng, radius = float(lat), float(lng), float(radius)
        except ValueError as exc:
            raise ValidationError(
                {"detail": "lat, lng, and radius_miles must be valid numbers."}
            ) from exc

        filtered_ids = [
            post.id
            for post in queryset
            if post.pickup_latitude is not None
            and post.pickup_longitude is not None
            and distance_miles(lat, lng, float(post.pickup_latitude), float(post.pickup_longitude))
            <= radius
        ]
        queryset = queryset.filter(id__in=filtered_ids)

    return queryset.order_by("-created_at")
