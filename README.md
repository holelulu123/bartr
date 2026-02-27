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
pnpm install
docker-compose -f docker-compose.dev.yml up -d
```

### Running Tests

Backend tests require Docker services running (postgres on port 5433, redis on 6379). Frontend tests run in jsdom with no Docker needed.

```bash
# Backend
pnpm --filter @bartr/api test

# Frontend
pnpm --filter @bartr/web test

# Both
pnpm test
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Key variables for production:
- `JWT_SECRET` — random 256-bit secret (never use the dev default)
- `ENCRYPTION_KEY` — 64-char hex string (32 bytes) for email field encryption
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `DATABASE_URL`, `REDIS_URL` — production connection strings

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
