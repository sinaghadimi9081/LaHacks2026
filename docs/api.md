# NeighborFridge API Reference

All endpoints are prefixed with `/api/`. The frontend proxies requests through Vite dev server (`/api` → `http://127.0.0.1:8000`).

**Base URL:** `http://127.0.0.1:8000/api/`  
**Auth:** Cookie-based JWT (HTTP-only). All endpoints require authentication unless marked **public**.  
**CSRF:** POST/PUT/PATCH/DELETE requests require an `X-CSRFToken` header — the Axios client reads this from the `csrftoken` cookie automatically.

---

## Authentication — `/api/auth/`

### `POST /api/auth/csrf/`
**Public.** Returns a fresh CSRF token. Call this before any state-changing request when no token cookie exists.

**Response**
```json
{ "csrfToken": "string" }
```

---

### `POST /api/auth/signup/`
**Public.** Register a new user. Creates an account and optional initial household, then sets auth cookies.

**Request body**
| Field | Type | Required |
|-------|------|----------|
| `username` | string | yes |
| `email` | string | yes |
| `password` | string | yes |
| `password_confirm` | string | yes |
| `display_name` | string | no |
| `household_name` | string | no — creates a household if provided |

**Response** `201`
```json
{
  "user": { "id": 1, "username": "...", "email": "...", "display_name": "...", "default_household": { ... } },
  "csrfToken": "string"
}
```
Sets `access_token` and `refresh_token` HTTP-only cookies.

---

### `POST /api/auth/login/`
**Public.** Authenticate with username or email.

**Request body**
| Field | Type | Required |
|-------|------|----------|
| `identifier` | string | yes — username or email |
| `password` | string | yes |

**Response** `200`
```json
{ "user": { ... }, "csrfToken": "string" }
```
Sets auth cookies.

---

### `POST /api/auth/logout/`
Blacklists the current refresh token and clears auth cookies.

**Response** `200`
```json
{ "detail": "Logged out." }
```

---

### `POST /api/auth/refresh/`
Exchange the refresh cookie for a new access token. The refresh token may be passed in the request body or read from the cookie.

**Response** `200`
```json
{ "detail": "Token refreshed.", "csrfToken": "string" }
```
Rotates refresh token; old token is blacklisted.

---

### `GET /api/auth/me/`
Returns the authenticated user alongside a fresh CSRF token.

**Response** `200`
```json
{ "user": { ... }, "csrfToken": "string" }
```

---

## User Profile — `/api/users/`

### `GET /api/users/me/`
Returns the full profile of the authenticated user.

**Response** `200`
```json
{
  "id": 1,
  "username": "carlos",
  "email": "carlos@example.com",
  "display_name": "Carlos",
  "first_name": "Carlos",
  "last_name": "Mendez",
  "profile_image": "http://...media/profile/img.jpg",
  "default_household": { "id": 1, "name": "Casa Mendez" },
  "households": [ { "id": 1, "name": "Casa Mendez", "role": "owner" } ]
}
```

---

### `PATCH /api/users/me/`
Update the authenticated user's profile. Accepts `multipart/form-data` for image uploads.

**Request body** (all optional)
| Field | Type |
|-------|------|
| `display_name` | string |
| `first_name` | string |
| `last_name` | string |
| `profile_image` | file |
| `default_household_id` | integer |

**Response** `200` — same shape as `GET /api/users/me/`

---

### `GET /api/users/profile/`
Returns the authenticated user's public marketplace profile.

**Response** `200`
```json
{ "id": 1, "username": "carlos", "display_name": "Carlos", "profile_image": "..." }
```

---

### `GET /api/users/profile/<user_id>/`
Returns another user's public marketplace profile.

**Response** `200` — same shape as above.

---

## Households — `/api/households/`

### `GET /api/households/me/`
Returns the user's active household with its members.

**Response** `200`
```json
{
  "id": 1,
  "name": "Casa Mendez",
  "created_at": "2026-04-01T00:00:00Z",
  "members": [
    {
      "user_id": 1,
      "username": "carlos",
      "display_name": "Carlos",
      "role": "owner",
      "status": "active",
      "permissions": {
        "can_upload_receipts": true,
        "can_post_share": true,
        "can_manage_members": true
      },
      "joined_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

---

### `PATCH /api/households/me/`
Rename the active household. Requires `can_manage_members` permission or owner role.

**Request body**
```json
{ "name": "New Name" }
```

**Response** `200` — updated household object.

---

### `GET /api/households/me/members/`
List all active members of the authenticated user's household.

**Response** `200`
```json
{ "members": [ { ... } ] }
```

---

### `PATCH /api/households/members/<user_id>/`
Update a household member's permissions. Requires `can_manage_members` or owner.

**Request body** (all optional)
```json
{
  "can_upload_receipts": true,
  "can_post_share": true,
  "can_manage_members": false
}
```

**Response** `200` — updated member object.

---

### `DELETE /api/households/members/<user_id>/`
Remove a member from the household. Requires `can_manage_members` or owner.

**Response** `200`
```json
{ "detail": "Member removed." }
```

---

### `POST /api/households/me/invitations/`
Invite a user to the household by email.

**Request body**
```json
{ "email": "neighbor@example.com" }
```

**Response** `201`
```json
{
  "id": 5,
  "household": 1,
  "invited_email": "neighbor@example.com",
  "status": "pending",
  "created_at": "..."
}
```

---

### `GET /api/households/me/invitations/`
List all invitations sent from the active household.

**Response** `200`
```json
{ "invitations": [ { ... } ] }
```

---

### `GET /api/households/invitations/`
List all pending invitations received by the authenticated user.

**Response** `200`
```json
{ "invitations": [ { ... } ] }
```

---

### `PATCH /api/households/invitations/<invitation_id>/accept/`
Accept a household invitation.

**Response** `200` — updated invitation object with `status: "accepted"`.

---

### `PATCH /api/households/invitations/<invitation_id>/decline/`
Decline a household invitation.

**Response** `200` — updated invitation object with `status: "declined"`.

---

## Pantry Items — `/api/items/`

Items belong to the user's active household (`default_household`). Status is derived automatically from `expiration_date` — it is not stored on the model.

**Status rules**

| Days until expiration | Status |
|-----------------------|--------|
| > 5 | `fresh` |
| 3 – 5 | `use soon` |
| 1 – 2 | `feed today` |
| ≤ 0 | `critical` |
| No expiration date | `fresh` |

---

### `GET /api/items/`
List all pantry items for the active household, newest first.

**Response** `200`
```json
{
  "items": [
    {
      "id": 1,
      "name": "Honeycrisp Apples",
      "quantity": 8,
      "expiration_date": "2026-05-02",
      "estimated_price": "6.75",
      "status": "fresh",
      "owner_name": "Anthony",
      "image": "https://...",
      "description": "From Trader Joe's",
      "recipe_uses": [],
      "created_at": "2026-04-25T10:00:00Z"
    }
  ]
}
```

---

### `POST /api/items/`
Create a new pantry item. Accepts `multipart/form-data` (for `image_file`) or JSON.

**Request body**
| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |
| `quantity` | integer | no — defaults to 1 |
| `expiration_date` | `YYYY-MM-DD` | no |
| `estimated_price` | decimal | no |
| `owner_name` | string | no |
| `image_file` | file | no |
| `image_url` | string (URL) | no |
| `description` | string | no |

**Response** `201` — created item object.

---

### `GET /api/items/<id>/`
Get a single pantry item. Must belong to the user's household.

**Response** `200` — item object.

---

### `PATCH /api/items/<id>/`
Partially update a pantry item.

**Request body** — any subset of the POST fields.

**Response** `200` — updated item object.

---

### `DELETE /api/items/<id>/`
Delete a pantry item permanently.

**Response** `204` No Content.

---

## Marketplace Posts — `/api/share/`

### Location privacy model
The API returns two coordinate sets per post:

| Field | Description |
|-------|-------------|
| `pickup_location` | Exact address — only visible to owner and approved requester |
| `pickup_latitude/longitude` | Exact coords — same visibility |
| `public_pickup_location` | Neighborhood/city only — always visible |
| `public_pickup_latitude/longitude` | Rounded to 2 decimal places (~1 km precision) — always visible |
| `exact_location_visible` | `true` if the viewer can see the exact address |

---

### `POST /api/share/`
Create a marketplace post. Accepts `multipart/form-data` or JSON.

**Request body**
| Field | Type | Required |
|-------|------|----------|
| `title` | string | yes |
| `pickup_location` | string | yes (or provide lat/lng) |
| `pickup_latitude` | decimal | no |
| `pickup_longitude` | decimal | no |
| `food_item_id` | integer | no — link to a pantry item |
| `item_name` | string | yes if no `food_item_id` |
| `quantity_label` | string | no |
| `estimated_price` | decimal | no |
| `description` | string | no |
| `image_url` | string | no |
| `image_file` | file | no |
| `tags` / `recipe_uses` | array of strings | no |

**Response** `201` — full post object with `exact_location_visible: true` (owner sees exact address).

---

### `GET /api/share/feed/`
**Public feed** — lists all available/pending/claimed posts. Returns public location only.

**Query parameters**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `available`, `pending`, or `claimed` |
| `search` | string | Full-text search across title, description, location, item name |
| `tag` | string | Filter by tag (repeat for multiple) |
| `lat` | float | Reference latitude for distance calculation |
| `lng` | float | Reference longitude for distance calculation |
| `radius_miles` | float | Must be used with `lat` + `lng` — limits results to a radius |

**Response** `200`
```json
{
  "posts": [
    {
      "id": 1,
      "owner": { "id": 1, "username": "carlos", "display_name": "Carlos", "full_name": "Carlos Mendez" },
      "is_owner": false,
      "food_item_id": 1,
      "food_item": { "id": 1, "name": "Apples", "image": "...", "quantity": "8", "estimated_price": 6.75, "status": "fresh", "owner_name": "Carlos", "expiration_date": "2026-05-02", "recipe_uses": ["snack", "salad"] },
      "item_name": "Honeycrisp Apples",
      "quantity_label": "8",
      "estimated_price": "6.75",
      "title": "Fresh apples — free to a good kitchen",
      "description": "Picked up too many at the farmers market.",
      "pickup_location": "Silver Lake, Los Angeles",
      "pickup_latitude": "34.09",
      "pickup_longitude": "-118.27",
      "public_pickup_location": "Silver Lake, Los Angeles",
      "public_pickup_latitude": "34.09",
      "public_pickup_longitude": "-118.27",
      "distance_miles": 0.8,
      "tags": ["fresh", "fruit"],
      "status": "available",
      "claimed_by": "",
      "viewer_request_status": null,
      "exact_location_visible": false,
      "created_at": "2026-04-25T10:00:00Z",
      "updated_at": "2026-04-25T10:00:00Z"
    }
  ]
}
```

---

### `GET /api/share/mine/`
Returns all posts owned by the authenticated user. Returns exact location.

**Response** `200`
```json
{ "posts": [ { ... } ] }
```

---

### `GET /api/share/<post_id>/`
Get a single post. Exact location visible if viewer is owner or has an approved request.

**Response** `200` — post object.

---

### `PATCH /api/share/<post_id>/`
Update a post. Owner only. Accepts `multipart/form-data` or JSON.

**Response** `200` — updated post.

---

### `DELETE /api/share/<post_id>/`
Delete a post. Owner only.

**Response** `204` No Content.

---

### `PATCH /api/share/<post_id>/claim/`
Submit a request to claim a post. Creates a `PostRequest` with status `pending` and moves the post to `pending`. Only one pending request allowed at a time.

**Response** `200` — post object (public view).

**Errors**
- `400` — already claimed by another user, or you own the post
- `400` — post already has a pending request from someone else

---

### `GET /api/share/requests/incoming/`
List all `PostRequest` objects for posts owned by the authenticated user.

**Query parameters**
| Param | Description |
|-------|-------------|
| `status` | Filter: `pending`, `approved`, `declined` |

**Response** `200`
```json
{
  "requests": [
    {
      "id": 10,
      "status": "pending",
      "created_at": "...",
      "responded_at": null,
      "requester": { "id": 2, "username": "maya", "display_name": "Maya", "full_name": "Maya Lee" },
      "post": { ... }
    }
  ]
}
```

---

### `GET /api/share/requests/outgoing/`
List all `PostRequest` objects submitted by the authenticated user.

**Response** `200`
```json
{ "requests": [ { ... } ] }
```

---

### `PATCH /api/share/requests/<request_id>/approve/`
Approve a pending request. Post owner only. Moves post status to `claimed` and reveals exact address to requester.

**Response** `200`
```json
{ "request": { "id": 10, "status": "approved", "responded_at": "...", ... } }
```

---

### `PATCH /api/share/requests/<request_id>/decline/`
Decline a pending request. Post owner only. Moves post back to `available`.

**Response** `200`
```json
{ "request": { "id": 10, "status": "declined", "responded_at": "...", ... } }
```

---

### `POST /api/share/location/resolve/`
Geocode a text address to coordinates, or reverse-geocode coordinates to an address. Uses OpenStreetMap Nominatim.

**Request body** (provide address OR lat/lng)
```json
{ "pickup_location": "Silver Lake, Los Angeles, CA" }
```
or
```json
{ "latitude": 34.0835, "longitude": -118.2570 }
```

**Response** `200`
```json
{
  "pickup_location": "Silver Lake, Los Angeles, CA 90026",
  "pickup_latitude": 34.083553,
  "pickup_longitude": -118.256988
}
```

---

## Notifications — `/api/notifications/`

### `GET /api/notifications/`
Returns all notifications for the authenticated user, newest first.

**Response** `200`
```json
{
  "notifications": [
    {
      "id": 1,
      "title": "New marketplace request",
      "message": "Maya requested your basil bouquet listing.",
      "is_read": false,
      "created_at": "2026-04-25T10:00:00Z"
    }
  ]
}
```

Notifications are created automatically for:
- New account signup (welcome)
- New share post created (confirmation to poster)
- Claim request submitted (alert to post owner)
- Claim request approved (alert to requester)
- Claim request declined (alert to requester)
- Expiring pantry items (sent by management command `check_expirations`)

---

### `PATCH /api/notifications/<notification_id>/read/`
Mark a notification as read.

**Response** `200`
```json
{ "detail": "Notification marked as read." }
```

---

## Receipts / OCR — `/api/receipts/`

### `POST /api/receipts/upload/`
Upload a receipt image. Processes it through OCR (Veryfi or local Tesseract), enriches line items with expiry/category data, and returns parsed results for review.

Requires active household membership with `can_upload_receipts` permission.

**Request** `multipart/form-data`
| Field | Type | Required |
|-------|------|----------|
| `image` | file | yes |

**Response** `201`
```json
{
  "receipt_id": 3,
  "image": "http://...media/receipts/img.jpg",
  "store_name": "Trader Joe's",
  "raw_text": "... OCR output ...",
  "created_at": "2026-04-25T10:00:00Z",
  "confirmed_at": null,
  "detected_total": "24.50",
  "parsed_item_total": "22.75",
  "parsed_items": [
    {
      "id": 12,
      "name": "Honeycrisp Apples",
      "standardized_name": "Honeycrisp Apples",
      "category_tag": "produce",
      "expiration_days": 7,
      "image_url": "https://...",
      "description": "Crisp, sweet apples.",
      "estimated_price": "6.75",
      "quantity": 1,
      "selected": true
    }
  ]
}
```

---

### `GET /api/receipts/<receipt_id>/`
Get a receipt and its parsed line items. Must belong to the user's household.

**Response** `200` — same shape as upload response.

---

### `POST /api/receipts/<receipt_id>/confirm/`
Save selected parsed items to the household pantry (`FoodItem` records). Can be called only once per receipt.

Requires `can_upload_receipts` permission.

**Request body**
```json
{
  "items": [
    {
      "id": 12,
      "selected": true,
      "name": "Honeycrisp Apples",
      "standardized_name": "Honeycrisp Apples",
      "quantity": 1,
      "expiration_days": 7,
      "estimated_price": "6.75",
      "image_url": "https://...",
      "description": "Crisp, sweet apples."
    }
  ]
}
```

Items with `selected: false` are skipped. `expiration_date` is computed as `today + expiration_days`.

**Response** `201`
```json
{
  "detail": "Successfully added 3 items to pantry.",
  "created_count": 3,
  "confirmed_at": "2026-04-25T10:05:00Z"
}
```

---

## Error Responses

All endpoints follow a consistent error format:

```json
{ "detail": "Human-readable error message." }
```

Field-level validation errors:
```json
{
  "field_name": ["Error message for this field."],
  "another_field": ["Another error."]
}
```

**HTTP status codes used**

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `204` | No Content (successful delete) |
| `400` | Bad Request / Validation error |
| `401` | Unauthorized (not authenticated) |
| `403` | Forbidden (authenticated but not allowed) |
| `404` | Not Found |
| `500` | Server Error (receipt OCR failure, etc.) |

---

## Authentication Details

**Token lifecycle**
- Access token: 30 minutes
- Refresh token: 7 days (rotated on each refresh, old token blacklisted)

**Cookie names** (HTTP-only)
- `access_token` — JWT access token
- `refresh_token` — JWT refresh token

**CSRF**
Required for all state-changing requests. The Axios client (`axiosClient.jsx`) reads the `csrftoken` cookie and sets the `X-CSRFToken` header automatically. Call `GET /api/auth/csrf/` to initialize the cookie before the first login or signup.

---

## Frontend API Client

The frontend uses a single Axios instance configured in `src/Utils/axiosClient.jsx`:

- **Base URL:** `VITE_API_BASE_URL` env variable (default `/api`)
- **Credentials:** `withCredentials: true` (cookies sent on all requests)
- **CSRF interceptor:** Reads `csrftoken` cookie and injects `X-CSRFToken` header on non-GET requests

Domain-specific API functions live in `src/Utils/`:
- `authApi.jsx` — auth endpoints
- `userApi.jsx` — user profile
- `householdApi.jsx` — household management
- `itemsApi.jsx` — pantry items
- `shareApi.jsx` — marketplace posts and requests
- `receiptsApi.jsx` — receipt OCR
- `impactApi.jsx` — impact stats (endpoint not yet implemented)
