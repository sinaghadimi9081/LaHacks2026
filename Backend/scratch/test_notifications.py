import os
import sys
import django
from datetime import timedelta
from django.utils import timezone

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import FoodItem, Notification
from households.models import Household, HouseholdMembership
from users.models import User
from django.core.management import call_command

def test_notification_flow():
    print("Setting up test data...")
    
    # 1. Create a test user
    user, _ = User.objects.get_or_create(username="testuser", email="test@example.com")
    
    # 2. Create a household
    household, _ = Household.objects.get_or_create(name="Test Kitchen")
    user.default_household = household
    user.save()
    
    # 3. Add user to household
    HouseholdMembership.objects.get_or_create(
        user=user, 
        household=household,
        defaults={'role': 'owner', 'status': 'active'}
    )
    
    # 4. Create an item expiring tomorrow
    tomorrow = timezone.now().date() + timedelta(days=1)
    item = FoodItem.objects.create(
        name="Test Milk",
        expiration_date=tomorrow,
        household=household,
        status='available'
    )
    
    print(f"Created {item.name} expiring on {tomorrow}")
    
    # 5. Run the check_expirations command
    print("\nRunning check_expirations command...")
    call_command('check_expirations')
    
    # 6. Verify notification was created
    notis = Notification.objects.filter(user=user, title__icontains="Test Milk")
    if notis.exists():
        print(f"\nSUCCESS: Website notification created: {notis.first().message}")
    else:
        print("\nFAILURE: No website notification found.")

if __name__ == "__main__":
    test_notification_flow()
