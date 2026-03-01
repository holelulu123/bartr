# Bartr — Roadmap V4: Missing Pieces

> Items not covered in ROADMAP_V3. These are features, infrastructure, and polish
> needed beyond the existing phases to make Bartr production-ready.

---

## 1. Admin Dashboard UI

Backend has admin role + `requireAdmin` hook, but no frontend panel.

- [ ] `/admin` — overview: user count, listing count, active trades, pending flags
- [ ] `/admin/users` — user list with search, role management (promote/demote)
- [ ] `/admin/listings` — all listings, bulk actions (remove, pause)
- [ ] `/admin/flags` — already exists, but needs polish (bulk dismiss, sort by date)

---

## 2. Dispute Resolution

Reputation system design mentions disputes but no implementation exists.

- [ ] "Open Dispute" button on accepted/in-progress trades
- [ ] Dispute reason form (text + optional image evidence)
- [ ] Admin dispute queue (`/admin/disputes`)
- [ ] Admin can rule in favor of buyer or seller
- [ ] Dispute outcome affects reputation scores

---

## 3. Notification System

No way to notify users of trade updates, messages, or flags.

- [ ] In-app notification bell in navbar with unread count
- [ ] Notification types: new message, trade status change, new offer, flag resolved
- [ ] Notification dropdown with mark-as-read
- [ ] Optional email notifications (after 13.6 email is set up)

---

## 4. Exchange Search

Marketplace has full-text search, exchange doesn't.

- [ ] Search bar on `/exchange` — search by user nickname, notes, or description
- [ ] Sort options: newest, best price, highest reputation

---

## 5. Terms of Service Page

`/about` and `/privacy` exist, but no `/terms`.

- [ ] `/terms` — terms of service, acceptable use policy, liability disclaimer
- [ ] Link in footer and registration page
- [ ] "I agree to Terms" checkbox on registration (optional — depends on legal stance)

---

## 6. Rate Limiting on Registration

Only login has brute-force protection.

- [ ] Rate limit `POST /auth/register/email` — max 3 registrations per IP per hour
- [ ] Rate limit `POST /auth/register/email` — max 10 per IP per day

---

## 7. CI/CD Pipeline

No automated build, test, or deploy.

- [ ] GitHub Actions workflow: lint + test on every push/PR
- [ ] Separate jobs for API tests and web tests (parallel)
- [ ] Docker image build + push to registry on main branch merge
- [ ] Auto-deploy to VPS on successful main build (SSH or webhook)

---

## 8. Production Docker Compose

Only dev compose exists. Production needs optimized builds.

- [ ] Multi-stage Dockerfiles for API, web, workers (build → slim runtime)
- [ ] `docker-compose.prod.yml` with production settings
- [ ] No source mounts — built images only
- [ ] Health checks on all services
- [ ] Restart policies (`unless-stopped`)
- [ ] Log rotation configured

---

## 9. Backup & Restore

Mentioned in launch checklist but not fleshed out.

- [ ] Automated daily PostgreSQL backup (pg_dump to encrypted file)
- [ ] MinIO bucket backup (sync to secondary storage)
- [ ] Backup retention policy (keep 7 daily, 4 weekly)
- [ ] Documented restore procedure
- [ ] Test restore on a fresh VPS

---

## 10. Monitoring & Alerting

No visibility into production health.

- [ ] Health check endpoint already exists (`/health`) — wire it to uptime monitor
- [ ] Error tracking (Sentry or self-hosted GlitchTip)
- [ ] Basic metrics: response times, error rates, active users
- [ ] Alerts: service down, high error rate, disk space low

---

## 11. Improved Identicons

Mentioned in ROADMAP_V3 Phase 13.7 but not done.

- [ ] Replace 5x5 pixel grid avatars with a more visually distinct style
- [ ] Options: geometric shapes, rings, gradient blobs — still deterministic from nickname
- [ ] Pure SVG, no external dependencies

---

## 12. Real-Time Features

Currently everything requires manual refresh.

- [ ] WebSocket or SSE for live message delivery (no polling)
- [ ] Real-time trade status updates
- [ ] "User is typing..." indicator in message threads
- [ ] Online/offline user status (optional)

---

## 13. Image CDN & Caching

MinIO serves images directly with no optimization.

- [ ] Cache headers on MinIO-served images (Cache-Control, ETag)
- [ ] Nginx proxy cache in front of MinIO
- [ ] Responsive image sizes (thumbnails vs full-size)
- [ ] Lazy loading with blur placeholders

---

## 14. Price Feed Resilience

Worker depends on external APIs (CoinGecko/Binance/Kraken).

- [ ] If all sources fail, keep serving last known prices (already cached in Redis)
- [ ] Add staleness indicator — show "Prices may be outdated" if cache > 5 minutes old
- [ ] Log/alert when price feeds fail repeatedly
- [ ] Fallback: allow manual price entry on offers when feed is down

---

## Priority Summary

| Item | Priority | Why |
|---|---|---|
| 8 — Production Docker | 🔴 critical | Can't deploy without it |
| 7 — CI/CD | 🔴 critical | Manual deploys don't scale |
| 9 — Backup & Restore | 🔴 critical | Data loss = game over |
| 6 — Registration rate limit | 🟠 high | Bot prevention |
| 1 — Admin Dashboard UI | 🟠 high | Can't moderate without it |
| 3 — Notifications | 🟠 high | Users miss trade/message updates |
| 10 — Monitoring | 🟠 high | Blind in production |
| 2 — Dispute Resolution | 🟡 medium | Needed for trust, not day-one |
| 5 — Terms of Service | 🟡 medium | Legal protection |
| 14 — Price Feed Resilience | 🟡 medium | Graceful degradation |
| 4 — Exchange Search | 🟡 medium | Nice to have |
| 12 — Real-Time | 🟡 medium | Polling works for now |
| 11 — Improved Identicons | ⚪ low | Cosmetic |
| 13 — Image CDN | ⚪ low | Optimization, not blocking |
