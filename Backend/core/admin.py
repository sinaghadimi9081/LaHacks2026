from django.contrib import admin
from .models import ExpirationKnowledge, Receipt, ParsedReceiptItem, FoodItem, SharePost, ImpactLog

admin.site.register(ExpirationKnowledge)
admin.site.register(Receipt)
admin.site.register(ParsedReceiptItem)
admin.site.register(FoodItem)
admin.site.register(SharePost)
admin.site.register(ImpactLog)
