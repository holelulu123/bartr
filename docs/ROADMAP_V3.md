# Bartr — Launch Roadmap v3

> Last updated: 2026-02-28

---

## What Changed from V2

V2 was written before E2E encryption and auth pages existed. Everything in Phases 4.5 and 6 is now complete. This document reflects the current state and charts the remaining path to a minimum usable product.

---

## Current State

### Backend (packages/api) — Complete
- Fastify 5, PostgreSQL, Redis, MinIO
- Auth: Google OAuth + email/password, argon2id, JWT (15m access / 7d refresh, rotation)
- Email field: AES-256-GCM encrypted at rest
- Messages: server-blind — stores and returns base64 ciphertext only, never decrypts
- E2E key storage: `public_key`, `private_key_blob`, `recovery_key_blob` on `users` table
- All endpoints: listings, trades, ratings, users, messages, moderation, exchange offers, prices
- **134 tests passing**

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
- **474 tests passing**

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
| 13.7 — Registration UX | Password strength bar, English-only + complexity validation, live match indicator | — |
| P2P Exchange | /exchange browse, /exchange/new, /exchange/[id], exchange API, price feed worker, dashboard/offers | — |
| Route split | /market (marketplace), /exchange (P2P crypto), navbar restructure, SVG crypto icons | — |
| **Total** | | **608** |

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

## Phase 13.5 — Remove Google OAuth

Google OAuth contradicts the privacy-first ethos and requires a third-party dependency.
The email/password auth system is already fully built in the API (`/auth/register/email`, `/auth/login/email`).

- [ ] Remove `GET /auth/google` and `GET /auth/google/callback` routes from the API
- [ ] Remove `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` from env config
- [ ] Remove Google OAuth button from `/login` page
- [ ] Update `/register` page to use email/password flow only
- [ ] Remove `google_id` references from frontend
- [ ] Update `13.3` secrets audit — remove Google OAuth credentials item

---

## Phase 13.6 — Email Verification + Self-Hosted Mail

Self-hosted email via **Mailcow** or **Postal** on the same VPS.
Emails may land in spam on new IPs — add a visible notice to users on registration.

### Backend
- [ ] Add `email_verified boolean DEFAULT false` column to `users` table
- [ ] Add `email_verification_tokens` table: `(id, user_id, code, expires_at, used)`
- [ ] On `POST /auth/register/email`: generate 6-digit code, store it, send verification email
- [ ] Add `POST /auth/verify-email` endpoint: validate code, set `email_verified = true`
- [ ] Add `POST /auth/resend-verification` endpoint (rate-limited)
- [ ] Gate posting listings + sending messages behind `email_verified = true`

### Email service
- [ ] Deploy Mailcow (or Postal) on VPS via Docker Compose
- [ ] Configure DNS: SPF, DKIM, DMARC, PTR/rDNS records
- [ ] Add `nodemailer` (or Mailcow API) to API for sending transactional email
- [ ] Verification email template: subject, 6-digit code, expiry notice
- [ ] Add "email may go to spam" notice on the registration page

### Frontend
- [ ] `/auth/verify-email` page: code input, submit, resend link
- [ ] Redirect unverified users to `/auth/verify-email` when they try to post or message

---

## Phase 13.8 — MinIO Integration Tests

Image upload/delete flows were never covered by automated tests because MinIO requires a running container. Add proper integration tests using a MinIO test instance (spin up via Docker Compose test profile or `minio/minio` in CI).

- [ ] Test `POST /listings/:id/images` — upload JPEG, PNG, WebP successfully
- [ ] Test upload rejects non-image files (garbage bytes)
- [ ] Test upload rejects oversized files (>5 MB)
- [ ] Test `DELETE /listings/:id/images/:imageId` — removes from MinIO and DB
- [ ] Test that replacing an image (delete + upload) works end-to-end
- [ ] Test that listing detail returns correct `storage_key` after upload
- [ ] Add MinIO service to `docker-compose.test.yml` so CI can run these tests

---

## Phase 13.9 — End-to-End API Integration Tests

Automated integration tests that hit the real running API server with real HTTP requests against a real database. No mocks — tests create actual users, authenticate, and exercise full user flows. Run against the Docker Compose dev stack.

### Setup
- [ ] Test runner script that checks API is reachable before running
- [ ] Test helper: register a user (email + password) → returns tokens + nickname
- [ ] Test helper: login as existing user → returns tokens
- [ ] Test helper: authenticated fetch wrapper (injects Bearer token)
- [ ] Seed/teardown: tests create dedicated test users (idempotent — skip if already exist)

### Auth flows
- [ ] Register two test users via `POST /auth/register/email`
- [ ] Login with correct password → 200 + tokens
- [ ] Login with wrong password → 401
- [ ] Refresh token → new token pair
- [ ] Access protected endpoint without token → 401
- [ ] Fetch `/auth/me` → returns correct user

### Listings
- [ ] Create a listing (User A) → 201 + listing object
- [ ] Get listing by ID → matches created data
- [ ] List all listings → contains the created listing
- [ ] Update listing (User A) → 200 + updated fields
- [ ] Reject update from non-owner (User B) → 403
- [ ] Delete listing (User A) → 204
- [ ] Confirm deleted listing is gone → 404

### Messaging (two-user flow)
- [ ] User A creates a listing
- [ ] User B creates a thread with User A (via listing) → thread ID
- [ ] User B sends an encrypted message in the thread → 201
- [ ] User A fetches thread messages → sees the message
- [ ] User A replies → 201
- [ ] User B fetches messages → sees both messages
- [ ] Both users see the thread in their `/threads` list

### Trades
- [ ] User B initiates a trade on User A's listing
- [ ] User A accepts the trade
- [ ] Both users can view trade details
- [ ] Trade status transitions work correctly

### User profiles
- [ ] Fetch user profile by nickname → 200
- [ ] Update own profile (bio) → 200
- [ ] Fetch other user's public key → 200

### Edge cases
- [ ] Cannot message yourself
- [ ] Cannot create duplicate thread for same listing+users
- [ ] Rate limiting on login (brute-force protection)
- [ ] Expired/invalid tokens are rejected

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
- [ ] **Captcha on registration** — hCaptcha (privacy-friendly, no Google) on `/register/email` to prevent bot account creation. Backend validates the captcha token before creating the account.
- [ ] DB backup strategy configured
- [ ] Uptime monitoring configured
- [ ] Manual smoke test: register → browse → list → message → trade → rate

---

## Critical Path to MVP

```
All core features are implemented.
Remaining work is security hardening, testing, and production deployment.

Priority order:
1. Phase 13.10 — DB Migration Runner (critical for production)
2. Phase 13.3 — Production secrets
3. Phase 13.4 — HTTPS / TLS
4. Phase 13.5 — Remove Google OAuth
5. Phase 13.6 — Email verification
6. Phase 14 — Launch checklist
```

---

## Test Count Summary

| Package | Tests |
|---|---|
| packages/api | 134 |
| packages/web | 474 |
| **Total** | **608** |

---

## Remaining Phase Summary

| Phase | Priority | Rough Size |
|---|---|---|
| 13.3 — Production secrets | 🔴 critical | ~3 tasks |
| 13.4 — HTTPS / TLS | 🔴 critical | ~5 tasks |
| 13.5 — Remove Google OAuth | 🟠 high | ~6 tasks |
| 13.6 — Email verification + self-hosted mail | 🟠 high | ~15 tasks |
| 13.8 — MinIO integration tests | 🟡 medium | ~7 tasks |
| 13.9 — E2E API integration tests | 🟡 medium | ~25 tasks |
| 13.10 — DB migration runner | 🔴 critical | ~5 tasks |
| 14 — Launch checklist | 🟡 medium | ~10 tasks |
