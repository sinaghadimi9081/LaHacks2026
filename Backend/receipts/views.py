from decimal import Decimal, InvalidOperation
from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from core.models import FoodItem
from core.services.item_verifier import verify_and_enrich_items
from households.models import HouseholdMembership

from .models import ParsedReceiptItem, Receipt
from .receipt_parser import extract_receipt_total, extract_store_name
from .receipt_processing import ReceiptProcessingError, process_receipt_image
from .serializers import ReceiptSerializer


def _active_household_membership(user):
    if not user.is_authenticated:
        raise PermissionDenied("Authentication required.")

    if not user.default_household_id:
        raise PermissionDenied("Select a household before uploading receipts.")

    membership = (
        HouseholdMembership.objects.filter(
            user=user,
            household_id=user.default_household_id,
            status=HouseholdMembership.Status.ACTIVE,
        )
        .select_related("household")
        .first()
    )

    if membership is None:
        raise PermissionDenied("You do not have access to the active household.")

    return membership


def _get_household_receipt_or_404(request, receipt_id):
    membership = _active_household_membership(request.user)
    return get_object_or_404(
        Receipt.objects.prefetch_related("parsed_items"),
        pk=receipt_id,
        household=membership.household,
    )


def _safe_decimal(value, default=Decimal("0.00")):
    if value in (None, ""):
        return default

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


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
@parser_classes([MultiPartParser, FormParser])
def upload_receipt(request):
    membership = _active_household_membership(request.user)
    if not membership.can_upload_receipts:
        raise PermissionDenied("You cannot upload receipts for this household.")

    image = request.FILES.get("image")
    if image is None:
        return Response(
            {"detail": 'Upload an image file using the "image" form-data key.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    receipt = Receipt.objects.create(
        image=image,
        uploaded_by=request.user,
        household=membership.household,
    )

    try:
        processing_result = process_receipt_image(receipt.image.path)
        processing_result.parsed_items = verify_and_enrich_items(
            processing_result.parsed_items,
            processing_result.store_name or receipt.store_name,
        )
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
    receipt.save(update_fields=["raw_text", "store_name", "detected_total_amount"])

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
def receipt_detail(request, receipt_id):
    receipt = _get_household_receipt_or_404(request, receipt_id)
    _persist_receipt_metadata(receipt)
    serializer = ReceiptSerializer(
        receipt,
        context={"request": request},
    )
    return Response(serializer.data)


@api_view(["POST"])
def confirm_receipt(request, receipt_id):
    membership = _active_household_membership(request.user)
    if not membership.can_upload_receipts:
        raise PermissionDenied("You cannot confirm receipts for this household.")

    receipt = _get_household_receipt_or_404(request, receipt_id)

    items_data = request.data.get("items", [])
    if not items_data:
        return Response({"detail": "No items provided."}, status=status.HTTP_400_BAD_REQUEST)

    parsed_items_by_id = {item.id: item for item in receipt.parsed_items.all()}
    food_items = []
    today = timezone.now().date()

    with transaction.atomic():
        for item_data in items_data:
            item_id = item_data.get("id")
            parsed_item = parsed_items_by_id.get(item_id)
            if parsed_item is None:
                return Response(
                    {"detail": f"Parsed receipt item {item_id} does not belong to this receipt."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            is_selected = bool(item_data.get("selected", True))
            parsed_item.selected = is_selected
            parsed_item.name = item_data.get("name") or parsed_item.name
            parsed_item.standardized_name = item_data.get(
                "standardized_name",
                parsed_item.standardized_name,
            )
            parsed_item.quantity = int(item_data.get("quantity", parsed_item.quantity or 1))
            parsed_item.category_tag = item_data.get("category_tag", parsed_item.category_tag or "")
            parsed_item.expiration_days = item_data.get(
                "expiration_days",
                parsed_item.expiration_days,
            )
            parsed_item.estimated_price = _safe_decimal(
                item_data.get("estimated_price", parsed_item.estimated_price),
                default=Decimal("0.00"),
            )
            parsed_item.image_url = item_data.get("image_url", parsed_item.image_url or "")
            parsed_item.description = item_data.get("description", parsed_item.description or "")
            parsed_item.save(
                update_fields=[
                    "selected",
                    "name",
                    "standardized_name",
                    "quantity",
                    "category_tag",
                    "expiration_days",
                    "estimated_price",
                    "image_url",
                    "description",
                ]
            )

            if not is_selected:
                continue

            exp_days = parsed_item.expiration_days
            exp_date = today + timedelta(days=int(exp_days)) if exp_days is not None else None
            est_price = parsed_item.estimated_price or Decimal("0.00")

            food_items.append(
                FoodItem(
                    household=membership.household,
                    created_by=request.user,
                    name=parsed_item.standardized_name or parsed_item.name or "Unknown Item",
                    category_tag=parsed_item.category_tag or "",
                    quantity=int(parsed_item.quantity or 1),
                    expiration_date=exp_date,
                    estimated_price=est_price,
                    image_url=parsed_item.image_url or "",
                    description=parsed_item.description or "",
                    owner_name=request.user.full_display_name,
                )
            )

        if not food_items:
            return Response(
                {"detail": "Select at least one item to save to the pantry."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        FoodItem.objects.bulk_create(food_items)
        receipt.confirmed_at = timezone.now()
        receipt.save(update_fields=["confirmed_at"])

    return Response(
        {
            "detail": f"Successfully added {len(food_items)} items to pantry.",
            "created_count": len(food_items),
            "confirmed_at": receipt.confirmed_at,
        },
        status=status.HTTP_201_CREATED,
    )
