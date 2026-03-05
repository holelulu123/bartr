# Bartr — P2P Marketplace

Privacy-first peer-to-peer crypto/barter marketplace. Bulletin-board model (no escrow). Donation-funded.

## Stack

- **Monorepo:** pnpm workspaces (`packages/api`, `packages/web`, `packages/workers`, `packages/shared`)
- **Frontend:** Next.js 14 (App Router) + Tailwind + Radix UI + React Query
- **Backend:** Fastify 5 + PostgreSQL 16 + Redis 7 + MinIO (S3)
- **Auth:** JWT (Jose) + Argon2 + E2E encryption (X25519)
- **Infra:** Docker Compose (dev + prod), Nginx reverse proxy

## Quick Commands

```bash
# Start dev environment (all services)
docker compose up

# Run all tests (auto-starts containers if needed)
bash scripts/test.sh

# Run only unit tests (no Docker needed)
bash scripts/test.sh --unit

# Run only API integration tests
bash scripts/test.sh --api

# Run only web tests
bash scripts/test.sh --web

# Lint & format
~/.local/bin/pnpm lint
~/.local/bin/pnpm format

# pnpm must be called as ~/.local/bin/pnpm (not in PATH)
```

## Docker Compose

- `docker-compose.yml` — dev mode with hot reload (use this most of the time)
- `docker-compose.prod.yml` — production overlay (builds from Dockerfiles)

Services: nginx (:80), nextjs (:3000), api (:4000), workers, postgres (:5433), redis (:6379), minio (:9000/:9001)

## Database

Migrations in `db/` (plain SQL, numbered 001–018). Applied on API startup.

## Documentation

All docs live in `docs/`:
- `INFRASTRUCTURE.md` — full schema, API surface, security (main reference)
- `API.md` — endpoint docs
- `ROADMAP_V4.md` — current roadmap
- `STACK_CHOICES.md`, `SERVICE_HIERARCHY.md`, `MARKETPLACE_ANALYSIS.md` — architecture decisions

## Workflow

- Before implementing a feature, confirm the approach with the user
- After completing a feature, ask if the result looks good before committing
- Commit only when the user approves
