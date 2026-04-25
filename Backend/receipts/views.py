from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import ParsedReceiptItem, Receipt
from datetime import timedelta
from django.utils import timezone
from core.models import FoodItem
from core.services.item_verifier import verify_and_enrich_items
from .receipt_parser import (
    extract_receipt_total,
    extract_store_name,
)
from .receipt_processing import ReceiptProcessingError, process_receipt_image
from .serializers import ReceiptSerializer

def _delete_receipt_image(receipt):
    if receipt.image:
        receipt.image.delete(save=False)
    receipt.delete()


def _persist_receipt_metadata(receipt):
    update_fields = []

    if not receipt.store_name and receipt.raw_text:
        store_name = extract_store_name(receipt.raw_text)
        if store_name:
            receipt.store_name = store_name
            update_fields.append("store_name")

    if receipt.detected_total_amount is None:
        detected_total = extract_receipt_total(
            receipt.image.path,
            raw_text=receipt.raw_text,
        )
        if detected_total is not None:
            receipt.detected_total_amount = detected_total
            update_fields.append("detected_total_amount")

    if update_fields:
        receipt.save(update_fields=update_fields)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def upload_receipt(request):
    image = request.FILES.get("image")
    if image is None:
        return Response(
            {"detail": 'Upload an image file using the "image" form-data key.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    receipt = Receipt.objects.create(image=image)

    try:
        processing_result = process_receipt_image(receipt.image.path)
        processing_result.parsed_items = verify_and_enrich_items(processing_result.parsed_items, receipt.store_name)
    except ReceiptProcessingError as exc:
        _delete_receipt_image(receipt)
        return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as exc:
        _delete_receipt_image(receipt)
        return Response(
            {"detail": f"Receipt OCR failed: {exc}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    receipt.raw_text = processing_result.raw_text
    receipt.store_name = processing_result.store_name
    receipt.detected_total_amount = processing_result.detected_total
    receipt.save(
        update_fields=["raw_text", "store_name", "detected_total_amount"]
    )

    ParsedReceiptItem.objects.bulk_create(
        [
            ParsedReceiptItem(
                receipt=receipt,
                name=item["name"],
                standardized_name=item.get("standardized_name", ""),
                category_tag=item.get("category_tag", ""),
                expiration_days=item.get("expiration_days"),
                estimated_price=item.get("estimated_price"),
                image_url=item.get("image_url", ""),
                description=item.get("description", ""),
                quantity=item.get("quantity", 1),
            )
            for item in processing_result.parsed_items
        ]
    )

    receipt = Receipt.objects.prefetch_related("parsed_items").get(pk=receipt.pk)
    serializer = ReceiptSerializer(
        receipt,
        context={
            "request": request,
            "detected_total": processing_result.detected_total,
        },
    )
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def receipt_detail(request, receipt_id):
    receipt = get_object_or_404(
        Receipt.objects.prefetch_related("parsed_items"),
        pk=receipt_id,
    )
    _persist_receipt_metadata(receipt)
    serializer = ReceiptSerializer(
        receipt,
        context={
            "request": request,
        },
    )
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_receipt(request, receipt_id):
    receipt = get_object_or_404(Receipt, pk=receipt_id)
    items_data = request.data.get("items", [])
    
    if not items_data:
        return Response({"detail": "No items provided."}, status=status.HTTP_400_BAD_REQUEST)

    food_items = []
    today = timezone.now().date()

    for item_data in items_data:
        exp_days = item_data.get("expiration_days")
        exp_date = today + timedelta(days=int(exp_days)) if exp_days is not None else None
        
        # Convert estimated_price carefully
        est_price = item_data.get("estimated_price")
        if est_price is None or str(est_price).strip() == "":
            est_price = 0.00
            
        # Try to associate with the user's default household
        household = None
        owner_name = "Anonymous"
        if request.user.is_authenticated:
            household = request.user.default_household
            owner_name = request.user.display_name or request.user.username

        food_items.append(
            FoodItem(
                name=item_data.get("standardized_name") or item_data.get("name") or "Unknown Item",
                quantity=int(item_data.get("quantity", 1)),
                expiration_date=exp_date,
                estimated_price=est_price,
                image_url=item_data.get("image_url", ""),
                description=item_data.get("description", ""),
                owner_name=owner_name,
                household=household,
            )
        )
    
    FoodItem.objects.bulk_create(food_items)
    
    return Response(
        {"detail": f"Successfully added {len(food_items)} items to pantry."}, 
        status=status.HTTP_201_CREATED
    )
