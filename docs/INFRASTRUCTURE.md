# Bartr — Infrastructure & Capacity Planning

This document covers hardware requirements, storage calculations, and throughput estimates for the Bartr platform at various scales.

---

## 1. Storage Per Row — PostgreSQL

All sizes include PostgreSQL tuple overhead (23 bytes header + 4 bytes item pointer per row). UUID = 16 bytes. TIMESTAMPTZ = 8 bytes. TEXT sizes are averages based on realistic marketplace data. NUMERIC fields = 8 bytes each.

### users

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| google_id | TEXT | ~30 B |
| nickname | TEXT | ~15 B |
| email_encrypted | BYTEA | ~80 B (AES-256 of ~40 char email) |
| password_hash | TEXT | 60 B (bcrypt output) |
| bio | TEXT | ~100 B (avg, max 500) |
| avatar_key | TEXT | ~60 B (path string, nullable) |
| created_at | TIMESTAMPTZ | 8 B |
| last_active | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per user row** | | **~404 B** |

Related rows per user (created at registration):

| Table | Size |
|-------|------|
| reputation_scores | ~120 B |
| refresh_tokens (1 active) | ~110 B |
| **Total per registered user** | **~634 B** |

### listings

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| user_id | UUID | 16 B |
| title | TEXT | ~60 B |
| description | TEXT | ~500 B |
| category_id | INTEGER | 4 B |
| payment_methods | JSONB | ~50 B (`["btc","xmr","cash"]`) |
| price_indication | TEXT | ~15 B |
| currency | TEXT | ~4 B |
| status | TEXT | ~7 B |
| created_at | TIMESTAMPTZ | 8 B |
| updated_at | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per listing row** | **~715 B** |

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

| Scenario | DB Row Size | MinIO Object Size | Total |
|----------|-------------|-------------------|-------|
| Listing with 0 images (cash/barter post) | 715 B | 0 | **715 B** |
| Listing with 3 images (average) | 715 + (3 × 133) = 1,114 B | 3 × 250 KB = 750 KB | **~751 KB** |
| Listing with 5 images (max) | 715 + (5 × 133) = 1,380 B | 5 × 250 KB = 1.25 MB | **~1.25 MB** |

> Image size assumes: original ~2MB JPEG → processed to 1200px wide WebP at quality 80 → ~250 KB average after EXIF strip + resize + conversion.

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
| trade_events | ~3 avg (offered, accepted, completed) | 3 × 85 B = 255 B |
| ratings | 2 (one from each party) | 2 × 130 B = 260 B |
| **Total per completed trade** | | **~632 B** |

### messages

| Column | Type | Avg Size |
|--------|------|----------|
| id | UUID | 16 B |
| thread_id | UUID | 16 B |
| sender_id | UUID | 16 B |
| recipient_id | UUID | 16 B |
| body_encrypted | BYTEA | ~300 B (AES of ~200 char message) |
| created_at | TIMESTAMPTZ | 8 B |
| **Tuple overhead** | | 27 B |
| **Total per message row** | **~399 B** |

### message_threads

| **Total per thread row** | **~107 B** |
|--------------------------|------------|

---

## 2. Storage Per User — Full Lifecycle

How much storage does one average user consume across their entire lifecycle?

### Assumptions (average active user)

| Metric | Value |
|--------|-------|
| Listings created | 5 |
| Images per listing (avg) | 2.5 (some have 0, some have 5) |
| Trades completed | 3 |
| Messages sent | 30 |
| Message threads | 4 |
| Avatar uploaded | 1 (250 KB) |

### Calculation

| Data | Rows | DB Size | Object Storage |
|------|------|---------|----------------|
| User + reputation + token | 3 | 634 B | — |
| Listings | 5 | 5 × 715 = 3,575 B | — |
| Listing images (rows) | 12.5 | 12.5 × 133 = 1,663 B | — |
| Listing images (files) | 12.5 | — | 12.5 × 250 KB = 3.05 MB |
| Trades + events + ratings | 3 | 3 × 632 = 1,896 B | — |
| Message threads | 4 | 4 × 107 = 428 B | — |
| Messages | 30 | 30 × 399 = 11,970 B | — |
| Avatar | 1 | 60 B (key only) | 250 KB |
| **Totals** | | **~20 KB** | **~3.3 MB** |

### Storage per user: ~3.3 MB total (20 KB in PostgreSQL + 3.3 MB in MinIO)

---

## 3. Scale Projections

| Users | PostgreSQL | MinIO (images) | Total Storage | RAM (PG + Redis) |
|-------|-----------|----------------|---------------|-------------------|
| 100 | 2 MB | 330 MB | **332 MB** | ~256 MB |
| 1,000 | 20 MB | 3.3 GB | **3.3 GB** | ~512 MB |
| 10,000 | 200 MB | 33 GB | **33 GB** | ~1 GB |
| 50,000 | 1 GB | 165 GB | **166 GB** | ~2 GB |
| 100,000 | 2 GB | 330 GB | **332 GB** | ~4 GB |

> PostgreSQL index overhead adds ~30-50% on top of raw data size. The table above shows data only.
> With indexes, multiply the PostgreSQL column by ~1.5x.

---

## 4. Throughput Per User

### Average user session behavior

Based on comparable P2P marketplace traffic patterns:

| Action | Requests per session | Payload |
|--------|---------------------|---------|
| Page loads (SSR) | 5 | ~50 KB HTML each |
| API calls (listings, search, profile) | 12 | ~2 KB JSON each |
| Image loads | 15 | ~250 KB each |
| WebSocket messages | 3 | ~200 B each |
| Auth refresh | 0-1 | ~500 B |
| **Total per session** | **~36 requests** | **~4 MB transfer** |

### Session frequency

| User type | Sessions/day | Daily transfer |
|-----------|-------------|----------------|
| Casual browser | 1 | 4 MB |
| Active trader | 3-5 | 12-20 MB |
| Power seller | 8-10 | 32-40 MB |

**Weighted average:** ~2 sessions/day → **~8 MB/day per active user**

### Requests per second (RPS) at scale

| Daily Active Users (DAU) | Peak concurrent | RPS (sustained) | RPS (peak, 3x) |
|--------------------------|-----------------|-----------------|-----------------|
| 100 | 15 | 2 | 6 |
| 1,000 | 150 | 18 | 54 |
| 10,000 | 1,500 | 180 | 540 |
| 50,000 | 7,500 | 900 | 2,700 |

> Peak concurrent = ~15% of DAU (marketplace traffic peaks during evening hours).
> Peak RPS = 3x sustained (lunch + evening spikes).

### Bandwidth at scale

| DAU | Daily bandwidth | Monthly bandwidth |
|-----|----------------|-------------------|
| 100 | 800 MB | 24 GB |
| 1,000 | 8 GB | 240 GB |
| 10,000 | 80 GB | 2.4 TB |
| 50,000 | 400 GB | 12 TB |

---

## 5. Database Query Performance

Expected query latencies on a single PostgreSQL 16 instance:

| Query | Expected Latency | Notes |
|-------|-----------------|-------|
| User lookup by nickname | < 1ms | B-tree index |
| Listing by ID | < 1ms | Primary key |
| Listing search (full-text) | 5-20ms | tsvector index, depends on result count |
| Listings by category (paginated) | 2-5ms | Category index + LIMIT/OFFSET |
| Trade history for user | 2-5ms | buyer_id/seller_id indexes |
| Reputation score lookup | < 1ms | Primary key (user_id) |
| Message thread listing | 2-5ms | Composite index on participants |
| Messages in thread (paginated) | 2-5ms | Thread index + created_at |

PostgreSQL can handle 5,000-10,000 simple queries/sec on a 4-core VPS. Full-text search queries are heavier but still 500-1,000/sec.

---

## 6. Hardware Recommendations

### Tier 1 — Launch (0-1,000 users)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| CPU | 2 vCPU | |
| RAM | 4 GB | |
| Storage | 80 GB NVMe SSD | |
| Bandwidth | 2 TB/month | |
| **Provider** | **FlokiNET VPS (Iceland)** | **~€15-25/mo** |

All 7 Docker containers run comfortably. PostgreSQL and Redis share ~1 GB RAM. MinIO uses disk only. Plenty of headroom.

### Tier 2 — Growth (1,000-10,000 users)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| CPU | 4 vCPU | |
| RAM | 8 GB | |
| Storage | 250 GB NVMe SSD | |
| Bandwidth | 5 TB/month | |
| **Provider** | **FlokiNET / 1984 Hosting** | **~€40-60/mo** |

Consider moving MinIO images to Backblaze B2 ($5/TB/mo) to save local disk. Add a read replica for PostgreSQL if query load demands it.

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
- Consider read replicas for PostgreSQL
- CDN for static assets (but NOT for user-uploaded images — those stay proxied for privacy)

### Tier 4 — Major scale (50,000+ users)

At this point, evaluate:
- Federation / decentralization (multiple nodes)
- Horizontal API scaling (multiple Fastify instances behind a load balancer)
- PostgreSQL partitioning (partition messages table by date, listings by status)
- Dedicated image processing workers on separate hardware
- Estimated cost: €200-400/mo for infrastructure

---

## 7. Backup Strategy

| What | Method | Frequency | Retention | Size estimate (10K users) |
|------|--------|-----------|-----------|--------------------------|
| PostgreSQL | `pg_dump` → gzip → encrypt → B2 | Daily | 30 days | ~100 MB compressed |
| MinIO images | `mc mirror` → B2 | Daily incremental | Indefinite | ~33 GB |
| Redis | RDB snapshot | Hourly | 24 hours | ~50 MB |
| Nginx config | Git repo | On change | Indefinite | ~5 KB |

Total backup storage at 10K users: ~35 GB → ~$0.18/month on Backblaze B2.

---

## 8. Monitoring Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU usage (sustained) | > 70% | > 90% |
| RAM usage | > 75% | > 90% |
| Disk usage | > 70% | > 85% |
| PostgreSQL connections | > 80 | > 120 (of 150 max) |
| API response time (p95) | > 200ms | > 500ms |
| Redis memory | > 500 MB | > 1 GB |
| Error rate (5xx) | > 1% | > 5% |
