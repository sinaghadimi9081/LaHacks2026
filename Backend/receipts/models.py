from django.db import models


class Receipt(models.Model):
    image = models.ImageField(upload_to="receipts/")
    store_name = models.CharField(max_length=150, blank=True, default="")
    detected_total_amount = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    raw_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ParsedReceiptItem(models.Model):
    receipt = models.ForeignKey(
        Receipt,
        on_delete=models.CASCADE,
        related_name="parsed_items",
    )
    name = models.CharField(max_length=100)
    estimated_price = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )
    quantity = models.IntegerField(default=1)
    selected = models.BooleanField(default=True)
