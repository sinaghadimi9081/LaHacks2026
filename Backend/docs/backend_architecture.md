# NeighborFridge Backend Architecture

This document provides a high-level overview of the NeighborFridge backend architecture, its core apps, and data flow. It is designed to help future agents and developers understand the codebase.

## Tech Stack
- **Framework**: Django 5.x & Django REST Framework (DRF)
- **Database**: SQLite (MVP)
- **Authentication**: JWT stored in HTTP-Only Cookies (via `rest_framework_simplejwt` and custom `users.authentication.CookieJWTAuthentication`)
- **AI & Integrations**: 
  - OCR: Local Tesseract (`pytesseract`) or Cloud Veryfi API.
  - Item Enrichment: 3-tier local pipeline (see below):
    1. `ExpirationKnowledge` DB cache (instant)
    2. Local fuzzy matching with 150+ item grocery DB (`grocery_db.py`)
    3. Ollama local LLM (`gemma2`) for brand-specific/obscure items
  - No cloud API keys required for item enrichment.

## Core Apps

### 1. `users` (Authentication & Profiles)
- Replaces Django's default User model.
- Uses JWT authentication stored in HTTP-Only cookies (`neighborfridge_access`, `neighborfridge_refresh`) for enhanced security over LocalStorage tokens.
- Manages user profiles and registration endpoints.

### 2. `households`
- Implements the "Neighborhood / Household Pantry" sharing feature.
- Allows users to join a household and share near-expiring food items.

### 3. `receipts` (Ingestion & Parsing)
Handles the uploading and parsing of grocery receipts.
- **`receipt_processing.py`**: The entry point for receipt ingestion. It takes an image path and can route it to:
  1. **Veryfi API**: A cloud-based receipt parser (fast and highly accurate).
  2. **Local Tesseract OCR**: A fallback using `pytesseract` and custom regex to extract items.
- Returns a normalized `ReceiptProcessingResult` containing `raw_text`, `store_name`, `detected_total`, and a list of `parsed_items`.
- **Models**:
  - `Receipt`: Stores the uploaded image, raw OCR text, and detected total.
  - `ParsedReceiptItem`: Stores the rough output of the OCR parser (e.g., "TJs Org Mlk", qty: 1, price: 4.99).

### 4. `core` (Data & Logic)
This is the central logic app that manages actual pantry items and expiration data.
- **Models**:
  - `FoodItem`: Verified food items residing in the pantry.
  - `SharePost`: Listings for food items users are giving away to neighbors.
  - `ImpactLog`: Tracks money saved and estimated CO2 reduction.
  - `ExpirationKnowledge`: A reference table mapping verified food products to their expected shelf life, category tags, and estimated prices.

## Data Flow: Receipt to Pantry

1. **Upload**: User uploads an image via `POST /api/receipts/upload/`.
2. **OCR Parsing**: `receipt_processing.process_receipt_image` runs (Veryfi or Local OCR) and creates `ParsedReceiptItem` rows.
3. **Item Enrichment**: The `ParsedReceiptItem` rows are processed by `item_verifier.py` through a 3-tier local pipeline:
   - **Tier 1**: Check `ExpirationKnowledge` DB for cached results (instant).
   - **Tier 2**: Fuzzy match against `grocery_db.py` — expands receipt abbreviations (e.g., `HNYCRSP APPL 3LB` → "Honeycrisp Apples") and matches using token overlap + sequence similarity.
   - **Tier 3**: Send unmatched items to Ollama (`gemma2`) for local LLM identification (e.g., `SIGGI SKYR VAN` → "Siggi's Icelandic Skyr Vanilla").
4. **User Confirmation**: The enriched items are sent back to the frontend. The user confirms or edits them.
5. **Pantry Storage**: Confirmed items are saved as `FoodItem` models in the user's pantry, and the `ExpirationKnowledge` table is updated for future lookups.

## Key Environment Variables
- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`
- `OLLAMA_URL` (optional): Ollama server URL. Default: `http://localhost:11434`.
- `OLLAMA_MODEL` (optional): Ollama model name. Default: `gemma2`.
- `RECEIPT_PROCESSING_PROVIDER`: `auto`, `veryfi`, or `local`.
- `VERYFI_CLIENT_ID`, `VERYFI_CLIENT_SECRET`, `VERYFI_USERNAME`, `VERYFI_API_KEY`: Required if using Veryfi.

*Note: This architecture is optimized for a Hackathon environment, preferring functional integrations and robust APIs over deep performance optimizations.*
