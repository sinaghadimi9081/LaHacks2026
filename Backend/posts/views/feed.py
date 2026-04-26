from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..models import Post
from ..serializers import ApprovedPostReadSerializer, PostReadSerializer, PostWriteSerializer
from .helpers import filtered_posts, serializer_context


class PostFeedView(generics.ListAPIView):
    serializer_class = PostReadSerializer

    def get_queryset(self):
        return filtered_posts(self.request, Post.objects.all())

    def get_serializer_context(self):
        return serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"posts": serializer.data}, status=status.HTTP_200_OK)


class PostCreateView(generics.CreateAPIView):
    serializer_class = PostWriteSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(owner=request.user)
        return Response(
            ApprovedPostReadSerializer(post, context=serializer_context(request)).data,
            status=status.HTTP_201_CREATED,
        )


class MyPostListView(generics.ListAPIView):
    serializer_class = ApprovedPostReadSerializer

    def get_queryset(self):
        return filtered_posts(self.request, Post.objects.filter(owner=self.request.user))

    def get_serializer_context(self):
        return serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"posts": serializer.data}, status=status.HTTP_200_OK)
