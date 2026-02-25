# Bartr — Development Roadmap

## Phase 1: Foundation
- [x] **Task 1 — Project Scaffold**: Monorepo, Docker Compose (7 services), DB schema (11 tables), health endpoint, landing page
- [x] **Task 2 — Auth System**: Google OAuth 2.0 + JWT. Routes: `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/register`, `/auth/me`. Refresh token rotation. 16 tests.
- [x] **Task 3 — User Profiles**: Public profile with reputation, profile update, avatar upload/serve via MinIO. 8 tests (24 total).

## Phase 2: Core Marketplace
- [ ] **Task 4 — Listing System**: CRUD for listings, category browser, PostgreSQL full-text search, image upload (up to 5), payment method tags
- [ ] **Task 5 — Trade Flow**: Offer/accept/decline/complete state machine. Both parties confirm completion.
- [ ] **Task 6 — Reputation Engine**: Post-trade ratings, composite score calculation in workers, tier assignment (New → Verified → Trusted → Elite), anti-manipulation rules

## Phase 3: Communication & Moderation
- [ ] **Task 7 — Messaging**: Threaded DMs between trade participants, encrypted storage, WebSocket delivery, read receipts
- [ ] **Task 8 — Moderation**: Keyword filter on listings, user-submitted flags, admin review dashboard

## Phase 4: Launch Prep
- [ ] **Task 9 — Donation Page**: BTC, XMR, Lightning addresses + QR codes, optional expense breakdown
- [ ] **Task 10 — Production Hardening**: Nginx TLS, rate limiting, security headers, automated backups, Tor hidden service, Dockerfile optimization

## Future (Post-Launch)
- Federation / decentralization layer
- Mobile-responsive PWA
- Multi-language support
- Dispute resolution improvements
- Escrow-optional mode (if community demands it)
