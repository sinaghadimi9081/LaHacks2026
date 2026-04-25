from django.urls import path

from .views import receipt_detail, upload_receipt

urlpatterns = [
    path("receipts/upload/", upload_receipt, name="receipt-upload"),
    path("receipts/<int:receipt_id>/", receipt_detail, name="receipt-detail"),
]
