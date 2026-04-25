from rest_framework import generics
from rest_framework.response import Response

from .serializers import HouseholdSerializer


class HouseholdMeView(generics.RetrieveUpdateAPIView):
    serializer_class = HouseholdSerializer

    def get_object(self):
        return self.request.user.default_household

    def get(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response({"household": serializer.data})

    def patch(self, request, *args, **kwargs):
        response = super().patch(request, *args, **kwargs)
        response.data = {"household": response.data}
        return response
