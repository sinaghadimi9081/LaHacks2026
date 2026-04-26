from django.db import DatabaseError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import ImpactLog
from core.notifications import NotificationService
from core.services.impact_calculator import calculate_impact

from ..models import Post, PostRequest
from ..serializers import PostRequestReadSerializer
from .helpers import filtered_posts, request_queryset, serialize_post, serializer_context


class PostClaimView(APIView):
    def patch(self, request, post_id):
        with transaction.atomic():
            from .helpers import post_queryset
            post = generics.get_object_or_404(
                post_queryset().select_for_update(), pk=post_id
            )

            if post.owner_id == request.user.id:
                raise ValidationError({"detail": "You cannot request your own post."})

            if post.status == Post.Status.CLAIMED:
                if post.claimed_by_user_id == request.user.id:
                    return Response(serialize_post(post, request), status=status.HTTP_200_OK)
                raise ValidationError({"detail": "This post has already been matched."})

            pending = post.get_pending_request()
            if pending and pending.requester_id != request.user.id:
                raise ValidationError(
                    {"detail": "This post already has a pending request awaiting the owner's response."}
                )

            post_request = post.get_request_for_user(request.user)
            if post_request and post_request.status == PostRequest.Status.PENDING:
                return Response(
                    serialize_post(post, request, force_public=True), status=status.HTTP_200_OK
                )

            if post_request is None:
                post_request = PostRequest.objects.create(post=post, requester=request.user)
            else:
                post_request.status = PostRequest.Status.PENDING
                post_request.responded_at = None
                post_request.save(update_fields=["status", "responded_at"])

            post.status = Post.Status.PENDING
            post.claimed_by_user = None
            post.claimed_by = None
            post.save(update_fields=["status", "claimed_by_user", "claimed_by", "updated_at"])

        if post.owner_id:
            NotificationService.notify_marketplace_request(post, request.user)

        return Response(serialize_post(post, request, force_public=True), status=status.HTTP_200_OK)


class IncomingPostRequestListView(generics.ListAPIView):
    serializer_class = PostRequestReadSerializer

    def get_queryset(self):
        queryset = request_queryset().filter(post__owner=self.request.user)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset.order_by("-created_at")

    def get_serializer_context(self):
        return serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"requests": serializer.data}, status=status.HTTP_200_OK)


class OutgoingPostRequestListView(generics.ListAPIView):
    serializer_class = PostRequestReadSerializer

    def get_queryset(self):
        queryset = request_queryset().filter(requester=self.request.user)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset.order_by("-created_at")

    def get_serializer_context(self):
        return serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"requests": serializer.data}, status=status.HTTP_200_OK)


class PostRequestActionView(APIView):
    def _get_pending_request(self, request, request_id):
        return generics.get_object_or_404(
            request_queryset().select_for_update(),
            pk=request_id,
            post__owner=request.user,
            status=PostRequest.Status.PENDING,
        )

    def patch(self, request, request_id, action):
        with transaction.atomic():
            post_request = self._get_pending_request(request, request_id)
            post = post_request.post
            now = timezone.now()

            if action == "approve":
                post_request.status = PostRequest.Status.APPROVED
                post_request.responded_at = now
                post_request.save(update_fields=["status", "responded_at"])

                post.status = Post.Status.CLAIMED
                post.claimed_by_user = post_request.requester
                post.claimed_by = post_request.requester.full_display_name
                post.save(update_fields=["status", "claimed_by_user", "claimed_by", "updated_at"])

                try:
                    impact = calculate_impact(post)
                    ImpactLog.objects.create(
                        food_item=post.food_item,
                        user=post.owner,
                        household=getattr(post.owner, "default_household", None),
                        action="share_post_claimed",
                        dollars_saved=post.resolved_estimated_price,
                        water_saved_gallons=impact.water_gallons,
                        co2_saved_kg=impact.co2_kg,
                        electricity_saved_kwh=impact.kwh,
                    )
                    from users.models import User
                    User.objects.filter(pk=post.owner_id).update(
                        total_water_saved_gallons=F("total_water_saved_gallons") + impact.water_gallons,
                        total_co2_saved_kg=F("total_co2_saved_kg") + impact.co2_kg,
                        total_electricity_saved_kwh=F("total_electricity_saved_kwh") + impact.kwh,
                        total_posts_shared=F("total_posts_shared") + 1,
                    )
                except DatabaseError:
                    pass

                NotificationService.notify_marketplace_request_approved(post_request)
            elif action == "decline":
                post_request.status = PostRequest.Status.DECLINED
                post_request.responded_at = now
                post_request.save(update_fields=["status", "responded_at"])

                post.status = Post.Status.AVAILABLE
                post.claimed_by_user = None
                post.claimed_by = None
                post.save(update_fields=["status", "claimed_by_user", "claimed_by", "updated_at"])

                NotificationService.notify_marketplace_request_declined(post_request)
            else:
                raise ValidationError({"detail": "Unsupported request action."})

        serializer = PostRequestReadSerializer(post_request, context=serializer_context(request))
        return Response({"request": serializer.data}, status=status.HTTP_200_OK)
