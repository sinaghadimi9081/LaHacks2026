# Expiration Date Methodology

This document outlines the system's methodology for determining the estimated shelf life (expiration days) of food items processed from grocery receipts in the NeighborFridge app.

## The Core Formula

The absolute expiration date assigned to a pantry item is calculated as:

**`Expiration Date = Current Date + Estimated Expiration Days`**

The `Estimated Expiration Days` is an integer representing the expected shelf life of the product from the day of purchase. This integer is derived via the `item_verifier` AI service.

## AI Verification Workflow

The process of determining a product's expiration days follows a highly optimized 4-step pipeline, implemented in `Backend/core/services/item_verifier.py`.

```mermaid
flowchart TD
    A[Raw OCR Item] --> B{In ExpirationKnowledge DB?}
    B -->|Yes| C[Fast Path: Return DB Expiration Days]
    B -->|No| D[Query Gemini 2.5 Flash]
    
    D --> E{API Success?}
    E -->|No / Timeout| F[Fallback: Return 7 Days]
    E -->|Yes| G[Return AI Estimated Days]
    
    G --> H[Update ExpirationKnowledge DB]
```

### 1. Knowledge Base Lookup (Fast Path)
Before relying on external LLM APIs, the system attempts to resolve the item locally:
- It queries the `ExpirationKnowledge` database table for an exact (case-insensitive) match of the raw OCR item name.
- If a match is found, the historically verified `expiration_days` is retrieved instantly.
- **Benefit:** Saves API costs, prevents halluinations on known data, and reduces latency for common, repeatedly purchased items.

### 2. LLM Inference (Gemini AI Path)
If the item is not found in the local knowledge base, the raw OCR string and the store name are sent to the **Google Gemini 2.5 Flash** model.
- **Context:** The AI is specifically prompted to act as a grocery assistant.
- **Instruction:** It is required to output a JSON object containing an `expiration_days` integer, which represents the estimated shelf life in days from purchase.
- **Reasoning:** Gemini leverages its vast pre-trained understanding of food types to estimate reasonable shelf lives (e.g., assigning ~14 days to milk, 3-4 days to raw poultry, or 365+ days to canned goods).

### 3. Fallback Mechanism
To ensure app stability and prevent processing bottlenecks, a graceful fallback is implemented:
- If the Gemini API call fails, times out, or if the `GEMINI_API_KEY` is missing from the environment, the system catches the exception and assigns a safe default value.
- **Default Value:** `7 days` (1 week).

<<<<<<< Updated upstream
### 4. Continuous Learning
Once the Gemini model successfully infers the details for a new item, the system automatically trains itself:
- A new record is created in the `ExpirationKnowledge` table, mapping the standardized food name to its newly inferred `expiration_days`.
- **Benefit:** This ensures that subsequent uploads of the exact same raw receipt item will hit the "Fast Path" (Step 1) instead of requiring another LLM call, making the system faster and more reliable over time.
=======
A confidence threshold of **0.55** is required to accept a match. Each database entry provides:
- Standardized product name (e.g., "Honeycrisp Apples")
- Category tag (produce, dairy, meat, bakery, pantry, frozen, beverage, condiment, deli)
- Shelf life in days (researched values, e.g., bananas = 5 days, chicken = 3 days)
- Human-readable description

### Tier 3: Ollama Local LLM Fallback (Smart, Offline)
For items the local DB cannot confidently match (brand-specific, niche, or unusual items), the system sends a batch request to a locally running **Ollama** instance:
- **Model**: `gemma2` (9B parameters, runs on-device)
- **Prompt**: Structured JSON request asking for standardized name, category, expiration days, and description.
- **Timeout**: 30 seconds per batch.
- **Examples**: Successfully identifies items like `SIGGI SKYR VAN` → "Siggi's Icelandic Skyr Vanilla" (dairy, 14 days), or `RXBAR CHOC SEA` → "RXBAR Chocolate Sea Salt" (pantry, 30 days).

### Final Fallback
If Ollama is not running or fails, the system still produces a reasonable result:
- Expands abbreviations to build a readable name.
- Guesses the category using keyword analysis.
- Assigns category-based default shelf life (e.g., produce = 7 days, dairy = 10 days, meat = 3 days).

### Continuous Learning
Every successful enrichment result (from any tier) is saved back to the `ExpirationKnowledge` table, ensuring:
- The same item on a future receipt hits Tier 1 (instant) instead of requiring reprocessing.
- The system gets faster and more reliable with each receipt scanned.

## Running the Enrichment Pipeline

### Prerequisites
1. **Ollama** installed and running (for Tier 3):
   ```bash
   # Install Ollama (macOS)
   brew install ollama

   # Pull the gemma2 model
   ollama pull gemma2

   # Start the Ollama server (runs in background)
   ollama serve
   ```

2. **Python venv** activated with dependencies installed.

### Test the Pipeline
```bash
cd Backend
source .venv/bin/activate

# Test enrichment only (hardcoded sample items)
python scratch/test_gemini.py

# Full E2E test: receipt image → OCR → enrichment
python scratch/test_e2e.py /path/to/receipt.jpg
python scratch/test_e2e.py /path/to/receipt.jpg --provider local   # force local OCR
python scratch/test_e2e.py /path/to/receipt.jpg --provider veryfi  # force Veryfi OCR
```

### Environment Variables (Optional)
| Variable | Default | Description |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `gemma2` | Ollama model to use |

> **Note:** No API keys are required. The entire pipeline runs locally.
>>>>>>> Stashed changes
