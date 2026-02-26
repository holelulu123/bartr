# Bartr API Reference

Base URL: `http://localhost/api` (dev) or `https://yourdomain.com/api` (prod)

**Authentication**: Protected endpoints require `Authorization: Bearer <access_token>` header.

---

## Health

### GET /health
Check service health.

**Auth**: No

**Response** `200`:
```json
{ "status": "ok", "db": true, "redis": true }
```

**Errors**: `503` — Service unavailable

---

## Auth

### GET /auth/google
Redirect to Google OAuth 2.0 consent screen.

**Auth**: No
**Response**: `302` redirect to Google

### GET /auth/google/callback
Google OAuth callback. Exchanges code for tokens.

**Auth**: No
**Query**: `code` (string), `error` (string)
**Response**: `302` redirect to frontend with `access_token` and `refresh_token`

### POST /auth/register
Create a new user account.

**Auth**: No
**Body**:
```json
{
  "google_id": "string (required)",
  "email": "string",
  "nickname": "string (3-30 chars, required)",
  "password": "string (min 8 chars, required)"
}
```
**Response** `201`:
```json
{ "access_token": "string", "refresh_token": "string" }
```
**Errors**: `400` validation, `409` nickname/google_id taken

### POST /auth/refresh
Rotate refresh token and get new access token.

**Auth**: No
**Body**:
```json
{ "refresh_token": "string (required)" }
```
**Response** `200`:
```json
{ "access_token": "string", "refresh_token": "string" }
```
**Errors**: `400` missing token, `401` invalid/expired

### POST /auth/logout
Revoke a refresh token.

**Auth**: No
**Body**:
```json
{ "refresh_token": "string" }
```
**Response** `200`:
```json
{ "ok": true }
```

### GET /auth/me
Get current authenticated user.

**Auth**: Yes
**Response** `200`:
```json
{ "id": "uuid", "nickname": "string", "created_at": "timestamp", "last_active": "timestamp" }
```
**Errors**: `401` unauthorized, `404` user not found

---

## Users

### GET /users/:nickname
Get public profile.

**Auth**: No
**Response** `200`:
```json
{
  "id": "uuid",
  "nickname": "string",
  "bio": "string",
  "avatar_url": "/api/users/:nickname/avatar" | null,
  "created_at": "timestamp",
  "last_active": "timestamp",
  "reputation": {
    "composite_score": 0,
    "rating_avg": 0,
    "tier": "new | verified | trusted | elite"
  }
}
```
**Errors**: `404` user not found

### PUT /users/me
Update own profile.

**Auth**: Yes
**Body**:
```json
{
  "nickname": "string (3-30 chars, optional)",
  "bio": "string (max 500 chars, optional)"
}
```
**Response** `200`:
```json
{ "id": "uuid", "nickname": "string", "bio": "string", "avatar_key": "string" }
```
**Errors**: `400` validation, `409` nickname taken

### PUT /users/me/avatar
Upload avatar image.

**Auth**: Yes
**Body**: Multipart file (JPEG, PNG, or WebP, max 5MB)
**Response** `200`:
```json
{ "avatar_key": "string" }
```
**Errors**: `400` no file / invalid type

### GET /users/:nickname/avatar
Serve avatar image.

**Auth**: No
**Response**: Binary image stream with `Content-Type` and `Cache-Control` headers
**Errors**: `404` avatar not found

### GET /users/:nickname/ratings
Get ratings received by a user.

**Auth**: No
**Query**: `page` (default 1), `limit` (default 20, max 100)
**Response** `200`:
```json
{
  "ratings": [
    { "id": "uuid", "score": 5, "comment": "string", "created_at": "timestamp", "from_nickname": "string" }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 0, "pages": 0 }
}
```
**Errors**: `404` user not found

---

## Listings

### POST /listings
Create a new listing.

**Auth**: Yes
**Body**:
```json
{
  "title": "string (3-200 chars, required)",
  "description": "string (10-5000 chars, required)",
  "payment_methods": ["btc", "xmr", "eth", "cash", "bank_transfer"] (at least one, required),
  "category_id": "number (optional)",
  "price_indication": "string (optional)",
  "currency": "string (optional)"
}
```
**Response** `201`:
```json
{
  "id": "uuid", "user_id": "uuid", "title": "string", "description": "string",
  "category_id": null, "payment_methods": [], "price_indication": null,
  "currency": null, "status": "active", "created_at": "timestamp", "updated_at": "timestamp"
}
```
**Errors**: `400` validation / invalid category

### GET /listings/:id
Get listing details.

**Auth**: No
**Response** `200`:
```json
{
  "id": "uuid", "title": "string", "description": "string", "status": "active",
  "seller_nickname": "string", "category_name": "string", "category_slug": "string",
  "payment_methods": [], "price_indication": null, "currency": null,
  "images": [{ "id": "uuid", "storage_key": "string", "order_index": 0 }],
  "created_at": "timestamp", "updated_at": "timestamp"
}
```
**Errors**: `404` not found

### GET /listings
Search and list listings.

**Auth**: No
**Query**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | — | Full-text search query |
| `category` | string | — | Category slug filter |
| `payment_method` | string | — | Filter by payment method |
| `status` | string | `active` | Listing status filter |
| `user_id` | string | — | Filter by seller |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |

**Response** `200`:
```json
{
  "listings": [
    { "id": "uuid", "title": "string", "price_indication": null, "currency": null,
      "payment_methods": [], "status": "active", "created_at": "timestamp",
      "seller_nickname": "string", "category_name": "string", "thumbnail": null }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 0, "pages": 0 }
}
```

### PUT /listings/:id
Update own listing.

**Auth**: Yes (owner only)
**Body**: Same fields as POST (all optional), plus `status` (active, paused, sold, removed)
**Response** `200`: Updated listing object
**Errors**: `400` validation, `403` not owner, `404` not found

### DELETE /listings/:id
Delete own listing (also removes images from storage).

**Auth**: Yes (owner only)
**Response** `200`:
```json
{ "ok": true }
```
**Errors**: `403` not owner, `404` not found

### POST /listings/:id/images
Upload image for a listing (max 5 per listing).

**Auth**: Yes (owner only)
**Body**: Multipart file (JPEG, PNG, or WebP, max 5MB)
**Response** `201`:
```json
{ "id": "uuid", "storage_key": "string", "order_index": 0 }
```
**Errors**: `400` max reached / invalid type, `403` not owner, `404` not found

### DELETE /listings/:id/images/:imageId
Delete a listing image.

**Auth**: Yes (owner only)
**Response** `200`:
```json
{ "ok": true }
```
**Errors**: `403` not owner, `404` not found

### GET /categories
List all categories.

**Auth**: No
**Response** `200`:
```json
{
  "categories": [
    { "id": 1, "name": "Electronics", "slug": "electronics", "parent_id": null }
  ]
}
```

---

## Trades

Trade status flow: `offered` → `accepted` → `completed`
Alternative endings: `offered` → `declined`, `offered`/`accepted` → `cancelled`

### POST /trades
Create a trade offer on a listing (buyer initiates).

**Auth**: Yes
**Body**:
```json
{ "listing_id": "uuid (required)" }
```
**Response** `201`:
```json
{
  "id": "uuid", "listing_id": "uuid", "buyer_id": "uuid", "seller_id": "uuid",
  "status": "offered", "created_at": "timestamp", "updated_at": "timestamp"
}
```
**Errors**: `400` own listing / inactive, `404` listing not found, `409` existing active trade

### GET /trades/:id
Get trade details with event log.

**Auth**: Yes (participant only)
**Response** `200`:
```json
{
  "id": "uuid", "listing_id": "uuid", "status": "offered",
  "listing_title": "string", "buyer_nickname": "string", "seller_nickname": "string",
  "events": [{ "id": "uuid", "event_type": "offered", "created_by": "uuid", "created_at": "timestamp" }]
}
```
**Errors**: `403` not participant, `404` not found

### GET /trades
List my trades.

**Auth**: Yes
**Query**: `role` (buyer, seller), `status`, `page`, `limit`
**Response** `200`:
```json
{
  "trades": [{ "id": "uuid", "status": "offered", "listing_title": "string", "buyer_nickname": "string", "seller_nickname": "string" }],
  "pagination": { "page": 1, "limit": 20, "total": 0, "pages": 0 }
}
```

### POST /trades/:id/accept
Seller accepts an offered trade.

**Auth**: Yes (seller only)
**Response** `200`: Trade object with `status: "accepted"`
**Errors**: `400` wrong status, `403` not seller, `404` not found

### POST /trades/:id/decline
Seller declines an offered trade.

**Auth**: Yes (seller only)
**Response** `200`: Trade object with `status: "declined"`
**Errors**: `400` wrong status, `403` not seller, `404` not found

### POST /trades/:id/cancel
Buyer cancels a trade (from offered or accepted).

**Auth**: Yes (buyer only)
**Response** `200`: Trade object with `status: "cancelled"`
**Errors**: `400` wrong status, `403` not buyer, `404` not found

### POST /trades/:id/complete
Confirm trade completion. Both buyer and seller must call this endpoint.

**Auth**: Yes (participant)
**Response** `200`:
- If first confirmation: `{ "id": "uuid", "status": "accepted", "message": "Waiting for other party" }`
- If both confirmed: `{ "id": "uuid", "status": "completed", "message": "Trade completed! Both parties confirmed." }`

**Errors**: `400` wrong status, `403` not participant, `404` not found, `409` already confirmed

---

## Ratings

### POST /trades/:tradeId/rate
Rate the other party after a completed trade. Both buyer and seller can independently rate each other.

**Auth**: Yes (participant in trade)
**Body**:
```json
{
  "score": 5,       // 1-5 integer, required
  "comment": "string" // max 500 chars, optional
}
```
**Response** `201`:
```json
{
  "id": "uuid", "trade_id": "uuid", "from_user_id": "uuid",
  "to_user_id": "uuid", "score": 5, "comment": "string", "created_at": "timestamp"
}
```
**Errors**: `400` invalid score / non-completed trade, `403` not participant, `404` trade not found, `409` already rated

**Side effect**: Recalculates reputation score for the rated user.

---

## Messages

### POST /threads
Create or get a message thread between two users.

**Auth**: Yes
**Body**:
```json
{
  "recipient_nickname": "string (required)",
  "listing_id": "uuid (optional, to associate thread with a listing)"
}
```
**Response** `201` (new) or `200` (existing):
```json
{ "id": "uuid", "participant_1": "uuid", "participant_2": "uuid", "listing_id": null, "created_at": "timestamp", "existing": true }
```
**Errors**: `400` self-message, `404` recipient not found

### GET /threads
List my message threads.

**Auth**: Yes
**Query**: `page`, `limit`
**Response** `200`:
```json
{
  "threads": [{
    "id": "uuid", "listing_id": null, "created_at": "timestamp",
    "participant_1_nickname": "string", "participant_2_nickname": "string",
    "listing_title": null, "last_message_at": "timestamp"
  }],
  "pagination": { "page": 1, "limit": 20, "total": 0, "pages": 0 }
}
```

### POST /threads/:threadId/messages
Send a message in a thread.

**Auth**: Yes (participant only)
**Body**:
```json
{ "body": "string (1-5000 chars, required)" }
```
**Response** `201`:
```json
{ "id": "uuid", "thread_id": "uuid", "sender_id": "uuid", "recipient_id": "uuid", "body": "string", "created_at": "timestamp" }
```
**Errors**: `400` empty/long message, `403` not participant, `404` thread not found

### GET /threads/:threadId/messages
Get messages in a thread (chronological order).

**Auth**: Yes (participant only)
**Query**: `page` (default 1), `limit` (default 50, max 100)
**Response** `200`:
```json
{
  "messages": [{
    "id": "uuid", "sender_id": "uuid", "sender_nickname": "string",
    "recipient_id": "uuid", "body": "string", "created_at": "timestamp"
  }],
  "pagination": { "page": 1, "limit": 50, "total": 0, "pages": 0 }
}
```
**Errors**: `403` not participant, `404` thread not found

---

## Moderation

### POST /flags
Report a listing, user, or message.

**Auth**: Yes
**Body**:
```json
{
  "target_type": "listing | user | message",
  "target_id": "uuid (required)",
  "reason": "string (5-1000 chars, required)"
}
```
**Response** `201`:
```json
{ "id": "uuid", "reporter_id": "uuid", "target_type": "listing", "target_id": "uuid", "reason": "string", "status": "pending", "created_at": "timestamp" }
```
**Errors**: `400` invalid type / short reason, `404` target not found, `409` duplicate pending flag

### GET /flags/mine
List my submitted flags.

**Auth**: Yes
**Query**: `page`, `limit`
**Response** `200`:
```json
{ "flags": [...], "pagination": { ... } }
```

### GET /admin/flags
List all flags (admin dashboard).

**Auth**: Yes
**Query**: `status` (default: pending), `target_type`, `page`, `limit`
**Response** `200`:
```json
{ "flags": [{ ..., "reporter_nickname": "string" }], "pagination": { ... } }
```

### PUT /admin/flags/:id
Update flag status.

**Auth**: Yes
**Body**:
```json
{ "status": "reviewed | resolved | dismissed" }
```
**Response** `200`: Updated flag object
**Errors**: `400` invalid status, `404` flag not found

### POST /moderation/check
Pre-check text against keyword filter (no auth needed).

**Auth**: No
**Body**:
```json
{ "text": "string (required)" }
```
**Response** `200`:
```json
{ "allowed": true, "blocked_keyword": null }
```

---

## Summary

| Area | Endpoints | Auth Required |
|------|-----------|---------------|
| Health | 1 | 0 |
| Auth | 6 | 1 |
| Users | 5 | 2 |
| Listings | 8 | 5 |
| Trades | 7 | 7 |
| Ratings | 2 | 1 |
| Messages | 4 | 4 |
| Moderation | 5 | 3 |
| **Total** | **38** | **23** |

## Rate Limiting

- **App level**: 100 requests/minute per IP
- **Nginx (production)**:
  - Auth routes: 5 req/sec (burst 10)
  - Upload routes: 2 req/sec (burst 5)
  - General API: 30 req/sec (burst 50)

## Reputation Scoring

Composite score (0-100) weighted:
- Rating average: 40%
- Completion rate: 20%
- Trade volume: 20%
- Account tenure: 10%
- Low dispute rate: 10%

Tiers: `new` → `verified` (3+ trades, score 30+) → `trusted` (10+ trades, score 60+) → `elite` (25+ trades, score 80+)
