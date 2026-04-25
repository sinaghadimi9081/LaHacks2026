from decimal import Decimal

from rest_framework import serializers

from .models import ParsedReceiptItem, Receipt


class ParsedReceiptItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParsedReceiptItem
        fields = (
            "id",
            "name",
            "standardized_name",
            "category_tag",
            "expiration_days",
            "estimated_price",
            "image_url",
            "image_file",
            "description",
            "quantity",
            "selected",
        )
        read_only_fields = fields


class ReceiptSerializer(serializers.ModelSerializer):
    receipt_id = serializers.IntegerField(source="id", read_only=True)
    parsed_items = ParsedReceiptItemSerializer(many=True, read_only=True)
    detected_total = serializers.SerializerMethodField()
    parsed_item_total = serializers.SerializerMethodField()

    def get_detected_total(self, obj):
        context_total = self.context.get("detected_total")
        if context_total not in (None, ""):
            return context_total
        if obj.detected_total_amount is None:
            return None
        return f'{Decimal(str(obj.detected_total_amount)):.2f}'

    def get_parsed_item_total(self, obj):
        total = Decimal("0.00")
        for item in obj.parsed_items.all():
            if item.estimated_price is None:
                continue
            total += item.estimated_price

        return f"{total:.2f}"

    class Meta:
        model = Receipt
        fields = (
            "receipt_id",
            "image",
            "store_name",
            "raw_text",
            "created_at",
            "detected_total",
            "parsed_item_total",
            "parsed_items",
        )
        read_only_fields = fields
