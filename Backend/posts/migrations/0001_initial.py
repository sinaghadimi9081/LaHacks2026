from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("core", "0002_fooditem_image_file"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Post",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_name", models.CharField(blank=True, default="", max_length=255)),
                ("quantity_label", models.CharField(blank=True, default="", max_length=100)),
                ("estimated_price", models.DecimalField(decimal_places=2, default=0.0, max_digits=10)),
                ("image_url", models.URLField(blank=True, max_length=500, null=True)),
                ("image_file", models.ImageField(blank=True, null=True, upload_to="share_post_images/")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                ("pickup_location", models.CharField(max_length=255)),
                ("pickup_latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("pickup_longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("status", models.CharField(choices=[("available", "Available"), ("claimed", "Claimed")], default="available", max_length=50)),
                ("claimed_by", models.CharField(blank=True, max_length=255, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "claimed_by_user",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="claimed_posts", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "food_item",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="posts", to="core.fooditem"),
                ),
                (
                    "owner",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="posts", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
