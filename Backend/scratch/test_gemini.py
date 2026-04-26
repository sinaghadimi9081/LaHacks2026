import os
import sys
import django
import json
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env file explicitly
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.services.item_verifier import verify_and_enrich_items
from core.models import ExpirationKnowledge

def test_enrichment():
    print("=== Testing 3-Tier Enrichment Pipeline ===\n")
    
    raw_items = [
        # Tier 2: Should match local DB via fuzzy matching
        {"name": "HNYCRSP APPL 3LB", "estimated_price": "6.99"},
        {"name": "GRK YGRT BLUBRY", "estimated_price": "1.50"},
        {"name": "ORG BANNAS", "estimated_price": "0.89"},
        {"name": "SKM MLK GAL", "estimated_price": "4.50"},
        {"name": "CHKN BRST", "estimated_price": "8.99"},
        # Tier 3: Obscure items — should fall through to Ollama
        {"name": "SIGGI SKYR VAN", "estimated_price": "2.29"},
        {"name": "RXBAR CHOC SEA", "estimated_price": "2.99"},
        {"name": "BANZA CHKPEA PNN", "estimated_price": "3.49"},
        {"name": "OATLYS BRSTA", "estimated_price": "5.99"},
    ]
    
    # Clear stale cached entries
    all_names = [item["name"] for item in raw_items]
    # Also clear standardized names that might have been cached
    deleted_count, _ = ExpirationKnowledge.objects.filter(food_name__in=all_names).delete()
    if deleted_count:
        print(f"Cleared {deleted_count} stale knowledge base entries.\n")

    print(f"Processing {len(raw_items)} items...\n")

    try:
        enriched_items = verify_and_enrich_items(raw_items, store_name="Whole Foods")
        
        print("--- Results ---")
        for item in enriched_items:
            print(f"Original: {item.get('name')}")
            print(f"  -> Standardized: {item.get('standardized_name')}")
            print(f"  -> Category: {item.get('category_tag')}")
            print(f"  -> Expiration: {item.get('expiration_days')} days")
            print(f"  -> Description: {item.get('description')}")
            print("-" * 40)
            
        print(f"\nSUCCESS: {len(enriched_items)}/{len(raw_items)} items enriched!")
        
    except Exception as e:
        print(f"\nFAILURE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_enrichment()
