# Bartr — Launch Roadmap v3

> Last updated: 2026-03-02

---

## What Changed from V2

V2 was written before E2E encryption and auth pages existed. V3 reflects current state after all core features, email verification, migration runner, and Docker consolidation are complete.

---

## Current State

### Backend (packages/api) — Complete
- Fastify 5, PostgreSQL, Redis, MinIO
- Auth: email/password only (Google OAuth removed), argon2id, JWT (15m access / 7d refresh, rotation)
- Email field: AES-256-GCM encrypted at rest
- Email verification: conditional on `BREVO_API_KEY` — auto-verifies in dev, 6-digit OTP in prod
- Messages: server-blind — stores and returns base64 ciphertext only, never decrypts
- E2E key storage: `public_key`, `private_key_blob`, `recovery_key_blob` on `users` table
- All endpoints: listings, trades, ratings, users, messages, moderation, exchange offers, prices
- Migration runner: runs on API boot, `schema_migrations` tracking table, 14 idempotent migrations
- Unverified user cleanup: auto-deletes after 5 minutes (when Brevo enabled)
- **192 tests** (28 unit + 164 integration requiring Docker)

### Frontend (packages/web) — Full feature set
- Next.js 14 App Router, Tailwind, shadcn/ui, React Query, React Hook Form + Zod
- Full provider stack: ThemeProvider → QueryProvider → AuthProvider → CryptoProvider → GlobalAuthGuard
- All domain API modules and React Query hooks
- E2E crypto library: X25519 keypair generation, PBKDF2 key wrapping, recovery key, ECDH message encrypt/decrypt
- CryptoProvider: in-memory private key, register/unlock/encrypt/decrypt/lock
- Auth pages: `/login`, `/register`, `/register/email`, `/auth/callback`, `/auth/unlock`, `/auth/recover`, `/auth/verify-email`
- Email verification: 6-digit OTP input, countdown timer, resend with cooldown (Brevo transactional API)
- GlobalAuthGuard: hard-gates unverified users to `/auth/verify-email` (when `email_verification_required`)
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
- **526 tests passing**

### Workers (packages/workers) — Complete
- Price feed worker: polls CoinGecko/Binance/Kraken every 60s, caches in Redis
- Supports 18 cryptocurrencies and 46 fiat currencies

### Infrastructure — Complete
- Docker Compose: 2 files — `docker-compose.yml` (dev default) + `docker-compose.prod.yml` (prod overrides)
- Dev: all 7 services with hot reload, all ports exposed
- Prod: app services built from Dockerfiles, only nginx exposed
- `scripts/test.sh`: self-contained test runner (starts infra if needed)

---

## ✅ Completed Phases

| Phase | Description |
|---|---|
| Backend (all) | Full API, auth, listings, trades, messages, moderation, ratings, exchange, prices |
| 4.5 — E2E Encryption | DB migration, backend blind messages, frontend crypto lib, CryptoProvider, wired hooks |
| 5 — Frontend Foundation | deps, design tokens, UI components, API client, AuthProvider, React Query, app shell |
| 6 — Auth Pages | /login, /register, /register/email, /auth/callback, /auth/unlock, /auth/recover |
| 7 — Listings | GlobalAuthGuard, browse, detail, create, edit, dashboard, search/filter, images |
| 8 — User Profiles | /user/[nickname], /settings/profile, reputation components |
| 9 — Trade Flow | /dashboard/trades, /trades/[id], make offer, status transitions |
| 10 — Messaging UI | /messages inbox, /messages/[threadId], E2E encrypted, CryptoGuard |
| 11 — Key Unlock Flow | /auth/unlock, /auth/recover, auto-prompt via CryptoGuard |
| 12 — Static & Polish | Landing page, /about, /privacy, /donate (scannable QR), error pages, toast system |
| 13.1 — Admin role | user_role ENUM, role in JWT, requireAdmin hook, /admin/* gated |
| 13.2 — Content security | EXIF stripping (sharp), magic bytes validation |
| 13.5 — Remove Google OAuth | Removed Google routes, env vars, frontend buttons — email-only auth |
| 13.6 — Email verification | Full stack: Brevo transactional API, 6-digit OTP, verify/resend endpoints, /auth/verify-email page, GlobalAuthGuard hard-gate, unverified user auto-cleanup, conditional on BREVO_API_KEY |
| 13.7 — Registration UX | Password strength bar, English-only + complexity validation, live match indicator |
| 13.8 — MinIO integration tests | Image upload/delete: JPEG/PNG/WebP, reject invalid, max 5, avatar replace |
| 13.9 — E2E API integration tests | Full flows: auth, listings CRUD, messaging, trades, profiles, edge cases |
| 13.10 — DB migration runner | schema_migrations table, programmatic runner on API boot, 14 idempotent migrations, initdb.d mount removed |
| P2P Exchange | /exchange browse, /exchange/new, /exchange/[id], exchange API, price feed worker, dashboard/offers |
| Route split | /market (marketplace), /exchange (P2P crypto), navbar restructure, SVG crypto icons |
| Docker consolidation | 3 compose files → 2 (dev default + prod overrides), test.sh uses dev stack |

---

## Remaining Phases

---

## Phase 13.3 — Production secrets audit
- [ ] JWT_SECRET: real random 256-bit secret
- [ ] ENCRYPTION_KEY: real 32-byte hex key
- [ ] DB/Redis/MinIO: strong passwords, not dev defaults
- [ ] BREVO_API_KEY: real Brevo key (enables email verification)

## Phase 13.4 — HTTPS / TLS
- [ ] Point domain to VPS
- [ ] Nginx TLS config (already running as reverse proxy)
- [ ] Let's Encrypt certificate via Certbot (free, auto-renewing)
- [ ] Redirect all HTTP → HTTPS
- [ ] Update `CLIENT_URL` env var to https://

---

## Phase 14 — Launch Checklist

- [ ] Responsive design pass (mobile / tablet / desktop)
- [ ] Loading skeletons and error boundaries on all data-fetching pages
- [x] Toast notifications (success/error feedback)
- [x] 404 and 500 error pages
- [ ] Accessibility: semantic HTML, ARIA labels, keyboard navigation, WCAG AA contrast
- [ ] SEO: dynamic page titles, OG tags, sitemap.xml
- [ ] Performance: Next.js `<Image>`, lazy loading, bundle analysis
- [x] ~~Captcha on registration~~ — rate limiting (10 req/min) is sufficient
- [ ] DB backup strategy configured
- [ ] Uptime monitoring configured
- [ ] Manual smoke test: register → browse → list → message → trade → rate

---

## Critical Path to MVP

```
All core features are implemented.
Remaining work is production deployment prep.

Priority order:
1. Phase 13.3 — Production secrets (generate real secrets, set BREVO_API_KEY)
2. Phase 13.4 — HTTPS / TLS (domain + Certbot)
3. Phase 14   — Launch checklist (responsive, a11y, SEO, backups)
```

---

## Test Count Summary

| Package | Tests |
|---|---|
| packages/api | 192 |
| packages/web | 526 |
| **Total** | **718** |

---

## Remaining Phase Summary

| Phase | Priority | Rough Size |
|---|---|---|
| 13.3 — Production secrets | 🔴 critical | ~4 tasks |
| 13.4 — HTTPS / TLS | 🔴 critical | ~5 tasks |
| 14 — Launch checklist | 🟡 medium | ~8 tasks |
