from decimal import Decimal, ROUND_HALF_UP
from math import asin, cos, radians, sin, sqrt

from .models import PostRequest


_SIMULATED_BASE_FEE = Decimal("4.50")
_SIMULATED_MILE_FEE = Decimal("1.35")
_SIMULATED_PLATFORM_BUFFER = Decimal("1.25")
_SIMULATED_MAX_DISTANCE_MILES = 12
_SIMULATED_BASE_MINUTES = 18
_SIMULATED_MINUTES_PER_MILE = 6


def _distance_miles(latitude_a, longitude_a, latitude_b, longitude_b):
    earth_radius_miles = 3958.8
    latitude_delta = radians(latitude_b - latitude_a)
    longitude_delta = radians(longitude_b - longitude_a)
    latitude_a = radians(latitude_a)
    latitude_b = radians(latitude_b)
    arc = (
        sin(latitude_delta / 2) ** 2
        + cos(latitude_a) * cos(latitude_b) * sin(longitude_delta / 2) ** 2
    )
    return 2 * earth_radius_miles * asin(sqrt(arc))


def build_simulated_delivery_quote(post_request, *, reveal_exact_pickup=False):
    if post_request.fulfillment_method != PostRequest.FulfillmentMethod.DELIVERY:
        return None

    post = post_request.post
    pickup_location = (
        post.pickup_location if reveal_exact_pickup else post.get_public_pickup_location()
    ) or "Approximate pickup area"
    dropoff_location = post_request.dropoff_location or ""

    if (
        post.pickup_latitude is None
        or post.pickup_longitude is None
        or post_request.dropoff_latitude is None
        or post_request.dropoff_longitude is None
    ):
        return {
            "delivery_available": False,
            "estimated_fee": None,
            "estimated_minutes": None,
            "pickup_location": pickup_location,
            "dropoff_location": dropoff_location,
            "message": "Simulated delivery needs both pickup and dropoff coordinates before an estimate can be shown.",
        }

    distance_miles = _distance_miles(
        float(post.pickup_latitude),
        float(post.pickup_longitude),
        float(post_request.dropoff_latitude),
        float(post_request.dropoff_longitude),
    )

    if distance_miles > _SIMULATED_MAX_DISTANCE_MILES:
        return {
            "delivery_available": False,
            "estimated_fee": None,
            "estimated_minutes": None,
            "pickup_location": pickup_location,
            "dropoff_location": dropoff_location,
            "message": "Simulated delivery is only available for nearby dropoffs within 12 miles for this MVP.",
        }

    estimated_fee = (
        _SIMULATED_BASE_FEE
        + _SIMULATED_PLATFORM_BUFFER
        + (Decimal(str(distance_miles)) * _SIMULATED_MILE_FEE)
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    estimated_minutes = max(
        15,
        min(75, int(round(_SIMULATED_BASE_MINUTES + (distance_miles * _SIMULATED_MINUTES_PER_MILE)))),
    )

    return {
        "delivery_available": True,
        "estimated_fee": f"{estimated_fee:.2f}",
        "estimated_minutes": estimated_minutes,
        "pickup_location": pickup_location,
        "dropoff_location": dropoff_location,
        "message": "Simulated delivery quote only. No courier will be dispatched and no payment is required in this MVP.",
    }
