# NeighborFridge Data Pipelines

This document outlines the core data flows and pipelines in the NeighborFridge application. The primary workflows cover receipt ingestion, food management (pantry), food sharing, and environmental/financial impact tracking.

## 1. Receipt Ingestion & Item Enrichment Pipeline

This pipeline handles the process of converting a physical grocery receipt image into verified food inventory items.

```mermaid
graph TD
    A[Receipt Image Upload] -->|POST /api/receipts/upload/| B(receipt_processing)
    B -->|OCR/Veryfi| C[Raw Text & Detected Total]
    C -->|Regex/Parser| D[ParsedReceiptItem Drafts]
    D -->|Item Verifier| E[Enrichment Pipeline]

    subgraph "3-Tier Local Enrichment"
        E --> F{Tier 1: ExpirationKnowledge Cache}
        F -->|Miss| G{Tier 2: Local Fuzzy Match}
        G -->|Miss| H{Tier 3: Ollama LLM}
    end

    E -->|Frontend Returns Drafts| I[User Confirmation]
    I -->|POST /api/receipts/<id>/confirm/| J[FoodItem Created]
    J --> K[(Pantry DB)]
    I -->|Cache Result| L[(ExpirationKnowledge DB)]
```

### Key Models
- **`Receipt`**: Stores the raw uploaded image and the OCR extracted text.
- **`ParsedReceiptItem`**: A temporary or "draft" model holding the extracted information before user confirmation. Includes fields for AI-enriched data like `standardized_name`, `category_tag`, and `expiration_days`.
- **`ExpirationKnowledge`**: A cached lookup table mapping verified food products to their expected shelf life, category tags, and estimated prices. Updated automatically after every enrichment.

### Enrichment Details
The Item Verifier (`core/services/item_verifier.py`) uses a fully local pipeline:
1. **DB Cache**: Instant lookup of previously enriched items.
2. **Local Fuzzy Matching**: 150+ item grocery database with abbreviation expansion and multi-strategy matching (`core/services/grocery_db.py`).
3. **Ollama (gemma2)**: Local LLM for brand-specific or obscure items. No API key needed.

See [Expiration Methodology](./expiration_methodology.md) for full details.

---

## 2. Pantry Inventory & Rescue Plan Pipeline

Once food is confirmed and stored in the database, the app categorizes it by urgency to prevent waste.

```mermaid
graph TD
    A[(Pantry DB)] -->|GET /api/items/| B[User Pantry View]
    A -->|GET /api/rescue-plan/| C{Rescue Plan Engine}

    C -->|days_left <= 0| D[Expired]
    C -->|days_left <= 1 & qty > 1| E[Share]
    C -->|days_left <= 1| F[Cook]
    C -->|days_left <= 3| G[Freeze]
    C -->|otherwise| H[Low Priority]

    A -->|Expiring in < 72h| I[Money at Risk Calculator]
    I --> J[Total $ at Risk]
```

### Key Logic
- **Rescue Plan**: Categorizes active `FoodItem` objects based on their computed `days_left` until expiration.
- **Money at Risk**: Calculates the sum of `estimated_price` for all `FoodItem` records that are expiring within the next 72 hours.

---

## 3. Neighborhood Sharing Pipeline

Users can opt to share items they won't consume before they expire.

```mermaid
graph TD
    A[User Selects Item] -->|POST /api/share/| B[SharePost Created]
    B --> C[(Neighborhood Feed)]
    C -->|GET /api/share/feed/| D[Neighbor Browses]
    D -->|PATCH /api/share/<id>/claim/| E{Neighbor Claims Item}
    E --> F[SharePost Status: Claimed]
    F --> G[FoodItem Status: Claimed/Transferred]
    F --> H[Impact Logging]
```

### Key Models
- **`FoodItem`**: The original item. Its `status` updates when claimed.
- **`SharePost`**: The public listing attached to a `FoodItem`, containing `pickup_location` and `claimed_by` information.

---

## 4. Impact Tracking Pipeline

Every successful food rescue generates metrics to show users their environmental and financial impact.

```mermaid
graph TD
    A[Food Claimed/Consumed] -->|Log Event| B[ImpactLog Created]
    B --> C{Dashboard Aggregator}

    C -->|Sum| D[Dollars Saved]
    C -->|Count| E[Items Rescued]
    C -->|Count| F[Items Shared]
    C -->|Math: items * 1.5| G[Estimated CO2 Saved]

    C -->|GET /api/impact/| H[User Impact Dashboard]
```

### Key Models
- **`ImpactLog`**: Records specific events (`action`) tied to a `FoodItem` and the financial value (`dollars_saved`) associated with that action.
