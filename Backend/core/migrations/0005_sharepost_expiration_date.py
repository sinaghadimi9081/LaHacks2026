from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_fooditem_household_notification"),
    ]

    operations = [
        migrations.AddField(
            model_name="sharepost",
            name="expiration_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
