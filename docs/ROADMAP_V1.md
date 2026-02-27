# Bartr — Development Roadmap

## Phase 1: Foundation
- [x] **Task 1 — Project Scaffold**: Monorepo, Docker Compose (7 services), DB schema (11 tables), health endpoint, landing page
- [x] **Task 2 — Auth System**: Google OAuth 2.0 + JWT. Routes: `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/register`, `/auth/me`. Refresh token rotation. 16 tests.
- [x] **Task 3 — User Profiles**: Public profile with reputation, profile update, avatar upload/serve via MinIO. 8 tests (24 total).
- [ ] **Task 3.1 — Dependency Hardening**: Swap `bcrypt` → `argon2` (OWASP-recommended password hashing). Swap `jsonwebtoken` → `jose` (maintained, zero-dep JWT library). Update all auth code and tests.

## Phase 2: Core Marketplace
- [x] **Task 4 — Listing System**: CRUD for listings, category browser, PostgreSQL full-text search, image upload (up to 5), payment method tags. 16 tests.
- [x] **Task 5 — Trade Flow**: Offer/accept/decline/complete state machine. Both parties confirm completion. 13 tests.
- [x] **Task 6 — Reputation Engine**: Post-trade ratings, composite score calculation, tier assignment (New → Verified → Trusted → Elite), anti-manipulation rules. 9 tests.

## Phase 3: Communication & Moderation
- [x] **Task 7 — Messaging**: Threaded DMs between users, encrypted storage, listing context. 9 tests.
- [x] **Task 8 — Moderation**: Keyword filter on listings, user-submitted flags, admin review dashboard. 11 tests.

## Phase 4: Launch Prep
- [x] **Task 9 — Donation Page**: BTC, XMR, Lightning addresses + QR codes, expense breakdown.
- [x] **Task 10 — Production Hardening**: Rate limiting (app + nginx), security headers, production nginx config with TLS placeholders. 2 tests.

## Future (Post-Launch)
- Evaluate Go rewrite for API if Node.js becomes a bottleneck
- Evaluate Astro/SvelteKit if Next.js proves too heavy for a bulletin-board UI
- Federation / decentralization layer
- Mobile-responsive PWA
- Multi-language support
- Dispute resolution improvements
- Escrow-optional mode (if community demands it)

---

## Tech Debt & Decision Log

Decisions made during the stack audit (after Task 3). Full analysis in conversation history.

| Choice | Status | Reasoning |
|--------|--------|-----------|
| **Node.js over Go** | Keep for now | Dev speed > runtime efficiency at this stage. Revisit if API latency or memory becomes a problem. |
| **Raw `pg` over Drizzle ORM** | Keep | Less abstraction, fewer deps, more control. Revisit if query complexity grows. |
| **MinIO over filesystem** | Keep | S3-compatible API gives free migration path to B2/Wasabi. Costs only ~30MB RAM. |
| **Redis (mostly idle)** | Keep | Will be used by Tasks 6 (job queue) and 7 (pub/sub). Removing and re-adding is more work than keeping it idle at 5MB. |
| **Next.js over lighter alternatives** | Keep for now | Marketplace interactivity (search, filters, dashboards) justifies a full framework. Revisit after Task 4 if UI stays simple. |
| **`bcrypt` → `argon2`** | TODO (Task 3.1) | Native C addon causes Docker/arch issues. Argon2id is OWASP recommendation. |
| **`jsonwebtoken` → `jose`** | TODO (Task 3.1) | Minimally maintained. `jose` is zero-dep, written by JWT spec author. |
| **Nginx over Caddy** | Keep for now | Evaluate Caddy's auto-TLS at Task 10. Nginx is fine for dev. |
