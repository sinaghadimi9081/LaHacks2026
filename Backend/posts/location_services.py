from decimal import Decimal
from functools import lru_cache

import requests
from django.conf import settings


class GeocodingError(Exception):
    pass


def _request_headers():
    return {
        "User-Agent": settings.NOMINATIM_USER_AGENT,
        "Accept": "application/json",
    }


def _request_params(extra_params):
    params = {"format": "jsonv2", "addressdetails": 1, "limit": 1}
    if settings.NOMINATIM_EMAIL:
        params["email"] = settings.NOMINATIM_EMAIL
    params.update(extra_params)
    return params


def _normalize_result(result):
    try:
        latitude = Decimal(str(result["lat"])).quantize(Decimal("0.000001"))
        longitude = Decimal(str(result["lon"])).quantize(Decimal("0.000001"))
    except (KeyError, ValueError) as exc:
        raise GeocodingError("OpenStreetMap returned an invalid location.") from exc

    display_name = (result.get("display_name") or "").strip()
    if not display_name:
        raise GeocodingError("OpenStreetMap did not return a readable address.")

    return {
        "pickup_location": display_name,
        "pickup_latitude": latitude,
        "pickup_longitude": longitude,
    }


@lru_cache(maxsize=256)
def geocode_address(address):
    normalized_address = (address or "").strip()
    if not normalized_address:
        raise GeocodingError("Enter an address.")

    try:
        response = requests.get(
            f"{settings.NOMINATIM_BASE_URL}/search",
            params=_request_params({"q": normalized_address}),
            headers=_request_headers(),
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise GeocodingError("OpenStreetMap lookup is unavailable right now.") from exc

    results = response.json()
    if not results:
        raise GeocodingError("We could not find that address in OpenStreetMap.")

    return _normalize_result(results[0])


@lru_cache(maxsize=256)
def reverse_geocode(latitude, longitude):
    try:
        response = requests.get(
            f"{settings.NOMINATIM_BASE_URL}/reverse",
            params=_request_params({"lat": latitude, "lon": longitude, "zoom": 18}),
            headers=_request_headers(),
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise GeocodingError("OpenStreetMap lookup is unavailable right now.") from exc

    result = response.json()
    if "error" in result:
        raise GeocodingError("We could not turn that location into an address.")

    return _normalize_result(result)
