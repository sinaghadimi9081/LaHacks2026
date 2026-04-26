from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .models import FoodItem
from .serializers import FoodItemSerializer


class FoodItemListCreateView(generics.ListCreateAPIView):
    serializer_class = FoodItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        household = self.request.user.default_household
        if household is None:
            return FoodItem.objects.none()
        return FoodItem.objects.filter(household=household).order_by('-created_at')

    def perform_create(self, serializer):
        household = self.request.user.default_household
        serializer.save(
            household=household,
            created_by=self.request.user,
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({'items': serializer.data}, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FoodItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FoodItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        household = self.request.user.default_household
        if household is None:
            return FoodItem.objects.none()
        return FoodItem.objects.filter(household=household)

    def perform_update(self, serializer):
        item = self.get_object()
        if item.household_id != (self.request.user.default_household_id):
            raise PermissionDenied('You can only update items in your active household.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.household_id != (self.request.user.default_household_id):
            raise PermissionDenied('You can only delete items in your active household.')
        instance.delete()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
