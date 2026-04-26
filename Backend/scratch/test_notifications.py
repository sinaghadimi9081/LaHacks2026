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
    
    # 1. Create a test user (using your email from .env so you receive it)
    test_email = os.getenv("EMAIL_HOST_USER", "test@example.com")
    print(f"Targeting email: {test_email}")
    user, _ = User.objects.get_or_create(username="testuser", defaults={'email': test_email})
    user.email = test_email
    user.save()
    
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
    
    # 6. Create a SECOND user for the specific email requested
    anthony_email = "leanthony2284@gmail.com"
    print(f"\nAdding second test case for: {anthony_email}")
    anthony, _ = User.objects.get_or_create(username="anthony_test", defaults={'email': anthony_email})
    anthony.email = anthony_email
    anthony.save()
    
    # Add Anthony to the same household
    HouseholdMembership.objects.get_or_create(
        user=anthony, 
        household=household,
        defaults={'role': 'member', 'status': 'active'}
    )
    
    # Create an item expiring today for Anthony
    today = timezone.now().date()
    item2 = FoodItem.objects.create(
        name="Anthony's Eggs",
        expiration_date=today,
        household=household,
        status='available'
    )
    print(f"Created {item2.name} expiring today for Anthony")

    # 7. Run the check_expirations command again
    print("\nRunning check_expirations command for both users...")
    call_command('check_expirations')
    
    # 8. Verify notifications were created for both
    if Notification.objects.filter(user=user, title__icontains="Test Milk").exists():
        print(f"SUCCESS: Notification created for {user.email}")
    if Notification.objects.filter(user=anthony, title__icontains="Anthony's Eggs").exists():
        print(f"SUCCESS: Notification created for {anthony.email}")

if __name__ == "__main__":
    test_notification_flow()
