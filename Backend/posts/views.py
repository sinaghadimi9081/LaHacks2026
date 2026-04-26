from math import asin, cos, radians, sin, sqrt

from django.db import DatabaseError, transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import ImpactLog, Notification

from .location_services import GeocodingError, geocode_address, reverse_geocode
from .models import Post, PostRequest
from .serializers import (
    ApprovedPostReadSerializer,
    NotificationSerializer,
    PostReadSerializer,
    PostRequestReadSerializer,
    PostRequestWriteSerializer,
    PostWriteSerializer,
)


_POST_REQUEST_PREFETCH = Prefetch(
    "match_requests",
    queryset=PostRequest.objects.select_related("requester"),
)
_REQUEST_POST_PREFETCH = Prefetch(
    "post__match_requests",
    queryset=PostRequest.objects.select_related("requester"),
)


def _distance_miles(latitude_a, longitude_a, latitude_b, longitude_b):
    earth_radius_miles = 3958.8
    latitude_delta = radians(latitude_b - latitude_a)
    longitude_delta = radians(longitude_b - longitude_a)
    latitude_a = radians(latitude_a)
    latitude_b = radians(latitude_b)
    arc = (
        sin(latitude_delta / 2) ** 2
        + cos(latitude_a) * cos(latitude_b) * sin(longitude_delta / 2) ** 2
    )
    return 2 * earth_radius_miles * asin(sqrt(arc))


def _serializer_context(request):
    reference_point = None
    latitude = request.query_params.get("lat")
    longitude = request.query_params.get("lng")
    if latitude is not None and longitude is not None:
        try:
            reference_point = (float(latitude), float(longitude))
        except ValueError as exc:
            raise ValidationError({"detail": "lat and lng must be valid numbers."}) from exc

    return {
        "request": request,
        "reference_point": reference_point,
        "distance_fn": _distance_miles,
    }


def _post_queryset():
    return Post.objects.select_related("owner", "claimed_by_user", "food_item").prefetch_related(
        _POST_REQUEST_PREFETCH
    )


def _request_queryset():
    return PostRequest.objects.select_related(
        "requester",
        "post",
        "post__owner",
        "post__claimed_by_user",
        "post__food_item",
    ).prefetch_related(_REQUEST_POST_PREFETCH)


def _get_post_serializer_class(post, user):
    if post.can_view_exact_location(user):
        return ApprovedPostReadSerializer
    return PostReadSerializer


def _serialize_post(post, request, *, force_public=False):
    serializer_class = PostReadSerializer if force_public else _get_post_serializer_class(post, request.user)
    return serializer_class(post, context=_serializer_context(request)).data


def _apply_request_preferences(post_request, validated_data):
    requested_method = validated_data.get("fulfillment_method")
    if requested_method is None:
        if post_request.pk:
            requested_method = post_request.fulfillment_method
        else:
            requested_method = PostRequest.FulfillmentMethod.PICKUP

    post_request.fulfillment_method = requested_method
    if requested_method == PostRequest.FulfillmentMethod.DELIVERY:
        post_request.dropoff_location = validated_data.get("dropoff_location", "") or ""
        post_request.dropoff_latitude = validated_data.get("dropoff_latitude")
        post_request.dropoff_longitude = validated_data.get("dropoff_longitude")
    else:
        post_request.dropoff_location = ""
        post_request.dropoff_latitude = None
        post_request.dropoff_longitude = None

    return post_request


def _filtered_posts(request, base_queryset):
    queryset = base_queryset.select_related("owner", "claimed_by_user", "food_item").prefetch_related(
        _POST_REQUEST_PREFETCH
    )

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

    tag_values = []
    for raw_tag in request.query_params.getlist("tag"):
        tag_values.extend(
            normalized_tag.strip()
            for normalized_tag in raw_tag.split(",")
            if normalized_tag.strip()
        )
    if tag_values:
        for tag in tag_values:
            queryset = queryset.filter(tags__icontains=tag)

    latitude = request.query_params.get("lat")
    longitude = request.query_params.get("lng")
    radius_miles = request.query_params.get("radius_miles")
    if latitude is not None or longitude is not None or radius_miles is not None:
        if latitude is None or longitude is None or radius_miles is None:
            raise ValidationError(
                {"detail": "lat, lng, and radius_miles must be provided together for location filters."}
            )
        try:
            latitude = float(latitude)
            longitude = float(longitude)
            radius_miles = float(radius_miles)
        except ValueError as exc:
            raise ValidationError(
                {"detail": "lat, lng, and radius_miles must be valid numbers."}
            ) from exc

        filtered_ids = []
        for post in queryset:
            if post.pickup_latitude is None or post.pickup_longitude is None:
                continue
            if (
                _distance_miles(
                    latitude,
                    longitude,
                    float(post.pickup_latitude),
                    float(post.pickup_longitude),
                )
                <= radius_miles
            ):
                filtered_ids.append(post.id)
        queryset = queryset.filter(id__in=filtered_ids)

    return queryset.order_by("-created_at")


class PostFeedView(generics.ListAPIView):
    serializer_class = PostReadSerializer

    def get_queryset(self):
        return _filtered_posts(self.request, Post.objects.all())

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"posts": serializer.data}, status=status.HTTP_200_OK)


class PostCreateView(generics.CreateAPIView):
    serializer_class = PostWriteSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(owner=request.user)
        return Response(
            ApprovedPostReadSerializer(post, context=_serializer_context(request)).data,
            status=status.HTTP_201_CREATED,
        )


class MyPostListView(generics.ListAPIView):
    serializer_class = ApprovedPostReadSerializer

    def get_queryset(self):
        return _filtered_posts(self.request, Post.objects.filter(owner=self.request.user))

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"posts": serializer.data}, status=status.HTTP_200_OK)


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = _post_queryset()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return PostReadSerializer
        return PostWriteSerializer

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def perform_update(self, serializer):
        post = self.get_object()
        if post.owner_id != self.request.user.id:
            raise PermissionDenied("You can only edit your own posts.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("You can only delete your own posts.")
        instance.delete()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(_serialize_post(instance, request), status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer_class = _get_post_serializer_class(instance, request.user)
        serializer = serializer_class(instance, context=_serializer_context(request))
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PostClaimView(APIView):
    def patch(self, request, post_id):
        request_serializer = PostRequestWriteSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            post = generics.get_object_or_404(
                _post_queryset().select_for_update(),
                pk=post_id,
            )

            if post.owner_id == request.user.id:
                raise ValidationError({"detail": "You cannot request your own post."})

            if post.status == Post.Status.CLAIMED:
                if post.claimed_by_user_id == request.user.id:
                    return Response(_serialize_post(post, request), status=status.HTTP_200_OK)
                raise ValidationError({"detail": "This post has already been matched."})

            pending_request = post.get_pending_request()
            if pending_request and pending_request.requester_id != request.user.id:
                raise ValidationError(
                    {"detail": "This post already has a pending request awaiting the owner's response."}
                )

            post_request = post.get_request_for_user(request.user)
            if post_request and post_request.status == PostRequest.Status.PENDING:
                _apply_request_preferences(post_request, request_serializer.validated_data)
                post_request.save(
                    update_fields=[
                        "fulfillment_method",
                        "dropoff_location",
                        "dropoff_latitude",
                        "dropoff_longitude",
                    ]
                )
                response_payload = _serialize_post(post, request, force_public=True)
                response_payload["request"] = PostRequestReadSerializer(
                    post_request,
                    context=_serializer_context(request),
                ).data
                response_payload["fulfillment_method"] = post_request.fulfillment_method
                response_payload["delivery_quote"] = response_payload["request"]["delivery_quote"]
                return Response(response_payload, status=status.HTTP_200_OK)

            if post_request is None:
                post_request = PostRequest(post=post, requester=request.user)
            else:
                post_request.status = PostRequest.Status.PENDING
                post_request.responded_at = None
            _apply_request_preferences(post_request, request_serializer.validated_data)
            post_request.save()

            post.status = Post.Status.PENDING
            post.claimed_by_user = None
            post.claimed_by = None
            post.save(update_fields=["status", "claimed_by_user", "claimed_by", "updated_at"])

        if post.owner_id:
            Notification.objects.create(
                user=post.owner,
                title="New marketplace request",
                message=f'{request.user.full_display_name} requested "{post.title}".',
            )

        response_payload = _serialize_post(post, request, force_public=True)
        response_payload["request"] = PostRequestReadSerializer(
            post_request,
            context=_serializer_context(request),
        ).data
        response_payload["fulfillment_method"] = post_request.fulfillment_method
        response_payload["delivery_quote"] = response_payload["request"]["delivery_quote"]
        return Response(response_payload, status=status.HTTP_200_OK)


class IncomingPostRequestListView(generics.ListAPIView):
    serializer_class = PostRequestReadSerializer

    def get_queryset(self):
        queryset = _request_queryset().filter(post__owner=self.request.user)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset.order_by("-created_at")

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"requests": serializer.data}, status=status.HTTP_200_OK)


class OutgoingPostRequestListView(generics.ListAPIView):
    serializer_class = PostRequestReadSerializer

    def get_queryset(self):
        queryset = _request_queryset().filter(requester=self.request.user)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset.order_by("-created_at")

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"requests": serializer.data}, status=status.HTTP_200_OK)


class PostRequestActionView(APIView):
    def get_object(self, request, request_id):
        return generics.get_object_or_404(
            _request_queryset().select_for_update(),
            pk=request_id,
            post__owner=request.user,
            status=PostRequest.Status.PENDING,
        )

    def patch(self, request, request_id, action):
        with transaction.atomic():
            post_request = self.get_object(request, request_id)
            post = post_request.post
            responded_at = timezone.now()

            if action == "approve":
                post_request.status = PostRequest.Status.APPROVED
                post_request.responded_at = responded_at
                post_request.save(update_fields=["status", "responded_at"])

                post.status = Post.Status.CLAIMED
                post.claimed_by_user = post_request.requester
                post.claimed_by = post_request.requester.full_display_name
                post.save(update_fields=["status", "claimed_by_user", "claimed_by", "updated_at"])

                try:
                    ImpactLog.objects.create(
                        food_item=post.food_item,
                        action="share_post_claimed",
                        dollars_saved=post.resolved_estimated_price,
                    )
                except DatabaseError:
                    pass

                Notification.objects.create(
                    user=post_request.requester,
                    title="Marketplace request approved",
                    message=f'Your request for "{post.title}" was approved.',
                )
            elif action == "decline":
                post_request.status = PostRequest.Status.DECLINED
                post_request.responded_at = responded_at
                post_request.save(update_fields=["status", "responded_at"])

                post.status = Post.Status.AVAILABLE
                post.claimed_by_user = None
                post.claimed_by = None
                post.save(update_fields=["status", "claimed_by_user", "claimed_by", "updated_at"])

                Notification.objects.create(
                    user=post_request.requester,
                    title="Marketplace request declined",
                    message=f'Your request for "{post.title}" was declined.',
                )
            else:
                raise ValidationError({"detail": "Unsupported request action."})

        serializer = PostRequestReadSerializer(post_request, context=_serializer_context(request))
        return Response({"request": serializer.data}, status=status.HTTP_200_OK)


class PostLocationResolveView(APIView):
    def post(self, request):
        address = request.data.get("pickup_location") or request.data.get("address")
        latitude = request.data.get("pickup_latitude") or request.data.get("latitude")
        longitude = request.data.get("pickup_longitude") or request.data.get("longitude")

        try:
            if address:
                location = geocode_address(address)
            else:
                if latitude in (None, "") or longitude in (None, ""):
                    raise ValidationError(
                        {"detail": "Provide an address or both latitude and longitude."}
                    )
                location = reverse_geocode(latitude, longitude)
        except GeocodingError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        return Response(location, status=status.HTTP_200_OK)


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"notifications": serializer.data}, status=status.HTTP_200_OK)


class NotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, notification_id):
        notification = generics.get_object_or_404(
            Notification,
            pk=notification_id,
            user=request.user,
        )
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(
            {"detail": "Notification marked as read."},
            status=status.HTTP_200_OK,
        )
