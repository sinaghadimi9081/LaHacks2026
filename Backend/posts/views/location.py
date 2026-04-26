from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from ..location_services import GeocodingError, geocode_address, reverse_geocode


class PostLocationResolveView(APIView):
    def post(self, request):
        address = request.data.get("pickup_location") or request.data.get("address")
        latitude = request.data.get("pickup_latitude") or request.data.get("latitude")
        longitude = request.data.get("pickup_longitude") or request.data.get("longitude")

        try:
            if address:
                location = geocode_address(address)
            else:
                if latitude in (None, "") or longitude in (None, ""):
                    raise ValidationError(
                        {"detail": "Provide an address or both latitude and longitude."}
                    )
                location = reverse_geocode(latitude, longitude)
        except GeocodingError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        return Response(location, status=status.HTTP_200_OK)
