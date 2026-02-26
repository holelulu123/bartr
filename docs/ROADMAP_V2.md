# Bartr — Launch Roadmap v2

> Last updated: 2026-02-26

---

## What's Blocking Launch?

The backend API is feature-complete with ~84 tests. The frontend foundation (Phase 5) is done. But there is no usable UI and — critically — **messages are not truly private**. The server can currently read all messages. For a privacy-first marketplace that is unacceptable.

The correct order is:
1. **E2E encryption** (Phase 4.5 — new) — do this before auth pages, while no real data exists
2. **Auth pages** (Phase 6) — registration now includes keypair generation
3. **Listings** (Phase 7) — the billboard
4. **Everything else** builds on top

---

## How to Build the Frontend — Technology Context

### Stack (already installed)
- **Next.js 14** (App Router) + **React 18** + **Tailwind CSS 3**
- **shadcn/ui** — copy-paste Radix-based components (you own the code)
- **TanStack React Query** — data fetching, caching, pagination
- **React Hook Form + Zod** — forms with schema validation
- **next-themes** — dark/light mode

### E2E Crypto in the Browser
All message encryption uses the **Web Crypto API** (`window.crypto.subtle`) — built into every modern browser, zero dependencies. Operations:
- `generateKey` — create X25519 keypair
- `deriveKey` / `deriveBits` — ECDH shared secret, PBKDF2 key derivation
- `encrypt` / `decrypt` — AES-256-GCM
- `exportKey` / `importKey` — serialize keys for storage/transport

---

## ✅ Phase 5: Frontend Foundation — COMPLETE

| Task | Status |
|---|---|
| 5.1 — Install deps (shadcn/ui, React Query, RHF+Zod, lucide, next-themes) | ✅ done |
| 5.2 — Design tokens (CSS variables, dark/light, Tailwind config) | ✅ done |
| 5.3 — UI components (Button, Input, Card, Badge, Avatar, Dialog, etc.) | ✅ done |
| 5.4 — API client (base fetch, token refresh, 6 domain modules) | ✅ done |
| 5.5 — AuthProvider (session restore from cookie, useAuth hook, ProtectedRoute) | ✅ done |
| 5.6 — React Query hooks (key factories, domain hooks for all modules) | ✅ done |
| 5.7 — App shell (Navbar, Footer, full provider stack in layout.tsx) | ✅ done |

**Frontend test count: 102 passing**

---

## ✅ Phase 13 (partial): Real Encryption — COMPLETE

| Task | Status |
|---|---|
| 13.2a — AES-256-GCM crypto module (encrypt/decrypt, key validation, 15 tests) | ✅ done |
| 13.2b — Email field encryption in auth.ts (replaces Buffer.from placeholder) | ✅ done |
| 13.2c — Message body encryption in messages.ts (replaces Buffer.from placeholder) | ✅ done |

**Note:** The message encryption above is server-side (protects DB dumps). True E2E (server cannot read messages) is Phase 4.5 below.

---

## 🔴 Phase 4.5: End-to-End Message Encryption (NEW — do before auth pages)

Messages between users must be unreadable by the server. This uses X25519 key exchange + AES-256-GCM, entirely in the browser via Web Crypto API.

### Why This Phase Exists
- The server currently can decrypt all messages (server holds the key)
- For a privacy-first platform, the server must only ever see ciphertext it cannot open
- This must be done before registration UI is built — keypair generation is part of registration
- No real users exist yet — zero migration cost

### Architecture

```
Server stores per user:
  public_key          TEXT     — X25519 public key (base64, public info)
  private_key_blob    BYTEA    — private key encrypted with password-derived key
  recovery_key_blob   BYTEA    — private key encrypted with recovery key

Server stores per message:
  body_encrypted      BYTEA    — AES-256-GCM ciphertext (server cannot decrypt)

Client holds in memory (session only):
  privateKey          CryptoKey — decrypted from blob using password
```

### 4.5.1 — DB migration: add key columns to users
- [ ] Add `public_key TEXT` column to `users` table
- [ ] Add `private_key_blob BYTEA` column to `users` table
- [ ] Add `recovery_key_blob BYTEA` column to `users` table
- [ ] Write migration SQL file (`db/migrations/005_e2e_keys.sql`)
- [ ] Update `POST /auth/register` to accept and store all 3 fields
- [ ] Update `POST /auth/google/callback` (existing user login) to return `private_key_blob` and `recovery_key_blob` in redirect params or a follow-up endpoint
- [ ] Add `GET /auth/key-blobs` protected endpoint — returns `{ private_key_blob, recovery_key_blob, public_key }` for the current user (called after login to load key material)

### 4.5.2 — Backend: message routes no longer decrypt
- [ ] Remove `encrypt()` / `decrypt()` calls from `messages.ts` (server stores raw bytes, never decrypts)
- [ ] Messages endpoint returns `body_encrypted` as base64 string — client decrypts
- [ ] Send message endpoint accepts `body_encrypted` as base64 string — client encrypted it
- [ ] Add `GET /users/:nickname/public-key` endpoint — returns a user's public key (needed to encrypt a message to them)
- [ ] Update existing message tests to reflect the new opaque flow

### 4.5.3 — Frontend: crypto library (`src/lib/e2e-crypto.ts`)
- [ ] `generateKeypair()` — generate X25519 keypair using Web Crypto API
- [ ] `deriveWrappingKey(password, salt)` — PBKDF2 → 256-bit AES-KW key for wrapping private key
- [ ] `wrapPrivateKey(privateKey, wrappingKey)` → `ArrayBuffer` (the blob)
- [ ] `unwrapPrivateKey(blob, wrappingKey)` → `CryptoKey` (private key back in memory)
- [ ] `generateRecoveryKey()` → 32 random bytes → 24-word BIP39 mnemonic (or 64-char hex)
- [ ] `wrapPrivateKeyWithRecoveryKey(privateKey, recoveryKey)` → `ArrayBuffer`
- [ ] `deriveSharedSecret(myPrivateKey, theirPublicKey)` → ECDH → shared `CryptoKey`
- [ ] `encryptMessage(plaintext, sharedSecret)` → base64 ciphertext (AES-256-GCM, random IV)
- [ ] `decryptMessage(base64Ciphertext, sharedSecret)` → plaintext string
- [ ] `exportPublicKey(publicKey)` → base64 string for API transport
- [ ] `importPublicKey(base64)` → `CryptoKey`

### 4.5.4 — Frontend: key management context (`src/contexts/crypto-context.tsx`)
- [ ] `CryptoProvider` — holds `privateKey` (CryptoKey | null) in memory only
- [ ] `useCrypto()` hook — exposes `privateKey`, `loadKey(blob, password)`, `clearKey()`
- [ ] `loadKey(blob, password)` — derives wrapping key from password, unwraps private key blob, stores in context
- [ ] On logout — `clearKey()` wipes private key from memory
- [ ] Add `CryptoProvider` to `layout.tsx` provider stack

### 4.5.5 — Frontend: wire into auth flow
- [ ] Registration page: after form submit, call `generateKeypair()`, `wrapPrivateKey()`, `wrapPrivateKeyWithRecoveryKey()`, include blobs + public key in `POST /auth/register` payload
- [ ] After registration: show recovery key page (one-time, cannot go back) with copy + download buttons
- [ ] Auth callback page: after receiving tokens, call `GET /auth/key-blobs`, then `loadKey(blob, password)` — private key is now in memory
- [ ] Login requires password entry even for OAuth users (needed to unwrap private key) — show password prompt after OAuth callback if no key in memory

### 4.5.6 — Frontend: wire into messaging
- [ ] `useSendMessage` hook: before POST, fetch recipient's public key, derive shared secret, `encryptMessage()`, send ciphertext
- [ ] `useMessages` hook: after GET, for each message derive shared secret with sender's public key, `decryptMessage()` locally
- [ ] Cache shared secrets per thread in memory (avoid re-deriving on every render)
- [ ] Handle case where recipient has no public key (legacy/error) — show "Cannot encrypt" warning

### 4.5.7 — Recovery flow
- [ ] Add `/settings/recovery` page — lets user view and rotate recovery key
- [ ] Recovery key input page — if `private_key_blob` exists but password is wrong, offer recovery key path
- [ ] Recovery: `unwrapPrivateKey(recoveryBlob, recoveryKey)` → re-wrap with new password → update server

---

## Phase 6: Authentication Pages

### 6.1 — Login page (`/login`)
- [ ] Centered card: app logo, tagline, "Sign in with Google" button
- [ ] Button → redirects to `GET /auth/google` (API handles OAuth)
- [ ] Privacy note: "We only store your nickname. No tracking."
- [ ] Link to `/about` for more info

### 6.2 — OAuth callback handler (`/auth/callback`)
- [ ] Receives `access_token` + `refresh_token` from URL params
- [ ] Stores tokens via `AuthProvider.setTokens()`
- [ ] Calls `GET /auth/key-blobs` to retrieve encrypted private key blob
- [ ] Shows password prompt to unwrap private key → loads into `CryptoProvider`
- [ ] Redirects to home (or previous page via `returnTo` param)
- [ ] Handles error params (`auth_error=google_denied`, etc.)

### 6.3 — Registration page (`/register`)
- [ ] Shown when Google account has no Bartr account yet
- [ ] Receives `google_id` + `email` from callback URL params
- [ ] Form: Nickname (3-20 chars, alphanumeric + underscores), Password (min 8), Confirm Password
- [ ] On submit:
  1. Generate X25519 keypair in browser
  2. Derive wrapping key from password (PBKDF2)
  3. Wrap private key → blob
  4. Generate recovery key → wrap private key → recovery blob
  5. POST all to `/auth/register`
- [ ] On success: redirect to `/register/recovery-key` page
- [ ] Nickname availability check (debounced)
- [ ] Inline validation errors

### 6.4 — Recovery key page (`/register/recovery-key`)
- [ ] Shown once after registration — cannot be dismissed without acknowledging
- [ ] Display 24-word mnemonic (or 64-char hex)
- [ ] "Copy to clipboard" button
- [ ] "Download as .txt" button
- [ ] Checkbox: "I have saved my recovery key"
- [ ] Only then: "Continue" button → home page

### 6.5 — Password prompt modal (reusable component)
- [ ] Shown when user is authenticated (has JWT) but private key is not in memory
- [ ] Can happen on: new device, session expired, page refresh
- [ ] Password input → `loadKey(blob, password)` → dismiss
- [ ] "Use recovery key instead" link → recovery input
- [ ] Blocks messaging UI until resolved

---

## Phase 7: Listings — The Billboard

### 7.1 — Browse listings page (`/listings` or `/`)
- [ ] Grid of listing cards
- [ ] `ListingCard` component: title, price, payment method badges, seller nickname + tier badge, thumbnail, time ago
- [ ] Infinite scroll or "Load more" (`useInfiniteListings`)
- [ ] Empty state when no results

### 7.2 — Search & filter bar
- [ ] Debounced full-text search input
- [ ] Category dropdown (from `useCategories`)
- [ ] Payment method multi-select (BTC, XMR, Cash, Bank)
- [ ] Status filter (active only by default)
- [ ] URL-synced filters (shareable links)

### 7.3 — Listing detail page (`/listings/[id]`)
- [ ] Full listing: title, description (prose), price, payment methods, category
- [ ] Image gallery with lightbox
- [ ] Seller sidebar: avatar, nickname, reputation score + tier, member since
- [ ] Action buttons (not own listing): "Message Seller", "Make Offer"
- [ ] Action buttons (own listing): "Edit", "Delete" (with confirm dialog)

### 7.4 — Create listing (`/listings/new`)
- [ ] Protected route
- [ ] Form: Title, Description, Category, Payment Methods, Price, Currency
- [ ] Image upload: drag-and-drop, up to 5, previews
- [ ] Moderation pre-check on submit (`POST /moderation/check`)
- [ ] Redirect to new listing on success

### 7.5 — Edit listing (`/listings/[id]/edit`)
- [ ] Pre-filled form, owner only
- [ ] Image management (add/delete, max 5)
- [ ] Mark as sold/paused

### 7.6 — My listings dashboard (`/dashboard/listings`)
- [ ] Protected, own listings only
- [ ] Status filter, quick actions (edit, delete, mark sold)

---

## Phase 8: User Profiles

### 8.1 — Public profile (`/user/[nickname]`)
- [ ] Avatar, nickname, bio, member since, last active
- [ ] Reputation: composite score bar, tier badge, rating avg, trade count
- [ ] Recent ratings (paginated)
- [ ] Active listings by this user
- [ ] "Message User" button

### 8.2 — Edit profile (`/settings/profile`)
- [ ] Nickname (availability check), bio, avatar upload with crop

### 8.3 — Reputation components
- [ ] `ReputationBadge` — tier with color (New/Verified/Trusted/Elite)
- [ ] `StarRating` — static display and interactive input
- [ ] `RatingCard` — individual rating display

---

## Phase 9: Trade Flow

### 9.1 — Trade initiation
- [ ] "Make Offer" button → confirm dialog → `POST /trades` → redirect to trade page

### 9.2 — Trade detail page (`/trades/[id]`)
- [ ] Status header, listing summary, buyer + seller with reputation
- [ ] Action buttons by role and status
- [ ] Event timeline (audit log)
- [ ] Link to message thread

### 9.3 — My trades dashboard (`/dashboard/trades`)
- [ ] Tabs: Buying / Selling / All
- [ ] Filter by status

### 9.4 — Rate trade
- [ ] Post-completion rating prompt
- [ ] Star selector + comment

---

## Phase 10: Messaging UI

### 10.1 — Inbox (`/messages`)
- [ ] Thread list: avatar, nickname, listing title, last message preview, timestamp
- [ ] Empty state

### 10.2 — Thread view (`/messages/[threadId]`)
- [ ] Message bubbles (own = right, other = left)
- [ ] Auto-scroll to bottom
- [ ] Message input: textarea + send button
- [ ] Paginated load-older on scroll up
- [ ] Encryption indicator (lock icon — messages are E2E encrypted)
- [ ] Password prompt if private key not in memory

### 10.3 — Start conversation
- [ ] "Message Seller" / "Message User" → `POST /threads` → redirect to thread

---

## Phase 11: Moderation & Reporting

### 11.1 — Report flow
- [ ] Report button on listings, profiles, messages
- [ ] Reason dialog → `POST /flags`

### 11.2 — Admin dashboard (`/admin/flags`)
- [ ] Requires admin role (Phase 13.1)
- [ ] Flag queue, filter, detail view, resolve actions

---

## Phase 12: Static Pages

### 12.1 — Landing page redesign
- [ ] Hero: tagline, search bar, CTA
- [ ] Recent listings grid
- [ ] "How it works" section
- [ ] Stats (listings count, trades completed)

### 12.2 — About / How It Works (`/about`)
### 12.3 — Privacy page (`/privacy`)
### 12.4 — Donate page fixes (real addresses, local QR codes)

---

## Phase 13: Security & Backend Gaps

### 13.1 — Admin role system
- [ ] Add `role` column to `users` (enum: `user`, `admin`)
- [ ] DB migration
- [ ] `requireAdmin` Fastify middleware
- [ ] Gate `/admin/*` routes behind `requireAdmin`
- [ ] Seed initial admin (by nickname via env var)

### 13.2 — Encryption ✅ (done — see Phase 4.5 for E2E)
- [x] AES-256-GCM crypto module
- [x] Email field encryption
- [x] Message body server-side encryption (DB protection)
- [ ] Remove server-side message decrypt once E2E (4.5.2) is done

### 13.3 — Content security
- [ ] EXIF stripping for uploaded images (`sharp`)
- [ ] Stricter image validation (magic bytes check)
- [ ] Rate limit flag submissions

---

## Phase 14: Polish & Launch

### 14.1 — Responsive design pass (mobile/tablet/desktop)
### 14.2 — Loading & error states (skeletons, error boundaries, 404, toasts)
### 14.3 — Accessibility (semantic HTML, labels, keyboard nav, WCAG AA contrast)
### 14.4 — SEO & metadata (dynamic titles, OG tags, sitemap, JSON-LD)
### 14.5 — Performance (Next.js Image, lazy loading, bundle analysis)
### 14.6 — Pre-launch checklist
- [ ] Real donation addresses
- [ ] Real Google OAuth credentials
- [ ] Production env vars (JWT secret, encryption key, DB password)
- [ ] Full test suite passing
- [ ] Manual smoke test of every user flow
- [ ] DB backups configured
- [ ] Uptime monitoring

---

## Critical Path to "Minimum Usable Product"

```
Phase 4.5 (E2E encryption) ──→ Phase 6 (Auth pages + keypair generation)
                                      │
                                      ▼
                               Phase 7.1-7.3 (Browse + Listing detail)
                                      │
                                      ▼
                               Phase 10.1-10.3 (Messaging with E2E)
```

At that point: a user can register, browse listings, contact a seller with encrypted messages. That's the MVP.

---

## Task Count

| Phase | Status | Tasks |
|---|---|---|
| 4.5 — E2E Encryption | 🔴 next | ~20 subtasks |
| 5 — Frontend Foundation | ✅ done | — |
| 6 — Auth Pages | 🟡 after 4.5 | ~12 subtasks |
| 7 — Listings | 🟡 pending | ~25 subtasks |
| 8 — User Profiles | 🟡 pending | ~12 subtasks |
| 9 — Trade Flow | 🟡 pending | ~16 subtasks |
| 10 — Messaging UI | 🟡 pending | ~12 subtasks |
| 11 — Moderation UI | 🟡 pending | ~8 subtasks |
| 12 — Static Pages | 🟡 pending | ~14 subtasks |
| 13 — Security Gaps | 🟡 partial | ~10 subtasks |
| 14 — Polish & Launch | 🟡 pending | ~24 subtasks |
