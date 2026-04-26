from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..serializers import PostReadSerializer, PostWriteSerializer
from .helpers import get_post_serializer_class, post_queryset, serialize_post, serializer_context


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = post_queryset()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return PostReadSerializer
        return PostWriteSerializer

    def get_serializer_context(self):
        return serializer_context(self.request)

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
        return Response(serialize_post(instance, request), status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        cls = get_post_serializer_class(instance, request.user)
        return Response(
            cls(instance, context=serializer_context(request)).data,
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        self.perform_destroy(self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)
