from django.urls import path

from .views import FoodItemDetailView, FoodItemListCreateView, ImpactSummaryView, ImpactTipsView

urlpatterns = [
    path('items/', FoodItemListCreateView.as_view(), name='item-list'),
    path('items/<int:pk>/', FoodItemDetailView.as_view(), name='item-detail'),
    path("impact/", ImpactSummaryView.as_view(), name="impact-summary"),
    path("impact/tips/", ImpactTipsView.as_view(), name="impact-tips"),
]
