from django.urls import path

from .views import HouseholdMeView

urlpatterns = [
    path("me/", HouseholdMeView.as_view(), name="household-me"),
]
