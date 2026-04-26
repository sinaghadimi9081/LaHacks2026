from django.urls import path

from .views import confirm_receipt, receipt_detail, receipt_search, upload_receipt

urlpatterns = [
    path("receipts/upload/", upload_receipt, name="receipt-upload"),
    path("receipts/search/", receipt_search, name="receipt-search"),
    path("receipts/<int:receipt_id>/", receipt_detail, name="receipt-detail"),
    path("receipts/<int:receipt_id>/confirm/", confirm_receipt, name="receipt-confirm"),
]
