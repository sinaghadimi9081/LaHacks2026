from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from ..models import PostRequest, PostRequestMessage
from ..serializers import (
    PostRequestMessageReadSerializer,
    PostRequestMessageWriteSerializer,
    PostRequestReadSerializer,
)
from .helpers import request_queryset, serializer_context


def _get_chat_request(request, request_id):
    post_request = generics.get_object_or_404(
        request_queryset(),
        pk=request_id,
    )

    is_owner = post_request.post.owner_id == request.user.id
    is_requester = post_request.requester_id == request.user.id
    if not (is_owner or is_requester):
        raise PermissionDenied("Only matched neighbors can open this conversation.")

    if post_request.status != PostRequest.Status.APPROVED:
        raise ValidationError({"detail": "Messaging unlocks after the owner approves the request."})

    return post_request


class PostRequestMessageListCreateView(generics.ListCreateAPIView):
    serializer_class = PostRequestMessageReadSerializer

    def get_post_request(self):
        return _get_chat_request(self.request, self.kwargs["request_id"])

    def get_queryset(self):
        post_request = self.get_post_request()
        return PostRequestMessage.objects.filter(post_request=post_request).select_related("sender")

    def get_serializer_context(self):
        return {"request": self.request}

    def list(self, request, *args, **kwargs):
        post_request = self.get_post_request()
        serializer = self.get_serializer(self.get_queryset(), many=True)
        request_serializer = PostRequestReadSerializer(
            post_request,
            context=serializer_context(request),
        )
        return Response(
            {
                "request": request_serializer.data,
                "messages": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        post_request = self.get_post_request()
        write_serializer = PostRequestMessageWriteSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)

        message = PostRequestMessage.objects.create(
            post_request=post_request,
            sender=request.user,
            body=write_serializer.validated_data["body"],
        )

        serializer = self.get_serializer(message)
        return Response({"message": serializer.data}, status=status.HTTP_201_CREATED)
