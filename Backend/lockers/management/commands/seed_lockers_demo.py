from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from households.models import Household, HouseholdMembership

from lockers.models import LockerCompartment, LockerListing, LockerSite
from lockers.services import generate_six_digit_code


User = get_user_model()


SITES = [
    {
        "name": "UCLA Westwood Lockers",
        "address_label": "1000 Westwood Blvd, Los Angeles, CA 90024",
        "latitude": Decimal("34.063100"),
        "longitude": Decimal("-118.444700"),
        "description": "NeighborFridge lockers near UCLA campus — great for students sharing extra groceries.",
    },
    {
        "name": "DTLA Grand Central Market Lockers",
        "address_label": "317 S Broadway, Los Angeles, CA 90013",
        "latitude": Decimal("34.050500"),
        "longitude": Decimal("-118.248900"),
        "description": "Downtown LA lockers near Grand Central Market.",
    },
    {
        "name": "Silver Lake Community Lockers",
        "address_label": "3503 Sunset Blvd, Los Angeles, CA 90026",
        "latitude": Decimal("34.083500"),
        "longitude": Decimal("-118.268200"),
        "description": "Silver Lake neighborhood fridge lockers on Sunset.",
    },
    {
        "name": "Echo Park Lockers",
        "address_label": "1632 W Temple St, Los Angeles, CA 90026",
        "latitude": Decimal("34.073800"),
        "longitude": Decimal("-118.256300"),
        "description": "Community lockers near Echo Park Lake.",
    },
    {
        "name": "Koreatown Plaza Lockers",
        "address_label": "928 S Western Ave, Los Angeles, CA 90006",
        "latitude": Decimal("34.053500"),
        "longitude": Decimal("-118.309100"),
        "description": "Lockers in the heart of K-Town for sharing home-cooked extras.",
    },
    {
        "name": "Hollywood & Vine Lockers",
        "address_label": "6250 Hollywood Blvd, Los Angeles, CA 90028",
        "latitude": Decimal("34.101600"),
        "longitude": Decimal("-118.325800"),
        "description": "Public food-share lockers near the Hollywood & Vine metro station.",
    },
    {
        "name": "Venice Boardwalk Lockers",
        "address_label": "1800 Ocean Front Walk, Venice, CA 90291",
        "latitude": Decimal("33.990900"),
        "longitude": Decimal("-118.476500"),
        "description": "Beach-side lockers for the Venice community.",
    },
    {
        "name": "Pasadena Old Town Lockers",
        "address_label": "55 S Raymond Ave, Pasadena, CA 91105",
        "latitude": Decimal("34.145400"),
        "longitude": Decimal("-118.148500"),
        "description": "Food-share lockers in Old Town Pasadena.",
    },
]


DEMO_LISTINGS = [
    {
        "storage_type": LockerCompartment.StorageType.DRY,
        "item_name": "Pasta (1 lb)",
        "price": Decimal("3.99"),
        "image_url": "https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&w=800&q=80",
    },
    {
        "storage_type": LockerCompartment.StorageType.REFRIGERATED,
        "item_name": "Greek yogurt (32 oz)",
        "price": Decimal("5.49"),
        "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
    },
    {
        "storage_type": LockerCompartment.StorageType.FROZEN,
        "item_name": "Frozen veggies mix (12 oz)",
        "price": Decimal("4.25"),
        "image_url": "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80",
    },
]


class Command(BaseCommand):
    help = "Seed demo public locker sites, compartments, and sample listings (idempotent)."

    def handle(self, *args, **options):
        with transaction.atomic():
            seller, created = User.objects.get_or_create(
                username="demo_locker_seller",
                defaults={
                    "email": "demo_locker_seller@neighborfridge.test",
                    "display_name": "Demo Locker Seller",
                },
            )
            if created:
                seller.set_password("FreshFridge2026!")
                seller.save(update_fields=["password"])

                household = Household.objects.create(
                    name="Demo Locker Household",
                    created_by=seller,
                )
                HouseholdMembership.objects.create(
                    user=seller,
                    household=household,
                    role=HouseholdMembership.Role.OWNER,
                    status=HouseholdMembership.Status.ACTIVE,
                    can_upload_receipts=True,
                    can_post_share=True,
                    can_manage_members=True,
                )
                seller.default_household = household
                seller.save(update_fields=["default_household"])

            sites_created = 0
            compartments_created = 0
            listings_created = 0

            for site_seed in SITES:
                site, site_was_created = LockerSite.objects.get_or_create(
                    name=site_seed["name"],
                    defaults={
                        "address_label": site_seed["address_label"],
                        "latitude": site_seed["latitude"],
                        "longitude": site_seed["longitude"],
                        "description": site_seed["description"],
                        "is_active": True,
                    },
                )
                if site_was_created:
                    sites_created += 1

                compartments_created += self._ensure_compartments(site)
                listings_created += self._ensure_listings(site, seller)

        self.stdout.write(self.style.SUCCESS("Locker demo seed complete."))
        self.stdout.write(f"Sites created: {sites_created}")
        self.stdout.write(f"Compartments created: {compartments_created}")
        self.stdout.write(f"Listings created: {listings_created}")
        self.stdout.write("Demo seller: demo_locker_seller / FreshFridge2026!")

    def _ensure_compartments(self, site):
        created = 0
        for storage_type, prefix in (
            (LockerCompartment.StorageType.DRY, "D"),
            (LockerCompartment.StorageType.REFRIGERATED, "R"),
            (LockerCompartment.StorageType.FROZEN, "F"),
        ):
            for idx in range(1, 5):
                label = f"{prefix}-{idx:02d}"
                _, was_created = LockerCompartment.objects.get_or_create(
                    site=site,
                    label=label,
                    defaults={
                        "storage_type": storage_type,
                        "status": LockerCompartment.Status.AVAILABLE,
                    },
                )
                if was_created:
                    created += 1
        return created

    def _ensure_listings(self, site, seller):
        created = 0
        for seed in DEMO_LISTINGS:
            compartment = (
                LockerCompartment.objects.filter(
                    site=site,
                    storage_type=seed["storage_type"],
                )
                .order_by("id")
                .first()
            )
            if compartment is None:
                continue

            has_active = LockerListing.objects.filter(
                compartment=compartment,
                status__in=[
                    LockerListing.Status.RESERVED,
                    LockerListing.Status.AVAILABLE,
                    LockerListing.Status.SOLD,
                ],
            ).exists()
            if has_active:
                continue

            listing = LockerListing.objects.create(
                site=site,
                compartment=compartment,
                seller=seller,
                buyer=None,
                food_item=None,
                item_name=seed["item_name"],
                image_url=seed["image_url"],
                price=seed["price"],
                status=LockerListing.Status.AVAILABLE,
                reserved_until=None,
                dropoff_code=generate_six_digit_code(),
                pickup_code="",
                escrow_amount=Decimal("0.00"),
            )
            created += 1

            compartment.status = LockerCompartment.Status.OCCUPIED
            compartment.save(update_fields=["status"])

            # Keep linter quiet about unused variable in some editors.
            _ = listing

        return created

