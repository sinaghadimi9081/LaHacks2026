from django.urls import path

from .views import (
    LockerBuyView,
    LockerDropoffView,
    LockerListingFeedView,
    LockerPickupView,
    LockerReserveView,
    LockerSiteListView,
    MyLockerListingsView,
)

urlpatterns = [
    path("lockers/sites/", LockerSiteListView.as_view(), name="locker-sites"),
    path("lockers/listings/feed/", LockerListingFeedView.as_view(), name="locker-feed"),
    path("lockers/listings/mine/", MyLockerListingsView.as_view(), name="locker-mine"),
    path("lockers/listings/reserve/", LockerReserveView.as_view(), name="locker-reserve"),
    path("lockers/listings/<int:listing_id>/dropoff/", LockerDropoffView.as_view(), name="locker-dropoff"),
    path("lockers/listings/<int:listing_id>/buy/", LockerBuyView.as_view(), name="locker-buy"),
    path("lockers/listings/<int:listing_id>/pickup/", LockerPickupView.as_view(), name="locker-pickup"),
]

