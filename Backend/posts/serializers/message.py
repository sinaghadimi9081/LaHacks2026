from rest_framework import serializers

from ..models import PostRequestMessage
from .post import PostOwnerSerializer


class PostRequestMessageReadSerializer(serializers.ModelSerializer):
    sender = PostOwnerSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = PostRequestMessage
        fields = ["id", "body", "created_at", "sender", "is_mine"]
        read_only_fields = fields

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.sender_id == request.user.id)


class PostRequestMessageWriteSerializer(serializers.Serializer):
    body = serializers.CharField(allow_blank=False, trim_whitespace=True)

    def validate_body(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Enter a message before sending.")
        return normalized
