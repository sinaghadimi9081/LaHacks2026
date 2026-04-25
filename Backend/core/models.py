from django.db import models

class ExpirationKnowledge(models.Model):
    food_name = models.CharField(max_length=255)
    category_tag = models.CharField(max_length=100, db_index=True)
    expiration_days = models.IntegerField(db_index=True)
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.quantity}x {self.food_name} ({self.category_tag}) - ${self.price} - {self.expiration_days} days"

class Receipt(models.Model):
    image = models.ImageField(upload_to='receipts/', blank=True, null=True)
    raw_text = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Receipt {self.id} - {self.created_at.strftime('%Y-%m-%d')}"

class ParsedReceiptItem(models.Model):
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name='parsed_items')
    name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    selected = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.quantity}x {self.name} - ${self.estimated_price}"

class FoodItem(models.Model):
    name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    expiration_date = models.DateField(blank=True, null=True)
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=50, default='available')
    owner_name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.quantity})"

class SharePost(models.Model):
    food_item = models.ForeignKey(FoodItem, on_delete=models.CASCADE, related_name='share_posts')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    pickup_location = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default='active')
    claimed_by = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class ImpactLog(models.Model):
    food_item = models.ForeignKey(FoodItem, on_delete=models.SET_NULL, null=True, related_name='impact_logs')
    action = models.CharField(max_length=100)
    dollars_saved = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} - ${self.dollars_saved}"
