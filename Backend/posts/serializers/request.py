from rest_framework import serializers

from ..models import PostRequest
from .post import ApprovedPostReadSerializer, PostReadSerializer


class PostRequestReadSerializer(serializers.ModelSerializer):
    from .post import PostOwnerSerializer
    requester = PostOwnerSerializer(read_only=True)
    post = serializers.SerializerMethodField()

    class Meta:
        model = PostRequest
        fields = ["id", "status", "created_at", "responded_at", "requester", "post"]
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
