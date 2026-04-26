from django.urls import path

from .views import FoodItemDetailView, FoodItemListCreateView

urlpatterns = [
    path('items/', FoodItemListCreateView.as_view(), name='item-list'),
    path('items/<int:pk>/', FoodItemDetailView.as_view(), name='item-detail'),
]
