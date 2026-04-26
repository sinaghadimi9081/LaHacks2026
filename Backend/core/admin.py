from django.contrib import admin
from .models import ExpirationKnowledge, FoodItem, ImpactLog

admin.site.register(ExpirationKnowledge)
admin.site.register(FoodItem)
admin.site.register(ImpactLog)
