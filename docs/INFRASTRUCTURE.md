# Bartr — Infrastructure & Capacity Planning

This document covers hardware requirements, storage calculations, and throughput estimates for the Bartr platform at various scales.

Last updated: 2026-03-01 (reflects current schema after migrations 001–008)

---

## 0. System Architecture (Current)

### Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 14.x |
| Charts | Recharts | 3.x |
| Backend API | Fastify | 5.x |
| Language | TypeScript (ESM) | 5.x |
| Database | PostgreSQL | 16 |
| Cache / pub-sub / metrics | Redis | 7 |
| Object storage | MinIO (S3-compatible) | latest |
| Monorepo | pnpm workspaces | — |
| Containerisation | Docker Compose | — |

### Services

| Service | Port | Role |
|---------|------|------|
| `web` (Next.js) | 3000 | SSR + static assets |
| `api` (Fastify) | 4000 | REST API + metrics collector |
| `workers` | — | Background job processing |
| `postgres` | 5432 | Primary database |
| `redis` | 6379 | Session cache, rate-limit counters, metrics storage |
| `minio` | 9000 | Listing image storage |
| `minio-console` | 9001 | MinIO admin console |
| `nginx` | 80 | Reverse proxy |

### Authentication

- Email + password (primary) — email stored encrypted (AES-256-GCM) + HMAC for lookup
- Passwords hashed with **Argon2id** (memory: 65536, parallelism: 4, iterations: 3)
- Access tokens: **HS256 JWT**, 15-minute expiry, contains `sub`, `nickname`, `role`
- Refresh tokens: rotated on use, stored as SHA-256 hash in `refresh_tokens` table, 7-day TTL
- End-to-end encrypted messages: user keypair generated at registration, private key stored as password-encrypted blob

### Image pipeline

1. Client uploads to `POST /listings/:id/images` (multipart/form-data, max 5 MB)
2. API reads full buffer, validates magic bytes (JPEG/PNG/WebP)
3. Re-encodes via **sharp** at quality 85 — strips all EXIF/GPS/metadata
4. Stores processed buffer in MinIO under `listings/{listingId}/{uuid}.{ext}`
5. Only MinIO key (path string) stored in `listing_images` table

---

## 1. Database Schema (Current — migrations 001–008)

### users

Migrations: 001 (base), 003 (bio/avatar), 005 (E2E keys), 006 (email auth), 007 (nullable password_hash), 008 (role)

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| google_id | TEXT (nullable) | ~30 B |
| nickname | TEXT UNIQUE | ~15 B |
| email_encrypted | BYTEA (nullable) | ~80 B |
| email_hash | TEXT (nullable) | 64 B (hex of HMAC-SHA256) |
| password_hash | TEXT (nullable) | ~95 B (Argon2id) |
| public_key | TEXT (nullable) | ~60 B |
| private_key_blob | BYTEA (nullable) | ~200 B |
| recovery_key_blob | BYTEA (nullable) | ~200 B |
| auth_provider | TEXT | ~8 B ('google' or 'email') |
| bio | TEXT (nullable) | ~100 B |
| avatar_key | TEXT (nullable) | ~60 B |
| role | user_role ENUM | ~5 B ('user' or 'admin') |
| created_at | TIMESTAMPTZ | 8 B |
| last_active | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per user row** | | **~996 B** |

Related rows per user (created at registration):

| Table | Size |
|-------|------|
| reputation_scores | ~120 B |
| refresh_tokens (1 active) | ~110 B |
| **Total per registered user** | **~1,226 B (~1.2 KB)** |

> Note: password_hash is Argon2id (~95 B) vs the older bcrypt estimate of 60 B. The addition of E2E key blobs (~400 B combined) and email_hash (64 B) significantly increases the per-user row size compared to the original estimate.

### categories

| Column | Type | Avg Size |
|--------|------|----------|
| id | SERIAL | 4 B |
| name | TEXT | ~25 B |
| slug | TEXT | ~20 B |
| parent_id | INTEGER (nullable) | 4 B |
| **Tuple overhead** | | 27 B |
| **Total per category row** | **~80 B** |

### listings

Migrations: 001 (base), 004 (FTS + search_vector, category slug)

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| user_id | UUID | 16 B |
| title | TEXT | ~60 B |
| description | TEXT | ~500 B |
| category_id | INTEGER (nullable) | 4 B |
| payment_methods | JSONB | ~50 B |
| price_indication | TEXT (nullable) | ~15 B |
| currency | TEXT (nullable) | ~4 B |
| status | TEXT | ~7 B |
| search_vector | TSVECTOR | ~200 B (auto-updated via trigger) |
| created_at | TIMESTAMPTZ | 8 B |
| updated_at | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per listing row** | **~915 B** |

### listing_images

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| listing_id | UUID | 16 B |
| storage_key | TEXT | ~70 B |
| order_index | INTEGER | 4 B |
| **Tuple overhead** | | 27 B |
| **Total per image row** | **~133 B** |

### Listing with images (composite)

Images are re-encoded by sharp (JPEG/PNG/WebP at quality 85). Original uploads up to 5 MB are reduced to roughly 200-350 KB depending on dimensions and content.

| Scenario | DB Row Size | MinIO Object Size | Total |
|----------|-------------|-------------------|-------|
| Listing with 0 images | 915 B | 0 | **915 B** |
| Listing with 3 images (average) | 915 + (3 × 133) = 1,314 B | 3 × 275 KB = 825 KB | **~826 KB** |
| Listing with 5 images (max) | 915 + (5 × 133) = 1,580 B | 5 × 275 KB = 1.37 MB | **~1.37 MB** |

### trades

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| listing_id | UUID | 16 B |
| buyer_id | UUID | 16 B |
| seller_id | UUID | 16 B |
| status | TEXT | ~10 B |
| created_at | TIMESTAMPTZ | 8 B |
| updated_at | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per trade row** | **~117 B** |

Associated per trade:

| Table | Rows per trade | Size |
|-------|----------------|------|
| trade_events | ~3 avg | 3 × 85 B = 255 B |
| ratings | 2 (buyer + seller) | 2 × 130 B = 260 B |
| **Total per completed trade** | | **~632 B** |

### messages & message_threads

| Table | Total per row |
|-------|---------------|
| message_threads | ~107 B |
| messages | ~399 B (body_encrypted = AES of ~200 char) |

### moderation_flags

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| reporter_id | UUID | 16 B |
| target_type | TEXT | ~8 B |
| target_id | UUID | 16 B |
| reason | TEXT | ~200 B |
| status | TEXT | ~8 B |
| created_at | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per flag row** | **~299 B** |

### refresh_tokens

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| user_id | UUID | 16 B |
| token_hash | TEXT | 64 B (hex of SHA-256) |
| expires_at | TIMESTAMPTZ | 8 B |
| created_at | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per token row** | **~139 B** |

---

## 2. Storage Per User — Full Lifecycle

How much storage does one average user consume across their entire lifecycle?

### Assumptions (average active user)

| Metric | Value |
|--------|-------|
| Listings created | 5 |
| Images per listing (avg) | 2.5 |
| Trades completed | 3 |
| Messages sent | 30 |
| Message threads | 4 |
| Avatar uploaded | 1 (250 KB) |
| Moderation flags filed | 1 |

### Calculation

| Data | Rows | DB Size | Object Storage |
|------|------|---------|----------------|
| User + reputation + token | 3 | 1,226 B | — |
| Listings | 5 | 5 × 915 = 4,575 B | — |
| Listing images (rows) | 12.5 | 12.5 × 133 = 1,663 B | — |
| Listing images (files) | 12.5 | — | 12.5 × 275 KB = 3.35 MB |
| Trades + events + ratings | 3 | 3 × 632 = 1,896 B | — |
| Message threads | 4 | 4 × 107 = 428 B | — |
| Messages | 30 | 30 × 399 = 11,970 B | — |
| Avatar | 1 | 60 B (key only) | 250 KB |
| Moderation flags | 1 | 299 B | — |
| **Totals** | | **~22 KB** | **~3.6 MB** |

### Storage per user: ~3.6 MB total (22 KB in PostgreSQL + 3.6 MB in MinIO)

---

## 3. Scale Projections

| Users | PostgreSQL | MinIO (images + avatars) | Total Storage | RAM (PG + Redis) |
|-------|-----------|--------------------------|---------------|-------------------|
| 100 | 2.2 MB | 360 MB | **362 MB** | ~256 MB |
| 1,000 | 22 MB | 3.6 GB | **3.6 GB** | ~512 MB |
| 10,000 | 220 MB | 36 GB | **36 GB** | ~1 GB |
| 50,000 | 1.1 GB | 180 GB | **181 GB** | ~2 GB |
| 100,000 | 2.2 GB | 360 GB | **362 GB** | ~4 GB |

> PostgreSQL index overhead adds ~30-50% on top of raw data size. Multiply the PostgreSQL column by ~1.5x for a more conservative estimate.

---

## 4. API Surface (Current)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | — | Rich health check (services, stats, latencies) |
| GET | /health/system | — | Live system metrics snapshot (CPU, RAM, disk, net) |
| GET | /health/history | — | Time-series metric history from Redis |
| GET | /health/resend | — | Resend email quota status |
| POST | /auth/register/email | — | Email+password registration |
| POST | /auth/login/email | — | Email+password login |
| POST | /auth/refresh | — | Rotate refresh token |
| POST | /auth/logout | — | Revoke refresh token |
| GET | /auth/me | ✓ | Current user info |
| GET | /auth/key-blobs | ✓ | Fetch E2E key blobs for unlock |
| GET | /listings | — | List / search listings |
| POST | /listings | ✓ | Create listing |
| GET | /listings/:id | — | Get listing |
| PUT | /listings/:id | ✓ owner | Update listing |
| DELETE | /listings/:id | ✓ owner | Delete listing |
| POST | /listings/:id/images | ✓ owner | Upload image (EXIF stripped) |
| DELETE | /listings/:id/images/:imageId | ✓ owner | Delete image |
| GET | /categories | — | List categories |
| GET | /users/:nickname | — | Get user profile |
| GET | /users/:nickname/public-key | — | Get user's public key for E2E encryption |
| GET | /users/:nickname/avatar | — | Serve avatar image |
| PUT | /users/me | ✓ | Update own profile |
| PUT | /users/me/avatar | ✓ | Upload avatar |
| POST | /trades | ✓ | Create trade offer |
| GET | /trades | ✓ | List my trades |
| GET | /trades/:id | ✓ participant | Get trade detail |
| POST | /trades/:id/accept | ✓ seller | Accept trade |
| POST | /trades/:id/decline | ✓ seller | Decline trade |
| POST | /trades/:id/cancel | ✓ buyer | Cancel trade |
| POST | /trades/:id/complete | ✓ participant | Confirm trade completion (dual confirmation) |
| GET | /threads | ✓ | List my message threads |
| POST | /threads | ✓ | Create or get thread |
| GET | /threads/:threadId/messages | ✓ participant | Get messages |
| POST | /threads/:threadId/messages | ✓ participant | Send message |
| POST | /trades/:tradeId/rate | ✓ participant | Submit rating |
| GET | /users/:nickname/ratings | — | Get user ratings |
| POST | /flags | ✓ | Submit moderation flag |
| GET | /flags/mine | ✓ | My submitted flags |
| GET | /admin/flags | ✓ admin | List all flags |
| PUT | /admin/flags/:id | ✓ admin | Update flag status |
| POST | /moderation/check | — | Keyword filter check |
| POST | /exchange/offers | ✓ | Create exchange offer |
| GET | /exchange/offers | ✓ | List/filter exchange offers |
| GET | /exchange/offers/:id | ✓ | Get exchange offer |
| PUT | /exchange/offers/:id | ✓ owner | Update exchange offer |
| DELETE | /exchange/offers/:id | ✓ owner | Delete exchange offer |
| GET | /prices | — | Get cached price data |
| GET | /prices/:crypto | — | Get prices for one crypto |
| GET | /prices/exchanges | — | Get per-exchange prices |
| GET | /supported-coins | — | Get list of supported coins |

Auth column: `✓` = any authenticated user, `✓ owner` = resource owner only, `✓ admin` = role=admin only, `✓ participant` = trade/thread participant only, `✓ seller`/`✓ buyer` = role-specific.

---

## 5. Throughput Per User

### Average user session behavior

| Action | Requests per session | Payload |
|--------|---------------------|---------|
| Page loads (SSR) | 5 | ~50 KB HTML each |
| API calls (listings, search, profile) | 12 | ~2 KB JSON each |
| Image loads | 15 | ~275 KB each |
| Auth refresh | 0-1 | ~500 B |
| **Total per session** | **~33 requests** | **~4.4 MB transfer** |

### Session frequency

| User type | Sessions/day | Daily transfer |
|-----------|-------------|----------------|
| Casual browser | 1 | 4.4 MB |
| Active trader | 3-5 | 13-22 MB |
| Power seller | 8-10 | 35-44 MB |

**Weighted average:** ~2 sessions/day → **~9 MB/day per active user**

### Requests per second (RPS) at scale

| Daily Active Users (DAU) | Peak concurrent | RPS (sustained) | RPS (peak, 3x) |
|--------------------------|-----------------|-----------------|-----------------|
| 100 | 15 | 2 | 6 |
| 1,000 | 150 | 18 | 54 |
| 10,000 | 1,500 | 180 | 540 |
| 50,000 | 7,500 | 900 | 2,700 |

> Peak concurrent = ~15% of DAU. Peak RPS = 3x sustained.

### Bandwidth at scale

| DAU | Daily bandwidth | Monthly bandwidth |
|-----|----------------|-------------------|
| 100 | 900 MB | 27 GB |
| 1,000 | 9 GB | 270 GB |
| 10,000 | 90 GB | 2.7 TB |
| 50,000 | 450 GB | 13.5 TB |

---

## 6. Database Query Performance

Expected query latencies on a single PostgreSQL 16 instance:

| Query | Expected Latency | Notes |
|-------|-----------------|-------|
| User lookup by nickname | < 1ms | B-tree index on nickname |
| User lookup by email_hash | < 1ms | B-tree index on email_hash |
| Listing by ID | < 1ms | Primary key |
| Listing search (full-text) | 5-20ms | GIN index on search_vector |
| Listings by category (paginated) | 2-5ms | Category + status index |
| Trade history for user | 2-5ms | buyer_id/seller_id indexes |
| Reputation score lookup | < 1ms | Primary key (user_id) |
| Message thread listing | 2-5ms | Composite index on participants |
| Messages in thread (paginated) | 2-5ms | Thread + created_at index |
| Admin flag listing | 2-5ms | Status + target_type index |

PostgreSQL 16 handles 5,000-10,000 simple queries/sec on a 4-core VPS. Full-text search queries are heavier but still 500-1,000/sec.

---

## 7. Hardware Recommendations

### Tier 1 — Launch (0-1,000 users)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| CPU | 2 vCPU | |
| RAM | 4 GB | |
| Storage | 80 GB NVMe SSD | |
| Bandwidth | 2 TB/month | |
| **Provider** | **FlokiNET VPS (Iceland)** | **~€15-25/mo** |

All 6 Docker services run comfortably. PostgreSQL and Redis share ~1 GB RAM. MinIO uses disk only.

### Tier 2 — Growth (1,000-10,000 users)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| CPU | 4 vCPU | |
| RAM | 8 GB | |
| Storage | 250 GB NVMe SSD | |
| Bandwidth | 5 TB/month | |
| **Provider** | **FlokiNET / 1984 Hosting** | **~€40-60/mo** |

Consider moving MinIO images to Backblaze B2 ($6/TB/mo) to save local disk. Add a PostgreSQL read replica if query load demands it.

### Tier 3 — Scale (10,000-50,000 users)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| CPU | 8 vCPU | |
| RAM | 16 GB | |
| Storage | 500 GB NVMe SSD (DB) + B2 for images | |
| Bandwidth | 15 TB/month | |
| **Provider** | **Dedicated server or 2-VPS split** | **~€80-150/mo** |

At this scale:
- Split API and PostgreSQL onto separate VPS instances
- Move image storage to Backblaze B2 or Wasabi
- Add Redis Sentinel for high availability
- Consider PostgreSQL read replicas
- CDN for static Next.js assets only — user images proxied for privacy

### Tier 4 — Major scale (50,000+ users)

At this point, evaluate:
- Federation / decentralisation (multiple independent nodes)
- Horizontal API scaling (multiple Fastify instances behind a load balancer)
- PostgreSQL partitioning (partition messages by date, listings by status)
- Dedicated image processing workers
- Estimated cost: €200-400/mo for infrastructure

---

## 8. Backup Strategy

| What | Method | Frequency | Retention | Size estimate (10K users) |
|------|--------|-----------|-----------|--------------------------|
| PostgreSQL | `pg_dump` → gzip → encrypt → B2 | Daily | 30 days | ~150 MB compressed |
| MinIO images | `mc mirror` → B2 | Daily incremental | Indefinite | ~36 GB |
| Redis | RDB snapshot | Hourly | 24 hours | ~50 MB |
| Config / secrets | Git repo (no secrets in git) + encrypted vault | On change | Indefinite | ~10 KB |

Total backup storage at 10K users: ~37 GB → ~$0.22/month on Backblaze B2.

---

## 9. Security Measures

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS / TLS (enforced in production) |
| Auth tokens | Short-lived JWTs (15 min access, 7 day refresh rotated on use) |
| Passwords | Argon2id (m=65536, t=3, p=4) |
| Email storage | AES-256-GCM encrypt + HMAC for lookup (plaintext never stored) |
| Messages | E2E encrypted (keypair per user, private key encrypted with Argon2id-derived key) |
| Images | EXIF stripped by sharp before storage (no GPS metadata) |
| File uploads | Magic bytes validation (not Content-Type header); max 5 MB |
| Rate limiting | Redis-backed per-IP (configurable, disabled in tests) |
| Admin routes | `requireAdmin` hook — role=admin in JWT required for `/admin/*` |
| SQL injection | Parameterised queries throughout (no string interpolation) |

---

## 10. Monitoring

### Self-contained system (no external tools)

Monitoring is built into the API process — no Grafana, Prometheus, or exporters needed.

| Component | Description |
|-----------|-------------|
| Metrics collector | Runs every 5s inside the API process (Node.js `os` + `/proc` + `fs.statfsSync`) |
| Storage | Redis ZSETs with 14-day retention (~10 MB per metric, ~100 MB total for ~10 metrics) |
| Dashboard | `/health` page in the web app (recharts, public, no auth) |
| Endpoints | `/health/system` (live snapshot), `/health/history` (time-series), `/health/resend` (email quota) |

### Collected metrics

| Metric | Source | Redis Key |
|--------|--------|-----------|
| CPU per core | `os.cpus()` delta | `metrics:cpu:N` |
| RAM % | `os.totalmem()` / `os.freemem()` | `metrics:ram` |
| Disk usage | `fs.statfsSync('/')` | `metrics:disk` |
| Disk read speed | `/proc/diskstats` delta | `metrics:disk_read` |
| Disk write speed | `/proc/diskstats` delta | `metrics:disk_write` |
| Network RX | `/proc/net/dev` delta | `metrics:net_rx` |
| Network TX | `/proc/net/dev` delta | `metrics:net_tx` |

### Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU usage (sustained) | > 70% | > 90% |
| RAM usage | > 75% | > 90% |
| Disk usage | > 70% | > 85% |
| PostgreSQL connections | > 80 | > 120 (of 150 max) |
| API response time (p95) | > 200ms | > 500ms |
| Redis memory | > 500 MB | > 1 GB |
| Error rate (5xx) | > 1% | > 5% |
| Image processing queue depth | > 100 | > 500 |
