# Bartr — Launch Roadmap v3

> Last updated: 2026-03-01

---

## What Changed from V2

V2 was written before E2E encryption and auth pages existed. Everything in Phases 4.5 and 6 is now complete. This document reflects the current state and charts the remaining path to a minimum usable product.

---

## Current State

### Backend (packages/api) — Complete
- Fastify 5, PostgreSQL, Redis, MinIO
- Auth: email/password only (Google OAuth removed), argon2id, JWT (15m access / 7d refresh, rotation)
- Email field: AES-256-GCM encrypted at rest
- Messages: server-blind — stores and returns base64 ciphertext only, never decrypts
- E2E key storage: `public_key`, `private_key_blob`, `recovery_key_blob` on `users` table
- All endpoints: listings, trades, ratings, users, messages, moderation, exchange offers, prices
- **192 tests** (28 unit + 164 integration requiring Docker)

### Frontend (packages/web) — Full feature set
- Next.js 14 App Router, Tailwind, shadcn/ui, React Query, React Hook Form + Zod
- Full provider stack: ThemeProvider → QueryProvider → AuthProvider → CryptoProvider → GlobalAuthGuard
- All domain API modules and React Query hooks
- E2E crypto library: X25519 keypair generation, PBKDF2 key wrapping, recovery key, ECDH message encrypt/decrypt
- CryptoProvider: in-memory private key, register/unlock/encrypt/decrypt/lock
- Auth pages: `/login`, `/register`, `/register/email`, `/auth/callback`, `/auth/unlock`, `/auth/recover`
- P2P Exchange: `/exchange`, `/exchange/new`, `/exchange/[id]` with live price feed
- Marketplace: `/market` (browse), `/listings/[id]` (detail), `/market/new` (create), `/listings/[id]/edit`
- Dashboard: `/dashboard/listings`, `/dashboard/trades`, `/dashboard/offers`
- Messages: `/messages`, `/messages/[threadId]` (E2E encrypted)
- User pages: `/user/[nickname]`, `/settings/profile`
- Static: `/`, `/about`, `/privacy`, `/donate` (with `react-qr-code` scannable QR)
- Components: `ListingCard`, `ReputationBadge`, `PaymentIcon` (SVG crypto logos), `CoinIcon`, `PriceTicker`, `OfferRow`
- Professional SVG icons for all crypto (BTC, ETH, USDT, USDC, SOL, etc.) and payment methods
- Password strength meter with live validation on registration
- 5-minute AFK auto-logout, login cooldown persisted in sessionStorage
- **479 tests passing**

### Workers (packages/workers) — Complete
- Price feed worker: polls CoinGecko/Binance/Kraken every 60s, caches in Redis
- Supports 18 cryptocurrencies and 46 fiat currencies

---

## ✅ Completed Phases

| Phase | Description | Tests |
|---|---|---|
| Backend (all) | Full API, auth, listings, trades, messages, moderation, ratings, exchange, prices | 134 |
| 4.5 — E2E Encryption | DB migration, backend blind messages, frontend crypto lib, CryptoProvider, wired hooks | — |
| 5 — Frontend Foundation | deps, design tokens, UI components, API client, AuthProvider, React Query, app shell | — |
| 6 — Auth Pages | /login, /register, /register/email, /auth/callback, /auth/unlock, /auth/recover | — |
| 7 — Listings | GlobalAuthGuard, browse, detail, create, edit, dashboard, search/filter, images | — |
| 8 — User Profiles | /user/[nickname], /settings/profile, reputation components | — |
| 9 — Trade Flow | /dashboard/trades, /trades/[id], make offer, status transitions | — |
| 10 — Messaging UI | /messages inbox, /messages/[threadId], E2E encrypted, CryptoGuard | — |
| 11 — Key Unlock Flow | /auth/unlock, /auth/recover, auto-prompt via CryptoGuard | — |
| 12 — Static & Polish | Landing page, /about, /privacy, /donate (scannable QR via react-qr-code), error pages | — |
| 13.1 — Admin role | user_role ENUM, role in JWT, requireAdmin hook, /admin/* gated | — |
| 13.2 — Content security | EXIF stripping (sharp), magic bytes validation | — |
| 13.5 — Remove Google OAuth | Removed Google routes, env vars, frontend buttons — email-only auth | — |
| 13.7 — Registration UX | Password strength bar, English-only + complexity validation, live match indicator | — |
| P2P Exchange | /exchange browse, /exchange/new, /exchange/[id], exchange API, price feed worker, dashboard/offers | — |
| Route split | /market (marketplace), /exchange (P2P crypto), navbar restructure, SVG crypto icons | — |
| 13.8 — MinIO integration tests | Image upload/delete: JPEG/PNG/WebP, reject invalid, max 5, avatar replace | — |
| 13.9 — E2E API integration tests | Full flows: auth, listings CRUD, messaging, trades, profiles, edge cases | — |
| 13.6 — Email verification (backend) | Resend plugin, verify/resend endpoints, route gating, 12 tests | 12 |
| **Total** | | **671** |

---

## Remaining Phases

---

## Phase 13.3 — Production secrets audit
- [ ] JWT_SECRET: real random 256-bit secret
- [ ] ENCRYPTION_KEY: real 32-byte hex key
- [ ] DB/Redis/MinIO: strong passwords, not dev defaults

## Phase 13.4 — HTTPS / TLS
- [ ] Point domain to VPS
- [ ] Install Nginx as reverse proxy
- [ ] Let's Encrypt certificate via Certbot (free, auto-renewing)
- [ ] Redirect all HTTP → HTTPS
- [ ] Update `GOOGLE_REDIRECT_URI`, `CLIENT_URL` env vars to https://

---


## Phase 13.6 — Email Verification (Resend)

Using **Resend** API (free tier: 3,000/month) instead of self-hosted mail.
Plugin auto-mocks when `RESEND_API_KEY` is empty (dev/test).

### Backend ✅
- [x] Add `email_verified boolean DEFAULT false` column to `users` table
- [x] Add `email_verification_codes` table: `(id, user_id, code_hash, expires_at)`
- [x] On `POST /auth/register/email`: generate 6-digit code, store it, send verification email
- [x] Add `POST /auth/verify-email` endpoint: validate code, set `email_verified = true`
- [x] Add `POST /auth/resend-verification` endpoint (rate-limited)
- [x] Gate posting listings + sending messages behind `email_verified = true`
- [x] Resend plugin with auto-mock for dev/test, real Resend SDK when API key set
- [x] `GET /health/resend` uses plugin for quota
- [x] 12 new tests covering verify/reject/expire/gate flows

### Frontend
- [x] `verifyEmail()` and `resendVerification()` API functions
- [x] `email_verified` added to `CurrentUser` type
- [ ] `/auth/verify-email` page: code input, submit, resend link
- [ ] Redirect unverified users to `/auth/verify-email` when they try to post or message

---

## Phase 13.8 — MinIO Integration Tests

Image upload/delete flows were never covered by automated tests because MinIO requires a running container. Add proper integration tests using a MinIO test instance (spin up via Docker Compose test profile or `minio/minio` in CI).

- [x] Test `POST /listings/:id/images` — upload JPEG, PNG, WebP successfully
- [x] Test upload rejects non-image files (garbage bytes)
- [x] Test upload rejects oversized files (>5 MB)
- [x] Test `DELETE /listings/:id/images/:imageId` — removes from MinIO and DB
- [x] Test that replacing an image (delete + upload) works end-to-end
- [x] Test that listing detail returns correct `storage_key` after upload
- [x] Add MinIO service to `docker-compose.test.yml` so CI can run these tests

---

## Phase 13.9 — End-to-End API Integration Tests

Automated integration tests that hit the real running API server with real HTTP requests against a real database. No mocks — tests create actual users, authenticate, and exercise full user flows. Run against the Docker Compose dev stack.

### Setup
- [x] Test runner script that checks API is reachable before running
- [x] Test helper: register a user (email + password) → returns tokens + nickname
- [x] Test helper: login as existing user → returns tokens
- [x] Test helper: authenticated fetch wrapper (injects Bearer token)
- [x] Seed/teardown: tests create dedicated test users (idempotent — skip if already exist)

### Auth flows
- [x] Register two test users via `POST /auth/register/email`
- [x] Login with correct password → 200 + tokens
- [x] Login with wrong password → 401
- [x] Refresh token → new token pair
- [x] Access protected endpoint without token → 401
- [x] Fetch `/auth/me` → returns correct user

### Listings
- [x] Create a listing (User A) → 201 + listing object
- [x] Get listing by ID → matches created data
- [x] List all listings → contains the created listing
- [x] Update listing (User A) → 200 + updated fields
- [x] Reject update from non-owner (User B) → 403
- [x] Delete listing (User A) → 204
- [x] Confirm deleted listing is gone → 404

### Messaging (two-user flow)
- [x] User A creates a listing
- [x] User B creates a thread with User A (via listing) → thread ID
- [x] User B sends an encrypted message in the thread → 201
- [x] User A fetches thread messages → sees the message
- [x] User A replies → 201
- [x] User B fetches messages → sees both messages
- [x] Both users see the thread in their `/threads` list

### Trades
- [x] User B initiates a trade on User A's listing
- [x] User A accepts the trade
- [x] Both users can view trade details
- [x] Trade status transitions work correctly

### User profiles
- [x] Fetch user profile by nickname → 200
- [x] Update own profile (bio) → 200
- [x] Fetch other user's public key → 200

### Edge cases
- [x] Cannot message yourself
- [x] Cannot create duplicate thread for same listing+users
- [x] Rate limiting on login (brute-force protection)
- [x] Expired/invalid tokens are rejected

---

## Phase 13.10 — Database Migration Runner

Currently migrations only run via PostgreSQL's `docker-entrypoint-initdb.d` on first DB init. New migrations never apply to an existing database — you'd have to wipe data to get schema changes. This is a production blocker.

### Migration runner (API startup)
- [ ] Create `schema_migrations` table: `(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`
- [ ] On API boot (after DB connect, before listening): read `db/migrations/*.sql` in order, skip already-applied, execute new ones in a transaction, record in `schema_migrations`
- [ ] Log applied migrations on startup (e.g. "Applied 010_listing_country.sql", or "All 12 migrations already applied")

### Make existing migrations idempotent
- [ ] Audit all 001–012 migrations for re-run safety (`IF NOT EXISTS`, `DO $$ ... END $$` guards)
- [ ] Fix 007 (DROP NOT NULL), 008 (CREATE TYPE), 010 (ADD COLUMN + DELETE) to be idempotent

### Safety
- [ ] Remove `./db/migrations:/docker-entrypoint-initdb.d:ro` mount from both docker-compose files (migration runner replaces it)
- [ ] Document in README: never use `docker compose down -v` unless you want to lose all data

---

## Phase 14 — Launch Checklist

- [ ] Responsive design pass (mobile / tablet / desktop)
- [ ] Loading skeletons and error boundaries on all data-fetching pages
- [x] Toast notifications (success/error feedback)
- [x] 404 and 500 error pages
- [ ] Accessibility: semantic HTML, ARIA labels, keyboard navigation, WCAG AA contrast
- [ ] SEO: dynamic page titles, OG tags, sitemap.xml
- [ ] Performance: Next.js `<Image>`, lazy loading, bundle analysis
- [x] ~~Captcha on registration~~ — **Removed**: rate limiting (10 req/min) is sufficient; no captcha needed
- [ ] DB backup strategy configured
- [ ] Uptime monitoring configured
- [ ] Manual smoke test: register → browse → list → message → trade → rate

---

## Critical Path to MVP

```
All core features are implemented.
Remaining work is security hardening, testing, and production deployment.

Priority order:
1. Phase 13.6 — Email verification frontend (verify page + redirect)
2. Phase 13.10 — DB Migration Runner (critical for production)
3. Phase 13.3 — Production secrets
4. Phase 13.4 — HTTPS / TLS
5. Phase 14 — Launch checklist
```

---

## Test Count Summary

| Package | Tests |
|---|---|
| packages/api | 192 |
| packages/web | 479 |
| **Total** | **671** |

---

## Remaining Phase Summary

| Phase | Priority | Rough Size |
|---|---|---|
| 13.3 — Production secrets | 🔴 critical | ~3 tasks |
| 13.4 — HTTPS / TLS | 🔴 critical | ~5 tasks |
| 13.6 — Email verification frontend | 🟠 high | ~2 tasks (backend done) |
| 13.10 — DB migration runner | 🔴 critical | ~5 tasks |
| 14 — Launch checklist | 🟡 medium | ~10 tasks |
