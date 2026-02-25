# Bartr

A peer-to-peer marketplace where users post listings for goods and services and negotiate payment in cryptocurrency, cash, bank transfer, or barter. No escrow, no middleman, no KYC — just a bulletin board with a reputation system.

## Vision

The internet needs a privacy-respecting trading platform. LocalBitcoins shut down. OpenBazaar closed in 2021. Craigslist isn't crypto-native. Bartr fills that gap.

**How it works:**
- Sellers post listings with accepted payment methods (BTC, XMR, ETH, cash, bank transfer)
- Buyers message sellers to arrange trades
- Both parties rate each other after completion
- A multi-dimensional reputation system builds trust without requiring escrow
- Revenue comes from voluntary BTC donations — no fees, no ads, no data harvesting

**Design principles:**
- Privacy-first: minimal data collection, encrypted messages, EXIF stripping on images
- Bulletin-board model: the platform never holds funds or intermediates trades
- Community-funded: donation-only revenue, open development
- Decentralization-ready: starts centralized on a VPS, architected to move to federation/P2P later

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend API | Fastify 5, TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| Background Jobs | Custom worker process |
| Reverse Proxy | Nginx |
| Package Manager | pnpm (workspaces) |
| Testing | Vitest |
| Containerization | Docker Compose |

## Project Structure

```
bartr/
├── packages/
│   ├── web/          Next.js frontend
│   ├── api/          Fastify REST API
│   ├── workers/      Background job runner
│   └── shared/       Shared types and constants
├── db/
│   └── migrations/   SQL migration files
├── nginx/            Nginx configuration
└── docs/             Architecture docs and roadmap
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm
- Docker and Docker Compose

### Development

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start all services
docker compose -f docker-compose.dev.yml up

# Verify
curl http://localhost/api/health     # {"status":"ok","db":true,"redis":true}
open http://localhost                # Landing page
```

### Running Tests

```bash
# With Docker services running:
DATABASE_URL=postgresql://bartr:bartr_dev_password@localhost:5433/bartr \
REDIS_URL=redis://localhost:6379 \
pnpm --filter @bartr/api test
```

## Dependencies

### Runtime
- **fastify** — High-performance HTTP framework
- **pg** — PostgreSQL client
- **ioredis** — Redis client
- **fastify-plugin** — Fastify plugin helper
- **next** — React framework with SSR
- **react / react-dom** — UI library

### Development
- **typescript** — Type safety across the entire project
- **vitest** — Fast unit/integration testing
- **eslint** — Code linting
- **prettier** — Code formatting
- **tsx** — TypeScript execution for dev servers
- **tailwindcss** — Utility-first CSS

## Architecture

See [docs/SERVICE_HIERARCHY.md](docs/SERVICE_HIERARCHY.md) for the full service architecture diagram.

See [docs/MARKETPLACE_ANALYSIS.md](docs/MARKETPLACE_ANALYSIS.md) for the comprehensive design analysis.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the development roadmap.

## Contributing

This is a community project. Contributions welcome. Run `pnpm lint` and `pnpm format:check` before submitting.

## Support

Bartr is funded by donations. BTC and XMR addresses will be published on the donation page once the platform launches.
