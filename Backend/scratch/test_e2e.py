"""
End-to-end test: Receipt Image → OCR → Enrichment → Pantry Items

Usage:
    python scratch/test_e2e.py /path/to/receipt.jpg
    python scratch/test_e2e.py /path/to/receipt.png --provider local
    python scratch/test_e2e.py /path/to/receipt.jpg --provider veryfi
"""
import argparse
import os
import sys
import time
import django

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from receipts.receipt_processing import process_receipt_image, _veryfi_is_configured
from core.services.item_verifier import verify_and_enrich_items


def print_header(text):
    width = 60
    print(f"\n{'=' * width}")
    print(f"  {text}")
    print(f"{'=' * width}")


def print_section(text):
    print(f"\n--- {text} ---")


def run_e2e_test(image_path, provider=None):
    """Run the full receipt-to-enrichment pipeline on a receipt image."""
    
    if not os.path.exists(image_path):
        print(f"ERROR: File not found: {image_path}")
        sys.exit(1)
    
    print_header("NeighborFridge E2E Pipeline Test")
    print(f"  Image: {os.path.basename(image_path)}")
    print(f"  Size:  {os.path.getsize(image_path) / 1024:.1f} KB")
    
    # Override provider if specified
    if provider:
        from django.conf import settings
        settings.RECEIPT_PROCESSING_PROVIDER = provider
        print(f"  OCR:   {provider}")
    else:
        from django.conf import settings
        current = getattr(settings, 'RECEIPT_PROCESSING_PROVIDER', 'auto')
        veryfi_ready = _veryfi_is_configured()
        effective = "veryfi" if (current == "auto" and veryfi_ready) else ("local" if current == "auto" else current)
        print(f"  OCR:   {current} (effective: {effective})")

    # =========================================================
    # STAGE 1: OCR Processing
    # =========================================================
    print_section("Stage 1: OCR Processing")
    t0 = time.time()
    
    try:
        result = process_receipt_image(image_path)
        ocr_time = time.time() - t0
        print(f"  ✅ OCR completed in {ocr_time:.2f}s")
    except Exception as e:
        print(f"  ❌ OCR failed: {e}")
        sys.exit(1)

    print(f"  Store:    {result.store_name or '(not detected)'}")
    print(f"  Total:    ${result.detected_total or '(not detected)'}")
    print(f"  Raw text: {len(result.raw_text)} chars")
    print(f"  Items found: {len(result.parsed_items)}")
    
    if not result.parsed_items:
        print("\n  ⚠️  No items were parsed from the receipt.")
        print("  Raw OCR text preview:")
        print(f"  {result.raw_text[:500]}")
        sys.exit(0)
    
    print_section("Stage 1 Results: Parsed Receipt Items")
    for i, item in enumerate(result.parsed_items, 1):
        name = item.get('name', '?')
        price = item.get('estimated_price', '?')
        qty = item.get('quantity', 1)
        print(f"  {i:2d}. {name:<35s} ${price:>6s}  qty: {qty}")

    # =========================================================
    # STAGE 2: Item Enrichment (3-tier pipeline)
    # =========================================================
    print_section("Stage 2: Item Enrichment (Local DB + Ollama)")
    t1 = time.time()
    
    try:
        enriched_items = verify_and_enrich_items(
            result.parsed_items,
            store_name=result.store_name
        )
        enrich_time = time.time() - t1
        print(f"  ✅ Enrichment completed in {enrich_time:.2f}s")
    except Exception as e:
        print(f"  ❌ Enrichment failed: {e}")
        import traceback
        traceback.print_exc()
        enriched_items = result.parsed_items

    print_section("Stage 2 Results: Enriched Items")
    
    total_value = 0.0
    for i, item in enumerate(enriched_items, 1):
        raw_name = item.get('name', '?')
        std_name = item.get('standardized_name', raw_name)
        category = item.get('category_tag', 'unknown')
        exp_days = item.get('expiration_days', '?')
        price = item.get('estimated_price', '0')
        desc = item.get('description', '')
        
        try:
            total_value += float(price)
        except (ValueError, TypeError):
            pass
        
        print(f"  {i:2d}. {std_name}")
        print(f"      Raw: {raw_name}")
        print(f"      Category: {category:<12s}  Expires in: {exp_days} days  Price: ${price}")
        if desc:
            print(f"      Desc: {desc}")
        print()

    # =========================================================
    # STAGE 3: Summary (simulates what confirm_receipt would save)
    # =========================================================
    print_section("Stage 3: Pantry Summary (what would be saved)")

    from datetime import date, timedelta
    today = date.today()
    
    print(f"  {'Item':<30s} {'Category':<12s} {'Exp Date':<12s} {'Price':>8s}")
    print(f"  {'-'*30} {'-'*12} {'-'*12} {'-'*8}")
    
    for item in enriched_items:
        name = (item.get('standardized_name') or item.get('name', '?'))[:30]
        category = item.get('category_tag', 'unknown')
        exp_days = item.get('expiration_days')
        price = item.get('estimated_price', '0.00')
        
        if exp_days:
            exp_date = (today + timedelta(days=int(exp_days))).strftime('%Y-%m-%d')
        else:
            exp_date = '(unknown)'
        
        print(f"  {name:<30s} {category:<12s} {exp_date:<12s} ${price:>7s}")
    
    print(f"\n  Total items:   {len(enriched_items)}")
    print(f"  Total value:   ${total_value:.2f}")
    print(f"  OCR time:      {ocr_time:.2f}s")
    print(f"  Enrichment:    {enrich_time:.2f}s")
    print(f"  Total time:    {ocr_time + enrich_time:.2f}s")
    
    print_header("E2E Test Complete ✅")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="End-to-end test: Receipt Image → OCR → Enrichment"
    )
    parser.add_argument(
        "image",
        help="Path to a receipt image (jpg, png, etc.)"
    )
    parser.add_argument(
        "--provider",
        choices=["local", "veryfi", "auto"],
        default=None,
        help="Force a specific OCR provider (default: use .env setting)"
    )
    args = parser.parse_args()
    
    run_e2e_test(args.image, provider=args.provider)
