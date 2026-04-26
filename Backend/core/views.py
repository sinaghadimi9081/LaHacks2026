from math import asin, cos, radians, sin, sqrt

from django.utils import timezone
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ImpactLog, Notification, SharePost
from .serializers import (
    NotificationSerializer,
    SharePostReadSerializer,
    SharePostWriteSerializer,
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


def _filtered_posts(request, base_queryset):
    queryset = base_queryset.select_related("owner", "food_item", "claimed_by_user")
    today = timezone.localdate()

    if request.query_params.get("include_expired") != "true":
        queryset = queryset.filter(
            Q(expiration_date__gt=today)
            | Q(expiration_date__isnull=True, food_item__expiration_date__gt=today)
            | Q(expiration_date__isnull=True, food_item__expiration_date__isnull=True)
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


class SharePostFeedView(generics.ListAPIView):
    serializer_class = SharePostReadSerializer

    def get_queryset(self):
        return _filtered_posts(self.request, SharePost.objects.all())

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"posts": serializer.data}, status=status.HTTP_200_OK)


class SharePostCreateView(generics.CreateAPIView):
    serializer_class = SharePostWriteSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(owner=request.user)
        response_serializer = SharePostReadSerializer(
            post,
            context=_serializer_context(request),
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class MySharePostListView(generics.ListAPIView):
    serializer_class = SharePostReadSerializer

    def get_queryset(self):
        return _filtered_posts(
            self.request,
            SharePost.objects.filter(owner=self.request.user),
        )

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"posts": serializer.data}, status=status.HTTP_200_OK)


class SharePostDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SharePost.objects.select_related("owner", "food_item", "claimed_by_user")

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return SharePostReadSerializer
        return SharePostWriteSerializer

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def perform_update(self, serializer):
        share_post = self.get_object()
        if share_post.owner_id != self.request.user.id:
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
        response_serializer = SharePostReadSerializer(
            instance,
            context=_serializer_context(request),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SharePostClaimView(APIView):
    def patch(self, request, share_post_id):
        share_post = generics.get_object_or_404(
            SharePost.objects.select_related("owner", "food_item", "claimed_by_user"),
            pk=share_post_id,
        )

        if share_post.owner_id == request.user.id:
            raise ValidationError({"detail": "You cannot claim your own post."})

        if share_post.status == SharePost.Status.CLAIMED and share_post.claimed_by_user_id not in (None, request.user.id):
            raise ValidationError({"detail": "This post has already been claimed."})

        share_post.status = SharePost.Status.CLAIMED
        share_post.claimed_by_user = request.user
        share_post.claimed_by = request.user.full_display_name
        share_post.save(update_fields=["status", "claimed_by_user", "claimed_by", "updated_at"])

        ImpactLog.objects.create(
            food_item=share_post.food_item,
            action="share_post_claimed",
            dollars_saved=share_post.resolved_estimated_price,
        )

        serializer = SharePostReadSerializer(
            share_post,
            context=_serializer_context(request),
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

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
            Notification, pk=notification_id, user=request.user
        )
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(
            {"detail": "Notification marked as read."}, status=status.HTTP_200_OK
        )
