# Bartr

A peer-to-peer marketplace where users post listings for goods and services and negotiate payment in cryptocurrency, cash, bank transfer, or barter. No escrow, no middleman, no KYC — just a bulletin board with a reputation system and encrypted messaging.

## Vision

The internet needs a privacy-respecting trading platform. LocalBitcoins shut down. OpenBazaar closed in 2021. Craigslist isn't crypto-native. Bartr fills that gap.

**How it works:**
- Sellers post listings with accepted payment methods (BTC, XMR, ETH, cash, bank transfer)
- Buyers message sellers to arrange trades
- Both parties rate each other after completion
- A multi-dimensional reputation system builds trust without requiring escrow
- Revenue comes from voluntary BTC donations — no fees, no ads, no data harvesting

**Design principles:**
- Privacy-first: minimal data collection, EXIF stripping on images
- Bulletin-board model: the platform never holds funds or intermediates trades
- Community-funded: donation-only revenue, open development
- Decentralization-ready: starts centralized on a VPS, architected to move to federation/P2P later

## Tech Stack

**Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui (Radix primitives), TanStack React Query, React Hook Form + Zod, Web Crypto API

**Backend:** Fastify 5, TypeScript, PostgreSQL 16, Redis 7, MinIO (S3-compatible), Nginx

**Tooling:** pnpm workspaces, Docker Compose, Vitest

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker and Docker Compose

### Development

```bash
git clone <repo>
cd bartr
cp .env.example .env
pnpm install
docker compose up -d
```

This starts all 7 services (nginx, nextjs, api, workers, postgres, redis, minio) in dev mode with hot reload and all ports exposed.

| Service | Port | Notes |
|---------|------|-------|
| nginx | 80 | Reverse proxy |
| nextjs | 3000 | `next dev` (hot reload) |
| api | 4000 | `tsx watch` (auto-reload) |
| postgres | 5433 | Mapped from internal 5432 |
| redis | 6379 | |
| minio | 9000, 9001 | S3 API + console |

### Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The prod override builds app services from Dockerfiles (no source mounts, no hot reload) and exposes only internal ports — nginx is the single entry point.

### Running Tests

Backend tests require Docker services running (postgres on port 5433, redis on 6379, minio on 9000). Frontend tests run in jsdom with no Docker needed.

```bash
# Everything (starts Docker if needed)
bash scripts/test.sh

# Backend only
pnpm --filter @bartr/api test

# Frontend only
pnpm --filter @bartr/web test
```

### Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Key variables for production:
- `JWT_SECRET` — random 256-bit secret (never use the dev default)
- `ENCRYPTION_KEY` — 64-char hex string (32 bytes) for email field encryption
- `DATABASE_URL`, `REDIS_URL` — production connection strings

### Health Dashboard

The `/health` page has its own login, completely separate from the app's auth. It uses Ed25519 keypair authentication — only the public key is stored in `.env`, you paste the private key to unlock.

```bash
# Generate keypair
openssl genpkey -algorithm ed25519 -out health_key.pem
openssl pkey -in health_key.pem -pubout
```

Copy the public key output and set `HEALTH_PUBLIC_KEY` in `.env` (use literal `\n` for newlines):
```
HEALTH_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----
```

Keep `health_key.pem` safe — you paste its full contents into the `/health` login form to unlock the dashboard.

Leave `HEALTH_PUBLIC_KEY` blank in dev to skip auth. Wrong key attempts trigger a 30-second cooldown.

## Dependencies

**Backend** (`packages/api`): fastify 5, @fastify/cors + rate-limit + multipart, pg, ioredis, argon2, jose, minio

**Frontend** (`packages/web`): next 14, react 18, tailwindcss, @radix-ui/*, @tanstack/react-query, react-hook-form + zod, lucide-react, next-themes

**Dev / Testing**: vitest, @testing-library/react, typescript, tsx

## Docs

- [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) — service architecture and API surface
- [docs/ROADMAP_V4.md](docs/ROADMAP_V4.md) — manual browser-testing guide
- [docs/MARKETPLACE_ANALYSIS.md](docs/MARKETPLACE_ANALYSIS.md) — design analysis

## Contributing

Community project. Contributions welcome. Run `pnpm lint` before submitting.

## Support

Bartr is funded by donations. BTC and XMR addresses will be published on the donation page once the platform launches.
