from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import FoodItem
from households.models import Household, HouseholdMembership

from .models import LockerCompartment, LockerListing, LockerSite


User = get_user_model()


class LockerApiTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(
            username="seller",
            email="seller@example.com",
            password="safe-password-123",
            display_name="Seller User",
        )
        self.buyer = User.objects.create_user(
            username="buyer",
            email="buyer@example.com",
            password="safe-password-123",
            display_name="Buyer User",
            credits_balance=Decimal("25.00"),
        )

        self.seller_household = Household.objects.create(name="Seller household", created_by=self.seller)
        HouseholdMembership.objects.create(
            user=self.seller,
            household=self.seller_household,
            role=HouseholdMembership.Role.OWNER,
            status=HouseholdMembership.Status.ACTIVE,
            can_upload_receipts=True,
            can_post_share=True,
            can_manage_members=True,
        )
        self.seller.default_household = self.seller_household
        self.seller.save(update_fields=["default_household"])

        self.buyer_household = Household.objects.create(name="Buyer household", created_by=self.buyer)
        HouseholdMembership.objects.create(
            user=self.buyer,
            household=self.buyer_household,
            role=HouseholdMembership.Role.OWNER,
            status=HouseholdMembership.Status.ACTIVE,
            can_upload_receipts=True,
            can_post_share=True,
            can_manage_members=True,
        )
        self.buyer.default_household = self.buyer_household
        self.buyer.save(update_fields=["default_household"])

        self.seller_client = APIClient()
        self.seller_client.force_authenticate(self.seller)
        self.buyer_client = APIClient()
        self.buyer_client.force_authenticate(self.buyer)

        self.site = LockerSite.objects.create(
            name="Demo Locker Site",
            address_label="Los Angeles, CA",
            latitude=Decimal("34.050000"),
            longitude=Decimal("-118.250000"),
            is_active=True,
        )
        self.dry = LockerCompartment.objects.create(
            site=self.site, storage_type=LockerCompartment.StorageType.DRY, label="D-01"
        )
        self.fridge = LockerCompartment.objects.create(
            site=self.site, storage_type=LockerCompartment.StorageType.REFRIGERATED, label="R-01"
        )
        self.frozen = LockerCompartment.objects.create(
            site=self.site, storage_type=LockerCompartment.StorageType.FROZEN, label="F-01"
        )

    def test_reserve_dropoff_buy_pickup_flow(self):
        food_item = FoodItem.objects.create(
            household=self.seller_household,
            created_by=self.seller,
            name="Greek yogurt",
            category_tag="dairy",
            quantity=1,
            estimated_price=Decimal("5.50"),
            image_url="",
            owner_name="Seller User",
        )

        reserve = self.seller_client.post(
            "/api/lockers/listings/reserve/",
            {"food_item_id": food_item.id, "site_id": self.site.id},
            format="json",
        )
        self.assertEqual(reserve.status_code, status.HTTP_201_CREATED)
        listing = reserve.data["listing"]
        self.assertEqual(listing["status"], "reserved")
        self.assertEqual(listing["storage_type"], "refrigerated")
        self.assertTrue(listing["dropoff_code"])

        listing_id = listing["id"]
        wrong_dropoff = self.seller_client.patch(
            f"/api/lockers/listings/{listing_id}/dropoff/",
            {"dropoff_code": "999999"},
            format="json",
        )
        self.assertEqual(wrong_dropoff.status_code, status.HTTP_400_BAD_REQUEST)

        ok_dropoff = self.seller_client.patch(
            f"/api/lockers/listings/{listing_id}/dropoff/",
            {"dropoff_code": listing["dropoff_code"]},
            format="json",
        )
        self.assertEqual(ok_dropoff.status_code, status.HTTP_200_OK)
        self.assertEqual(ok_dropoff.data["listing"]["status"], "available")

        feed = self.buyer_client.get("/api/lockers/listings/feed/", {"site_id": str(self.site.id)})
        self.assertEqual(feed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(feed.data["listings"]), 1)
        self.assertEqual(feed.data["listings"][0]["id"], listing_id)

        buy = self.buyer_client.patch(f"/api/lockers/listings/{listing_id}/buy/", {}, format="json")
        self.assertEqual(buy.status_code, status.HTTP_200_OK)
        self.assertEqual(buy.data["listing"]["status"], "sold")
        self.assertTrue(buy.data["listing"]["pickup_code"])

        self.buyer.refresh_from_db()
        self.assertEqual(self.buyer.credits_balance, Decimal("19.50"))

        wrong_pickup = self.buyer_client.patch(
            f"/api/lockers/listings/{listing_id}/pickup/",
            {"pickup_code": "111111"},
            format="json",
        )
        self.assertEqual(wrong_pickup.status_code, status.HTTP_400_BAD_REQUEST)

        ok_pickup = self.buyer_client.patch(
            f"/api/lockers/listings/{listing_id}/pickup/",
            {"pickup_code": buy.data["listing"]["pickup_code"]},
            format="json",
        )
        self.assertEqual(ok_pickup.status_code, status.HTTP_200_OK)
        self.assertEqual(ok_pickup.data["listing"]["status"], "picked_up")

        self.seller.refresh_from_db()
        self.assertEqual(self.seller.credits_balance, Decimal("5.50"))

        self.fridge.refresh_from_db()
        self.assertEqual(self.fridge.status, LockerCompartment.Status.AVAILABLE)

    def test_buy_requires_credits(self):
        listing = LockerListing.objects.create(
            site=self.site,
            compartment=self.dry,
            seller=self.seller,
            item_name="Pasta",
            image_url="",
            price=Decimal("10.00"),
            status=LockerListing.Status.AVAILABLE,
            dropoff_code="123456",
        )
        self.dry.status = LockerCompartment.Status.OCCUPIED
        self.dry.save(update_fields=["status"])

        broke_user = User.objects.create_user(
            username="broke",
            email="broke@example.com",
            password="safe-password-123",
            display_name="Broke User",
            credits_balance=Decimal("0.00"),
        )
        broke_household = Household.objects.create(name="Broke household", created_by=broke_user)
        HouseholdMembership.objects.create(
            user=broke_user,
            household=broke_household,
            role=HouseholdMembership.Role.OWNER,
            status=HouseholdMembership.Status.ACTIVE,
        )
        broke_user.default_household = broke_household
        broke_user.save(update_fields=["default_household"])

        broke_client = APIClient()
        broke_client.force_authenticate(broke_user)
        response = broke_client.patch(f"/api/lockers/listings/{listing.id}/buy/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LockerSeedCommandTests(TestCase):
    def test_seed_lockers_demo_is_idempotent(self):
        call_command("seed_lockers_demo")
        call_command("seed_lockers_demo")

        self.assertEqual(LockerSite.objects.count(), 3)
        self.assertGreaterEqual(LockerCompartment.objects.count(), 36)
        # Should seed at least one listing per site.
        self.assertGreaterEqual(LockerListing.objects.filter(status=LockerListing.Status.AVAILABLE).count(), 3)

