# Bartr — Launch Roadmap v3

> Last updated: 2026-02-27

---

## What Changed from V2

V2 was written before E2E encryption and auth pages existed. Everything in Phases 4.5 and 6 is now complete. This document reflects the current state and charts the remaining path to a minimum usable product.

---

## Current State

### Backend (packages/api) — Complete
- Fastify 5, PostgreSQL, Redis, MinIO
- Auth: Google OAuth + nickname/password, argon2id, JWT (15m access / 7d refresh, rotation)
- Email field: AES-256-GCM encrypted at rest
- Messages: server-blind — stores and returns base64 ciphertext only, never decrypts
- E2E key storage: `public_key`, `private_key_blob`, `recovery_key_blob` on `users` table
- All endpoints: listings, trades, ratings, users, messages, moderation
- **107/107 tests passing**

### Frontend (packages/web) — Foundation + Auth + Listings (partial) complete
- Next.js 14 App Router, Tailwind, shadcn/ui, React Query, React Hook Form + Zod
- Full provider stack: ThemeProvider → QueryProvider → AuthProvider → CryptoProvider → GlobalAuthGuard
- All domain API modules and React Query hooks
- E2E crypto library: X25519 keypair generation, PBKDF2 key wrapping, recovery key, ECDH message encrypt/decrypt
- CryptoProvider: in-memory private key, register/unlock/encrypt/decrypt/lock
- Auth pages: `/login`, `/auth/callback`, `/register` (with recovery key screen)
- GlobalAuthGuard: site-wide auth enforcement, only `/donate` and `/auth/*` are public
- Listings UI: browse page (`/listings`), detail page (`/listings/[id]`), create listing (`/listings/new`)
- Components: `ListingCard`, `ListingCardSkeleton`, `ReputationBadge`
- **245/245 tests passing**

---

## ✅ Completed Phases

| Phase | Description | Tests |
|---|---|---|
| Backend (all) | Full API, auth, listings, trades, messages, moderation, ratings | 107 |
| 4.5 — E2E Encryption | DB migration, backend blind messages, frontend crypto lib, CryptoProvider, wired hooks | — |
| 5 — Frontend Foundation | deps, design tokens, UI components, API client, AuthProvider, React Query, app shell | 118 |
| 6 — Auth Pages | /login, /auth/callback, /register + recovery key screen | 134 total |
| 7.0–7.4 — Listings (partial) | GlobalAuthGuard, browse, detail, create listing pages, ListingCard, ReputationBadge | 245 total |

---

## 🟡 Phase 7 — Listings (in progress)

### 7.0 — Global auth guard
- [x] All routes require login except /donate and /auth/*
- [x] Spinner during auth initialisation, no flash of protected content

### 7.1 — Browse page (`/listings`)
- [x] `ListingCard` component: title, price, payment badges, seller, thumbnail, time-ago
- [x] `ReputationBadge` component: New / Verified / Trusted / Elite
- [x] Grid with "Load more" (`useInfiniteListings`)
- [x] Empty state

### 7.2 — Search & filter bar
- [x] Debounced full-text search input (synced to URL param `?q=`)
- [x] Category dropdown (`useCategories`)
- [x] Payment method filter (BTC, XMR, Cash, Bank)
- [x] URL-synced state (shareable links)
- [x] Active filter pills + Clear button

### 7.3 — Listing detail page (`/listings/[id]`)
- [x] Full info: title, description, price, payment methods, category
- [x] Image gallery with thumbnail strip
- [x] Seller sidebar: avatar initials, nickname link
- [x] Action buttons for visitor: "Message Seller", "Make Offer"
- [x] Action buttons for owner: "Edit", "Delete" (with confirm dialog)
- [x] Make Offer disabled for non-active listings

### 7.4 — Create listing (`/listings/new`) — protected
- [x] Form: title, description, category, payment methods, price
- [x] Image upload: drag-and-drop, up to 5, previews
- [x] Moderation pre-check on submit
- [x] Redirect to new listing on success

### 7.5 — Edit listing (`/listings/[id]/edit`) — owner only
- [ ] Pre-filled form
- [ ] Image management (add/remove, max 5)
- [ ] Status change: active / paused / sold

### 7.6 — My listings dashboard (`/dashboard/listings`)
- [ ] Protected — own listings only
- [ ] Status filter, quick actions (edit, delete, mark sold)

---

## Phase 8 — User Profiles

### 8.1 — Public profile (`/user/[nickname]`)
- [ ] Avatar, nickname, bio, member since
- [ ] Reputation: composite score bar, tier badge, trade count
- [ ] Recent ratings list
- [ ] Active listings by this user
- [ ] "Message" button

### 8.2 — Edit profile (`/settings/profile`)
- [ ] Nickname (with availability check), bio, avatar upload

### 8.3 — Shared reputation components
- [ ] `ReputationBadge` — New / Verified / Trusted / Elite
- [ ] `StarRating` — static display + interactive
- [ ] `RatingCard` — individual rating with score + comment

---

## Phase 9 — Trade Flow

### 9.1 — Make Offer
- [ ] "Make Offer" button → confirm dialog → `POST /trades`

### 9.2 — Trade detail page (`/trades/[id]`)
- [ ] Status header, listing summary, buyer + seller with reputation
- [ ] Action buttons by role + status (accept, decline, cancel, complete)
- [ ] Event timeline (audit log)

### 9.3 — My trades dashboard (`/dashboard/trades`)
- [ ] Tabs: Buying / Selling / All, filter by status

### 9.4 — Post-trade rating
- [ ] Rating prompt after completion: star selector + comment

---

## Phase 10 — Messaging UI

### 10.1 — Inbox (`/messages`)
- [ ] Thread list: avatar, nickname, last message preview (decrypted), timestamp
- [ ] Empty state

### 10.2 — Thread view (`/messages/[threadId]`)
- [ ] Message bubbles (own = right, other = left)
- [ ] Auto-scroll to bottom
- [ ] Message input: textarea + send (encrypts before sending)
- [ ] Load-older pagination on scroll up
- [ ] Lock icon — E2E encrypted indicator
- [ ] Password prompt if private key not in memory (`/auth/unlock`)

### 10.3 — Start conversation
- [ ] "Message Seller" / "Message User" → `POST /threads` → thread view

---

## Phase 11 — Key Unlock Flow (missing piece from Phase 6)

When a returning user logs in via OAuth, their private key is still wrapped in a blob.
They need to enter their password to unwrap it before they can read/send messages.

### 11.1 — `/auth/unlock` page
- [ ] Password input → `unlock(blob, password)` → loads key into `CryptoProvider`
- [ ] "Use recovery key instead" link
- [ ] On success → redirect to intended page

### 11.2 — `/auth/recover` page
- [ ] Recovery key hex input → `unlockWithRecovery(recoveryBlob, hex)`
- [ ] Re-wrap with new password option
- [ ] On success → home

### 11.3 — Auto-prompt when needed
- [ ] If user tries to open messages and `isUnlocked === false` → redirect to `/auth/unlock`

---

## Phase 12 — Static & Polish Pages

### 12.1 — Landing page redesign
- [ ] Hero: tagline, search bar, CTA buttons
- [ ] Recent listings grid preview
- [ ] "How it works" 3-step section
- [ ] Stats bar (listing count, trades completed)

### 12.2 — Supporting pages
- [ ] `/about` — project ethos, no-KYC philosophy, how it works
- [ ] `/privacy` — what data is stored, E2E encryption explanation
- [ ] `/donate` — set real BTC + Lightning addresses, replace SVG placeholder with `react-qr-code` for actual scannable QR codes

---

## Phase 13 — Security Gaps

### 13.1 — Admin role system
- [ ] Add `role` column to `users` (enum: `user`, `admin`)
- [ ] DB migration
- [ ] `requireAdmin` Fastify hook
- [ ] Gate `/admin/*` routes

### 13.2 — Content security
- [ ] EXIF stripping for uploaded images (`sharp`)
- [ ] Magic bytes image validation (not just extension)
- [ ] Rate limit flag submissions

### 13.3 — Production secrets audit
- [ ] JWT_SECRET: real random 256-bit secret
- [ ] ENCRYPTION_KEY: real 32-byte hex key
- [ ] DB/Redis/MinIO: strong passwords, not dev defaults

### 13.4 — HTTPS / TLS
- [ ] Point domain to Hetzner VPS
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

Self-hosted email via **Mailcow** or **Postal** on the same Hetzner VPS.
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

## Phase 14 — Launch Checklist

- [ ] Responsive design pass (mobile / tablet / desktop)
- [ ] Loading skeletons and error boundaries on all data-fetching pages
- [ ] Toast notifications (success/error feedback)
- [ ] 404 and 500 error pages
- [ ] Accessibility: semantic HTML, ARIA labels, keyboard navigation, WCAG AA contrast
- [ ] SEO: dynamic page titles, OG tags, sitemap.xml
- [ ] Performance: Next.js `<Image>`, lazy loading, bundle analysis
- [ ] **Captcha on registration** — hCaptcha (privacy-friendly, no Google) on `/register/email` and `/register` to prevent bot account creation. Backend validates the captcha token before creating the account.
- [ ] DB backup strategy configured
- [ ] Uptime monitoring configured
- [ ] Manual smoke test: register → browse → list → message → trade → rate

---

## Critical Path to MVP

```
Phase 7 (Listings) ──────────────────────────────┐
                                                   ▼
Phase 11 (Unlock flow) ──→ Phase 10 (Messaging) ──┤
                                                   ▼
Phase 8 (Profiles) ──→ Phase 9 (Trades) ──────────┤
                                                   ▼
                                             MVP: users can register,
                                             browse, list, message (E2E),
                                             trade, and rate each other
```

---

## Test Count Summary

| Package | Tests |
|---|---|
| packages/api | 107 |
| packages/web | 245 |
| **Total** | **352** |

---

## Remaining Phase Summary

| Phase | Priority | Rough Size |
|---|---|---|
| 7 — Listings | 🟡 in progress (7.5, 7.6 remaining) | ~5 tasks |
| 11 — Key unlock flow | 🔴 next (blocks messaging) | ~5 tasks |
| 10 — Messaging UI | 🟠 high | ~10 tasks |
| 8 — User Profiles | 🟠 high | ~10 tasks |
| 9 — Trade Flow | 🟠 high | ~12 tasks |
| 12 — Static pages | 🟡 medium | ~8 tasks |
| 13 — Security gaps | 🟡 medium | ~10 tasks |
| 13.5 — Remove Google OAuth | 🟠 high | ~6 tasks |
| 13.6 — Email verification + self-hosted mail | 🟠 high | ~15 tasks |
| 14 — Launch checklist | 🟡 medium | ~15 tasks |
