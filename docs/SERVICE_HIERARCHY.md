# Service Hierarchy — Bartr

```
═══════════════════════════════════════════════════════════════════════════
 LAYER 0 — CLIENT
═══════════════════════════════════════════════════════════════════════════

        ┌──────────────────────┐      ┌──────────────────────┐
        │   Web Browser        │      │   Tor Browser        │
        │   (Desktop/Mobile)   │      │   (Hidden Service)   │
        └──────────┬───────────┘      └──────────┬───────────┘
                   │  HTTPS / WSS                │  .onion / WSS
                   └──────────────┬──────────────┘

═══════════════════════════════════════════════════════════════════════════
 LAYER 1 — EDGE / NETWORK
═══════════════════════════════════════════════════════════════════════════

                   │
        ┌──────────▼──────────────────────────────────────┐
        │   DNS + DDoS Protection                         │
        │   (Cloudflare proxy — DNS only, no logs mode)   │
        └──────────┬──────────────────────────────────────┘
                   │  TCP/443 (TLS 1.3)

═══════════════════════════════════════════════════════════════════════════
 LAYER 2 — GATEWAY / REVERSE PROXY
═══════════════════════════════════════════════════════════════════════════

                   │
        ┌──────────▼─────────────────────────────────────────────────┐
        │   Nginx                                                     │
        │                                                             │
        │   • TLS termination (Let's Encrypt / Certbot)              │
        │   • Rate limiting (in-memory, no IP logging to disk)       │
        │   • Static asset serving (JS, CSS, images)                 │
        │   • Request routing → upstream services                    │
        │   • WebSocket proxy (upgrade headers)                      │
        │   • Security headers (HSTS, CSP, X-Frame-Options)         │
        └──────┬──────────────────┬──────────────────────────────────┘
               │                  │
     HTTP/80   │     WS/443       │
     (redirect) │                  │

═══════════════════════════════════════════════════════════════════════════
 LAYER 3 — APPLICATION SERVICES
═══════════════════════════════════════════════════════════════════════════

        ┌──────▼──────────┐      ┌────────────────────┐
        │  Next.js Server │      │  WebSocket Server  │
        │                 │      │                    │
        │  • SSR pages    │      │  • Real-time       │
        │  • Public routes│      │    notifications   │
        │  • SEO meta     │      │  • Trade offer     │
        │  • Hydration    │      │    alerts          │
        │  • Static assets│      │  • New message     │
        └────────┬────────┘      │    alerts          │
                 │               └────────┬───────────┘
                 │ REST API calls         │ pub/sub events
                 │                        │
        ┌────────▼────────────────────────▼────────────────────────┐
        │   API Server  (Fastify)                                   │
        │                                                          │
        │   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
        │   │ Auth Service │  │ Listing Svc  │  │  Trade Svc  │  │
        │   │              │  │              │  │             │  │
        │   │ • Google     │  │ • CRUD       │  │ • Offer     │  │
        │   │   OAuth 2.0  │  │ • Search     │  │   flow      │  │
        │   │ • JWT issue  │  │ • Filter     │  │ • Status    │  │
        │   │ • JWT verify │  │ • Pagination │  │   tracking  │  │
        │   │ • Refresh    │  │ • Category   │  │ • Mark      │  │
        │   │   tokens     │  │   index      │  │   complete  │  │
        │   └──────────────┘  └──────────────┘  └─────────────┘  │
        │                                                          │
        │   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
        │   │ Reputation   │  │  Messaging   │  │  Moderation │  │
        │   │ Service      │  │  Service     │  │  Service    │  │
        │   │              │  │              │  │             │  │
        │   │ • Score calc │  │ • E2E        │  │ • Flag      │  │
        │   │ • Rating     │  │   encrypted  │  │   review    │  │
        │   │   submit     │  │   DMs        │  │ • Keyword   │  │
        │   │ • Anti-manip │  │ • Inbox      │  │   filter    │  │
        │   │   rules      │  │ • Thread     │  │ • Ban/warn  │  │
        │   │ • Tier calc  │  │   history    │  │   actions   │  │
        │   └──────────────┘  └──────────────┘  └─────────────┘  │
        └─────────────────────────┬────────────────────────────────┘
                                  │

═══════════════════════════════════════════════════════════════════════════
 LAYER 4 — BACKGROUND WORKERS
═══════════════════════════════════════════════════════════════════════════

                                  │
        ┌─────────────────────────▼────────────────────────────────┐
        │   Worker Queue  (Redis Streams / BullMQ)                 │
        │                                                          │
        │   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
        │   │ Image        │  │ Email        │  │  Score      │  │
        │   │ Processor    │  │ Worker       │  │  Recompute  │  │
        │   │              │  │              │  │  Worker     │  │
        │   │ • EXIF strip │  │ • Trade      │  │             │  │
        │   │ • Resize     │  │   alerts     │  │ • Runs on   │  │
        │   │ • WebP conv  │  │ • Rating     │  │   schedule  │  │
        │   │ • Malware    │  │   received   │  │ • Recalc    │  │
        │   │   scan       │  │ • Account    │  │   composite │  │
        │   │ • Upload to  │  │   notices    │  │   scores    │  │
        │   │   storage    │  │              │  │             │  │
        │   └──────────────┘  └──────────────┘  └─────────────┘  │
        └─────────────────────────┬────────────────────────────────┘
                                  │

═══════════════════════════════════════════════════════════════════════════
 LAYER 5 — CACHE / SESSION / PUBSUB
═══════════════════════════════════════════════════════════════════════════

                                  │
        ┌─────────────────────────▼────────────────────────────────┐
        │   Redis                                                  │
        │                                                          │
        │   • JWT refresh token store (TTL-based)                 │
        │   • Rate limit counters (per IP, per user)              │
        │   • Session cache                                        │
        │   • Pub/sub bus for WebSocket events                    │
        │   • Worker job queue (BullMQ)                           │
        │   • Short-lived listing view counters                   │
        └─────────────────────────┬────────────────────────────────┘
                                  │

═══════════════════════════════════════════════════════════════════════════
 LAYER 6 — PERSISTENCE / DATA
═══════════════════════════════════════════════════════════════════════════

                                  │
               ┌──────────────────┴───────────────────┐
               │                                      │
   ┌───────────▼──────────────┐        ┌──────────────▼──────────────┐
   │   PostgreSQL             │        │   Object Storage            │
   │                          │        │   (MinIO / Backblaze B2)    │
   │  Tables:                 │        │                             │
   │  • users                 │        │  Buckets:                   │
   │  • refresh_tokens        │        │  • listing-images/          │
   │  • listings              │        │  • avatars/                 │
   │  • listing_images        │        │  • db-backups/              │
   │  • categories            │        │                             │
   │  • trades                │        │  All images:                │
   │  • trade_events          │        │  • EXIF stripped            │
   │  • messages              │        │  • Converted to WebP        │
   │  • message_threads       │        │  • Served via Nginx         │
   │  • ratings               │        │    (no direct public URL)   │
   │  • reputation_scores     │        └─────────────────────────────┘
   │  • moderation_flags      │
   │                          │
   │  Encryption:             │
   │  • email → AES-256       │
   │  • messages → encrypted  │
   │  • passwords → bcrypt    │
   └──────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
 LAYER 7 — INFRASTRUCTURE
═══════════════════════════════════════════════════════════════════════════

   ┌─────────────────────────────────────────────────────────────────┐
   │   Docker Compose (single VPS, early stage)                     │
   │                                                                 │
   │   container: nginx         → Layer 2                           │
   │   container: nextjs        → Layer 3 (frontend)                │
   │   container: api           → Layer 3 (backend)                 │
   │   container: workers       → Layer 4                           │
   │   container: redis         → Layer 5                           │
   │   container: postgres      → Layer 6                           │
   │   container: minio         → Layer 6 (object storage)         │
   │                                                                 │
   │   volumes: postgres-data, redis-data, minio-data               │
   │   network: internal bridge (only nginx exposed externally)     │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │   Host OS — Linux (Debian/Ubuntu LTS)                          │
   │   VPS Provider: FlokiNET / 1984 Hosting / Njalla               │
   │   Automated encrypted backups → offsite object storage         │
   │   Tor hidden service: torrc + nginx .onion configuration       │
   └─────────────────────────────────────────────────────────────────┘
```

---

## Service Descriptions

### Layer 0 — Client (Browser)

The user's browser. Bartr is a standard web application — no native app, no Electron. Users access it through any modern browser or through Tor Browser for privacy. The frontend is server-rendered on first load (SEO, fast paint), then hydrates into a React SPA for navigation.

### Layer 1 — Edge / DNS

**Cloudflare (DNS-only mode)** — Resolves the domain to the VPS IP. We use DNS-only mode (orange cloud off) so Cloudflare doesn't see plaintext traffic. DDoS protection comes from Cloudflare's anycast network even in DNS-only mode. No analytics, no logging enabled on Cloudflare. If we move to a Tor-only deployment, this layer is removed entirely.

### Layer 2 — Nginx (Reverse Proxy)

**What it does:** Nginx is the only container with an external network interface. Everything hits Nginx first.

**Responsibilities:**
- **TLS termination** — Handles HTTPS via Let's Encrypt certificates (Certbot auto-renewal). All internal traffic between containers is unencrypted HTTP (acceptable because it's on a Docker bridge network on a single host).
- **Request routing** — Routes `/api/*` to the Fastify API server on port 4000. Routes everything else to the Next.js server on port 3000. WebSocket upgrade requests are proxied to the appropriate backend.
- **Rate limiting** — In-memory rate limiting using `limit_req_zone`. Limits per-IP request rates to prevent abuse. No IPs are logged to disk — counters exist only in Nginx's shared memory and are lost on restart.
- **Security headers** — Injects HSTS, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy on every response.
- **Static assets** — Serves pre-built JS/CSS bundles directly from disk without hitting Node.js.

**Why Nginx and not Caddy/Traefik:** Nginx is battle-tested, has the lowest memory footprint (~2MB idle), and its rate limiting module is mature. For a single-VPS deployment, the auto-TLS of Caddy isn't worth the trade-off.

### Layer 3 — Application Services

#### Next.js (Frontend Server)

**What it does:** Serves the Bartr web UI. Runs on port 3000 inside Docker.

**Responsibilities:**
- **Server-side rendering (SSR)** — Listing pages, user profiles, and the homepage are rendered on the server so they load fast and are indexable by search engines.
- **Client-side navigation** — After the first page load, React takes over. Page transitions happen in the browser without full reloads.
- **Static assets** — Tailwind CSS, JavaScript bundles, and fonts are compiled at build time.
- **API communication** — The frontend calls the API through the Nginx proxy (`/api/*`). In SSR context, it calls the API container directly over the Docker network for speed.

**Why Next.js:** SSR is critical for marketplace SEO (listing pages need to be crawlable). Next.js handles SSR, routing, code splitting, and image optimization out of the box.

#### API Server (Fastify)

**What it does:** The core backend. Handles all business logic, data access, and authentication. Runs on port 4000 inside Docker.

**Responsibilities:**
- **Auth Service** — Google OAuth 2.0 flow (redirect → callback → token exchange). Issues JWT access tokens (15min TTL) and refresh tokens (7 day TTL) with rotation. Validates JWTs on protected routes via the `authenticate` preHandler.
- **Listing Service** — CRUD operations for listings. PostgreSQL full-text search using `tsvector`. Category filtering, pagination, payment method tags. Image upload to MinIO (up to 5 per listing).
- **Trade Service** — Manages the trade state machine: `offered → accepted → completed` or `offered → declined/cancelled`. Both parties must confirm completion. Creates trade events for audit logging.
- **Reputation Service** — Accepts ratings after completed trades. Enforces anti-manipulation rules (30-day cooldown per user pair, both parties must confirm). Reads computed reputation scores from the `reputation_scores` table (computed by workers).
- **Messaging Service** — Thread-based DMs between trade participants. Messages stored encrypted in PostgreSQL. Listing-scoped threads (each conversation is tied to a specific listing).
- **Moderation Service** — Accepts user-submitted flags on listings, users, and messages. Keyword filtering on listing creation. Admin review endpoints.
- **User Profile Service** — Public profiles with reputation data. Profile updates (nickname, bio). Avatar upload/serving via MinIO.

**Why Fastify:** Fastest Node.js HTTP framework (2x-3x Express throughput). Plugin system keeps the codebase modular. Built-in schema validation. TypeScript-first.

### Layer 4 — Background Workers

**What it does:** Processes asynchronous jobs that shouldn't block API responses. Runs as a separate container.

**Responsibilities:**
- **Image Processor** — When a user uploads an image (listing photo or avatar), the worker strips EXIF metadata (GPS coordinates, camera info, timestamps), resizes to standard dimensions, converts to WebP format, and uploads the processed version to MinIO. The original is deleted.
- **Score Recompute Worker** — Runs on a schedule (every 15 minutes). Recalculates composite reputation scores for all users who had trades complete since the last run. Applies the weighted formula: `RatingAvg(40%) + CompletionRate(25%) + ResponseScore(15%) + Tenure(10%) + Volume(10%) - DisputePenalty(20%)`. Assigns tiers based on completed trade count.
- **Email Worker** — (Future) Sends notification emails for trade offers, ratings received, and account alerts. Uses a privacy-respecting email provider. Emails are opt-in only.

**Why a separate container:** Long-running tasks like image processing (EXIF stripping, resizing, format conversion) would block the API event loop. Running workers in a separate process means a slow image resize doesn't increase API latency.

### Layer 5 — Redis

**What it does:** In-memory data store used for caching, queueing, and real-time messaging. Runs on port 6379 inside Docker.

**Responsibilities:**
- **Session/token cache** — Refresh token hashes are stored in PostgreSQL, but hot lookups can be cached in Redis for speed.
- **Rate limit counters** — Per-user and per-IP counters with TTL for API rate limiting (in addition to Nginx's layer).
- **Job queue** — Workers pull jobs from Redis Streams or BullMQ queues. Jobs include image processing, score recomputation triggers, and email sends.
- **Pub/sub bus** — When a trade offer arrives or a new message is sent, the API publishes an event to a Redis channel. The WebSocket server subscribes and pushes it to the connected client in real-time.
- **Listing view counters** — Short-lived counters that track listing views. Flushed to PostgreSQL periodically to avoid write amplification.

**Why Redis:** Sub-millisecond reads, built-in TTL, pub/sub, and streams. It's the standard tool for all five of these use cases. Memory usage is minimal for our scale (~50MB for 10K concurrent users).

### Layer 6 — Persistence

#### PostgreSQL

**What it does:** Primary data store. All structured data lives here. Runs PostgreSQL 16 on port 5432 inside Docker.

**Tables (13):**
| Table | Purpose |
|-------|---------|
| `users` | User accounts (google_id, nickname, password_hash, bio, avatar_key) |
| `refresh_tokens` | JWT refresh tokens with hashes and expiry |
| `categories` | Listing categories with self-referencing parent_id for subcategories |
| `listings` | Marketplace listings (title, description, payment methods, price, status) |
| `listing_images` | Image references for listings (storage_key pointing to MinIO) |
| `trades` | Trade records between buyers and sellers with status machine |
| `trade_events` | Audit log of trade state transitions |
| `ratings` | Post-trade ratings (1-5 score + optional comment) |
| `reputation_scores` | Materialized reputation data (computed by workers, read by API) |
| `message_threads` | Conversation containers between two users about a listing |
| `messages` | Individual messages (body stored as encrypted bytea) |
| `moderation_flags` | User-submitted reports on listings, users, or messages |

**Key design choices:**
- UUIDs as primary keys (no sequential IDs that leak information)
- Encrypted email (AES-256) and encrypted message bodies (bytea)
- JSONB for flexible payment method lists
- Full-text search via `tsvector` indexes (no external search engine needed)
- Check constraints enforce valid statuses at the database level

**Why PostgreSQL:** Most feature-rich open-source relational DB. Full-text search eliminates the need for Elasticsearch. JSONB handles semi-structured data. Battle-tested at any scale we'll reach.

#### MinIO (Object Storage)

**What it does:** S3-compatible object storage for binary files. Runs on port 9000 inside Docker.

**Buckets:**
- `listing-images/` — Listing photos (WebP, EXIF-stripped, resized)
- `avatars/` — User profile pictures
- `db-backups/` — (Future) Encrypted PostgreSQL dump files

**How images are served:** The API acts as a proxy — it fetches from MinIO and streams to the client. MinIO is never directly exposed to the internet. This lets us enforce auth checks and add cache headers.

**Why MinIO:** S3-compatible API means we can swap to Backblaze B2 or any S3 provider later without code changes. Self-hosted means no third-party sees our data. Runs well on a single node.

### Layer 7 — Infrastructure

**Docker Compose** orchestrates all 7 containers on a single VPS. All containers share an internal Docker bridge network. Only Nginx's port 80/443 is mapped to the host network.

**Host requirements:** Linux VPS (Debian or Ubuntu LTS). Privacy-friendly provider (FlokiNET in Iceland, 1984 Hosting in Iceland, or Njalla in Sweden). Automated encrypted backups to offsite storage. Tor hidden service configured via `torrc` + Nginx `.onion` vhost.

---

## Request / Response Flow (Annotated Path)

```
  [Browser]
      │
      │  1. GET /listings?category=electronics
      │
  [Cloudflare DNS]
      │
      │  2. Resolves to VPS IP, proxies request
      │
  [Nginx]
      │
      │  3. TLS handshake, rate-limit check, route to Next.js
      │
  [Next.js Server]
      │
      │  4. SSR: fetches listing data from API internally
      │
  [API Server]
      │
      │  5. Checks JWT from cookie (Auth Service)
      │  6. Queries PostgreSQL full-text search (Listing Service)
      │  7. Fetches reputation tiers for result users (Reputation Service)
      │
  [PostgreSQL]
      │
      │  8. Returns rows: listings + seller scores
      │
  [API Server → Next.js → Nginx → Browser]
      │
      │  9. Rendered HTML returned to browser
      │
  [Browser]
      │
      │  10. WebSocket connection opened in background
      │
  [WebSocket Server ← Redis pub/sub]
      │
      │  11. Any real-time events (new offer, new message)
      │      pushed to browser without polling
```

---

## Data Isolation (Security Boundary Map)

```
  PUBLIC INTERNET
  ─────────────────────────────────────────────────────────
  Cloudflare → Nginx (port 443 only exposed)
  ─────────────────────────────────────────────────────────
  INTERNAL DOCKER NETWORK (no external access)
  │
  ├── Next.js        (talks to: API)
  ├── API Server     (talks to: PostgreSQL, Redis, MinIO)
  ├── Workers        (talks to: Redis queue, PostgreSQL, MinIO)
  ├── Redis          (talks to: nothing external)
  ├── PostgreSQL     (talks to: nothing external)
  └── MinIO          (talks to: nothing external)
  ─────────────────────────────────────────────────────────
  Only Nginx has an external network interface.
  All other containers are unreachable from outside the host.
```
