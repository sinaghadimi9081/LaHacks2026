from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import FoodItem

from .models import CreditTransaction, LockerCompartment, LockerListing, LockerSite
from .serializers import LockerListingSerializer, LockerSiteSerializer
from .services import generate_six_digit_code, required_storage_type_for_food_item


User = get_user_model()

RESERVATION_TTL_MINUTES = 60


def _get_active_household_food_item_or_400(user, food_item_id):
    if not user.default_household_id:
        raise ValidationError({"detail": "Select a household before creating locker listings."})
    try:
        return FoodItem.objects.get(pk=food_item_id, household_id=user.default_household_id)
    except FoodItem.DoesNotExist as exc:
        raise ValidationError({"detail": "Food item not found in your active household."}) from exc


class LockerSiteListView(generics.ListAPIView):
    serializer_class = LockerSiteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LockerSite.objects.filter(is_active=True).order_by("id")

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"sites": serializer.data}, status=status.HTTP_200_OK)


class LockerListingFeedView(generics.ListAPIView):
    serializer_class = LockerListingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        site_id = self.request.query_params.get("site_id")
        queryset = LockerListing.objects.select_related("site", "compartment").filter(
            status=LockerListing.Status.AVAILABLE
        )
        if site_id:
            queryset = queryset.filter(site_id=site_id)
        return queryset.order_by("-created_at")

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"listings": serializer.data}, status=status.HTTP_200_OK)


class MyLockerListingsView(generics.ListAPIView):
    serializer_class = LockerListingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            LockerListing.objects.select_related("site", "compartment")
            .filter(Q(seller=self.request.user) | Q(buyer=self.request.user))
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"listings": serializer.data}, status=status.HTTP_200_OK)


class LockerReserveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        food_item_id = request.data.get("food_item_id")
        site_id = request.data.get("site_id")
        if not food_item_id or not site_id:
            raise ValidationError({"detail": "food_item_id and site_id are required."})

        site = generics.get_object_or_404(LockerSite.objects.filter(is_active=True), pk=site_id)
        food_item = _get_active_household_food_item_or_400(request.user, food_item_id)

        price = Decimal(str(food_item.estimated_price or "0.00"))
        if price <= Decimal("0.00"):
            raise ValidationError({"detail": "This item has no estimated price and cannot be listed in lockers."})

        required_storage = required_storage_type_for_food_item(food_item)

        with transaction.atomic():
            compartments = (
                LockerCompartment.objects.select_for_update()
                .filter(
                    site=site,
                    storage_type=required_storage,
                    status=LockerCompartment.Status.AVAILABLE,
                )
                .order_by("id")
            )
            compartment = compartments.first()
            if compartment is None:
                raise ValidationError({"detail": f"No {required_storage} locker compartments are available at this site."})

            now = timezone.now()
            listing = LockerListing.objects.create(
                site=site,
                compartment=compartment,
                seller=request.user,
                food_item=food_item,
                item_name=food_item.name,
                image_url=getattr(food_item, "image_url", "") or "",
                price=price,
                status=LockerListing.Status.RESERVED,
                reserved_until=now + timedelta(minutes=RESERVATION_TTL_MINUTES),
                dropoff_code=generate_six_digit_code(),
            )
            compartment.status = LockerCompartment.Status.RESERVED
            compartment.save(update_fields=["status"])

        serializer = LockerListingSerializer(listing, context={"request": request})
        return Response({"listing": serializer.data}, status=status.HTTP_201_CREATED)


class LockerDropoffView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, listing_id):
        dropoff_code = str(request.data.get("dropoff_code") or "").strip()
        if not dropoff_code:
            raise ValidationError({"detail": "dropoff_code is required."})

        with transaction.atomic():
            listing = generics.get_object_or_404(
                LockerListing.objects.select_related("compartment", "site").select_for_update(),
                pk=listing_id,
            )
            if listing.seller_id != request.user.id:
                raise ValidationError({"detail": "Only the seller can confirm a locker dropoff."})
            if listing.status != LockerListing.Status.RESERVED:
                raise ValidationError({"detail": "This listing is not awaiting dropoff."})
            if listing.reserved_until and timezone.now() > listing.reserved_until:
                listing.status = LockerListing.Status.CANCELLED
                listing.save(update_fields=["status", "updated_at"])
                listing.compartment.status = LockerCompartment.Status.AVAILABLE
                listing.compartment.save(update_fields=["status"])
                raise ValidationError({"detail": "This reservation expired. Create a new locker reservation."})
            if listing.dropoff_code != dropoff_code:
                raise ValidationError({"detail": "Invalid dropoff code."})

            listing.status = LockerListing.Status.AVAILABLE
            listing.reserved_until = None
            listing.save(update_fields=["status", "reserved_until", "updated_at"])
            listing.compartment.status = LockerCompartment.Status.OCCUPIED
            listing.compartment.save(update_fields=["status"])

        serializer = LockerListingSerializer(listing, context={"request": request})
        return Response({"listing": serializer.data}, status=status.HTTP_200_OK)


class LockerBuyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, listing_id):
        with transaction.atomic():
            listing = generics.get_object_or_404(
                LockerListing.objects.select_related("seller", "compartment", "site").select_for_update(),
                pk=listing_id,
            )
            if listing.status != LockerListing.Status.AVAILABLE:
                raise ValidationError({"detail": "This locker listing is not available."})
            if listing.seller_id == request.user.id:
                raise ValidationError({"detail": "You cannot buy your own locker listing."})

            buyer = User.objects.select_for_update().get(pk=request.user.id)
            price = Decimal(str(listing.price or "0.00"))
            if price <= Decimal("0.00"):
                raise ValidationError({"detail": "This listing has an invalid price."})

            if buyer.credits_balance < price:
                raise ValidationError({"detail": "Insufficient credits to buy this locker listing."})

            buyer.credits_balance = buyer.credits_balance - price
            buyer.save(update_fields=["credits_balance"])

            listing.buyer = buyer
            listing.status = LockerListing.Status.SOLD
            listing.pickup_code = generate_six_digit_code()
            listing.escrow_amount = price
            listing.save(update_fields=["buyer", "status", "pickup_code", "escrow_amount", "updated_at"])

            CreditTransaction.objects.create(
                kind=CreditTransaction.Kind.LOCKER_PURCHASE_ESCROW,
                from_user=buyer,
                to_user=None,
                amount=price,
                listing=listing,
            )

        serializer = LockerListingSerializer(listing, context={"request": request})
        return Response({"listing": serializer.data}, status=status.HTTP_200_OK)


class LockerPickupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, listing_id):
        pickup_code = str(request.data.get("pickup_code") or "").strip()
        if not pickup_code:
            raise ValidationError({"detail": "pickup_code is required."})

        with transaction.atomic():
            listing = generics.get_object_or_404(
                LockerListing.objects.select_related("seller", "compartment", "site").select_for_update(),
                pk=listing_id,
            )
            if listing.status != LockerListing.Status.SOLD:
                raise ValidationError({"detail": "This locker listing is not awaiting pickup."})
            if listing.buyer_id != request.user.id:
                raise ValidationError({"detail": "Only the buyer can confirm pickup."})
            if listing.pickup_code != pickup_code:
                raise ValidationError({"detail": "Invalid pickup code."})

            payout = Decimal(str(listing.escrow_amount or listing.price or "0.00"))
            if payout > Decimal("0.00") and listing.seller_id:
                seller = User.objects.select_for_update().get(pk=listing.seller_id)
                seller.credits_balance = seller.credits_balance + payout
                seller.save(update_fields=["credits_balance"])
                CreditTransaction.objects.create(
                    kind=CreditTransaction.Kind.LOCKER_PAYOUT_RELEASE,
                    from_user=None,
                    to_user=seller,
                    amount=payout,
                    listing=listing,
                )

            listing.status = LockerListing.Status.PICKED_UP
            listing.escrow_amount = Decimal("0.00")
            listing.escrow_released_at = timezone.now()
            listing.save(update_fields=["status", "escrow_amount", "escrow_released_at", "updated_at"])

            listing.compartment.status = LockerCompartment.Status.AVAILABLE
            listing.compartment.save(update_fields=["status"])

        serializer = LockerListingSerializer(listing, context={"request": request})
        return Response({"listing": serializer.data}, status=status.HTTP_200_OK)

