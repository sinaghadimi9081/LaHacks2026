from django.apps import AppConfig


class ReceiptsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "receipts"
    label = "api"
    verbose_name = "Receipts"
