from datetime import date

from rest_framework import serializers

from .models import FoodItem


def _compute_status(expiration_date):
    if expiration_date is None:
        return 'fresh'
    days_left = (expiration_date - date.today()).days
    if days_left <= 0:
        return 'critical'
    if days_left <= 2:
        return 'feed today'
    if days_left <= 5:
        return 'use soon'
    return 'fresh'


class FoodItemSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    recipe_uses = serializers.SerializerMethodField()

    class Meta:
        model = FoodItem
        fields = [
            'id',
            'name',
            'category_tag',
            'quantity',
            'expiration_date',
            'estimated_price',
            'status',
            'owner_name',
            'image',
            'description',
            'recipe_uses',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'status']

    def get_image(self, obj):
        request = self.context.get('request')
        if obj.image_file:
            url = obj.image_file.url
            return request.build_absolute_uri(url) if request else url
        return obj.image_url or ''

    def get_status(self, obj):
        return _compute_status(obj.expiration_date)

    def get_recipe_uses(self, obj):
        return []
