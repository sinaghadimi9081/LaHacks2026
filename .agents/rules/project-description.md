---
trigger: always_on
---

here is the brief project description:
```
We are building a hackathon project called NeighborFridge.

NeighborFridge is a food waste app that helps users track groceries from receipts, see what food is close to expiring, calculate money at risk, and share near-expiring food with neighbors before it goes to waste.

Backend stack:
- Django
- Django REST Framework
- SQLite for MVP
- django-cors-headers
- Real receipt upload using OCR if possible
- User confirmation step after OCR parsing

Core MVP flow:
1. User uploads a receipt image.
2. Backend runs OCR and extracts raw text.
3. Backend parses possible food items and prices.
4. Frontend lets user confirm/edit items and expiration dates.
5. Confirmed items are saved as FoodItem rows.
6. App shows pantry items.
7. App generates a rescue plan based on expiration dates.
8. App calculates money at risk for food expiring in the next 72 hours.
9. User can share an item to a neighborhood feed.
10. Another user can claim that item.
11. Impact dashboard updates dollars saved, items rescued, items shared, and estimated CO2 saved.

Important MVP models:
FoodItem:
- name
- quantity
- expiration_date
- estimated_price
- status
- owner_name
- created_at

Receipt:
- image
- raw_text
- created_at

ParsedReceiptItem:
- receipt
- name
- estimated_price
- selected

SharePost:
- food_item
- title
- description
- pickup_location
- status
- claimed_by
- created_at

ImpactLog:
- food_item
- action
- dollars_saved
- created_at

Important endpoints:
POST /api/receipts/upload/
GET /api/receipts/<id>/
POST /api/receipts/<id>/confirm/

GET /api/items/
POST /api/items/
GET /api/items/<id>/
PATCH /api/items/<id>/
DELETE /api/items/<id>/

GET /api/rescue-plan/
POST /api/share/
GET /api/share/feed/
GET /api/share/<id>/
PATCH /api/share/<id>/claim/
GET /api/impact/

Receipt OCR should be best-effort. Do not directly save OCR items to pantry. First return parsed draft items. The user confirms/edits them, then backend saves them as FoodItem objects.

Recommendation rules:
- days_left <= 0: expired
- days_left <= 1 and quantity > 1: share
- days_left <= 1: cook
- days_left <= 3: freeze
- otherwise: low_priority

Money at risk:
- sum estimated_price for available food items expiring in the next 72 hours

Impact:
- dollars_saved from ImpactLog
- items_rescued count
- items_shared count
- items_claimed count
- estimated_co2_saved = items_rescued * 1.5

Keep the code simple and hackathon-ready. Prioritize working backend infrastructure over polish.
```