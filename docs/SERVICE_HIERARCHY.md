# Service Hierarchy — Crypto/Barter Marketplace

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
        │   API Server  (Fastify / Go)                             │
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
   │  • sessions              │        │  • listing-images/          │
   │  • listings              │        │  • avatars/                 │
   │  • listing_images        │        │  • db-backups/              │
   │  • categories            │        │                             │
   │  • trades                │        │  All images:                │
   │  • trade_events          │        │  • EXIF stripped            │
   │  • messages              │        │  • Converted to WebP        │
   │  • ratings               │        │  • Served via Nginx         │
   │  • reputation_scores     │        │    (no direct public URL)   │
   │  • moderation_flags      │        └─────────────────────────────┘
   │  • categories            │
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
   │   container: ws-server     → Layer 3 (websocket)               │
   │   container: workers       → Layer 4                           │
   │   container: redis         → Layer 5                           │
   │   container: postgres      → Layer 6                           │
   │   container: minio         → Layer 6 (optional, or B2)        │
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
  ├── WS Server      (talks to: Redis pub/sub)
  ├── Workers        (talks to: Redis queue, PostgreSQL, MinIO)
  ├── Redis          (talks to: nothing external)
  ├── PostgreSQL     (talks to: nothing external)
  └── MinIO          (talks to: nothing external)
  ─────────────────────────────────────────────────────────
  Only Nginx has an external network interface.
  All other containers are unreachable from outside the host.
```
