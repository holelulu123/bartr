# Bartr

A peer-to-peer marketplace where users post listings for goods and services and negotiate payment in cryptocurrency, cash, bank transfer, or barter. No escrow, no middleman, no KYC — just a bulletin board with a reputation system and end-to-end encrypted messaging.

## Vision

The internet needs a privacy-respecting trading platform. LocalBitcoins shut down. OpenBazaar closed in 2021. Craigslist isn't crypto-native. Bartr fills that gap.

**How it works:**
- Sellers post listings with accepted payment methods (BTC, XMR, ETH, cash, bank transfer)
- Buyers message sellers to arrange trades — messages are end-to-end encrypted, the server cannot read them
- Both parties rate each other after completion
- A multi-dimensional reputation system builds trust without requiring escrow
- Revenue comes from voluntary BTC donations — no fees, no ads, no data harvesting

**Design principles:**
- Privacy-first: minimal data collection, E2E encrypted messages, EXIF stripping on images
- Bulletin-board model: the platform never holds funds or intermediates trades
- Community-funded: donation-only revenue, open development
- Decentralization-ready: starts centralized on a VPS, architected to move to federation/P2P later

## Current Status

| Layer | Status |
|---|---|
| Backend API | Complete — 107 tests passing |
| E2E Encryption | Complete — X25519 keypairs, PBKDF2 key wrapping, server-blind messages |
| Frontend Foundation | Complete — shadcn/ui, React Query, AuthProvider, CryptoProvider |
| Auth Pages | Complete — /login, /auth/callback, /register with recovery key |
| Listings UI | In progress |

**Total test coverage: 241 tests passing**

See [docs/ROADMAP_V3.md](docs/ROADMAP_V3.md) for the full development roadmap.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 3 |
| UI Components | shadcn/ui (Radix primitives) |
| State / Data | TanStack React Query, React Hook Form + Zod |
| Crypto | Web Crypto API (X25519, AES-256-GCM, PBKDF2) — browser-native, zero deps |
| Backend API | Fastify 5, TypeScript |
| Auth | Google OAuth 2.0 + nickname/password, argon2id, JWT (RS256) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| Background Jobs | Custom worker process |
| Reverse Proxy | Nginx |
| Package Manager | pnpm (workspaces) |
| Testing | Vitest |
| Containerization | Docker Compose |

## E2E Encryption

Messages between users are encrypted in the browser before being sent to the server. The server stores and forwards ciphertext it cannot decrypt.

```
Registration:
  Browser generates X25519 keypair
  Private key wrapped with PBKDF2(password) → encrypted blob stored on server
  Private key also wrapped with random recovery key → shown to user once
  Public key stored plaintext on server

Messaging:
  Sender fetches recipient's public key
  ECDH shared secret derived in browser
  Message encrypted with AES-256-GCM before leaving the device
  Server stores base64 ciphertext — never sees plaintext
  Recipient decrypts locally using their private key (unlocked from blob on login)
```

## Project Structure

```
bartr/
├── packages/
│   ├── web/          Next.js frontend (App Router)
│   │   ├── src/app/  Pages and layouts
│   │   ├── src/components/  UI components (shadcn/ui)
│   │   ├── src/contexts/    AuthProvider, CryptoProvider
│   │   ├── src/hooks/       React Query domain hooks
│   │   └── src/lib/         API client, crypto library, utils
│   ├── api/          Fastify REST API
│   │   └── src/
│   │       ├── routes/      Auth, listings, trades, messages, users, moderation
│   │       ├── plugins/     DB, Redis, MinIO, JWT auth plugin
│   │       └── lib/         crypto.ts, jwt.ts
│   ├── workers/      Background job runner
│   └── shared/       Shared types and constants
├── db/
│   └── migrations/   SQL migration files (001–005)
├── nginx/            Nginx configuration
└── docs/             Architecture docs and roadmap
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm` or via package manager)
- Docker and Docker Compose

### Development

```bash
# Clone and install dependencies
git clone <repo>
cd bartr
pnpm install

# Start all services (postgres, redis, minio, api, web, nginx)
docker-compose -f docker-compose.dev.yml up -d

# Services available at:
# http://localhost        → Frontend (Next.js)
# http://localhost/api    → Backend API (Fastify)
# http://localhost:9001   → MinIO console
```

### Running Tests

Backend tests require Docker services running (postgres on port 5433, redis on 6379):

```bash
# Backend (107 tests) — .env.test handles the port automatically
pnpm --filter @bartr/api test

# Frontend (134 tests) — jsdom, no Docker needed
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

### Backend (packages/api)
| Package | Purpose |
|---|---|
| fastify 5 | High-performance HTTP framework |
| @fastify/cors, @fastify/rate-limit, @fastify/multipart | Fastify plugins |
| pg | PostgreSQL client |
| ioredis | Redis client |
| argon2 | Password hashing (argon2id) |
| jose | JWT signing and verification |
| minio | S3-compatible object storage client |
| ajv | JSON schema validation (required by Fastify) |

### Frontend (packages/web)
| Package | Purpose |
|---|---|
| next 14 | React framework (App Router, SSR) |
| react / react-dom 18 | UI library |
| tailwindcss 3 | Utility-first CSS |
| @radix-ui/* | Accessible headless UI primitives |
| @tanstack/react-query | Data fetching, caching, mutations |
| react-hook-form + zod + @hookform/resolvers | Form validation |
| next-themes | Dark/light mode |
| lucide-react | Icon library |
| clsx + tailwind-merge | Conditional class utilities |

### Dev / Testing
| Package | Purpose |
|---|---|
| vitest | Unit and integration testing |
| @testing-library/react + user-event | Component testing |
| typescript | Type safety across the entire project |
| tsx | TypeScript execution for dev servers |

## Architecture

See [docs/SERVICE_HIERARCHY.md](docs/SERVICE_HIERARCHY.md) for the full service architecture diagram.

See [docs/MARKETPLACE_ANALYSIS.md](docs/MARKETPLACE_ANALYSIS.md) for the comprehensive design analysis.

See [docs/ROADMAP_V3.md](docs/ROADMAP_V3.md) for the current development roadmap.

## Contributing

This is a community project. Contributions welcome. Run `pnpm lint` before submitting.

## Support

Bartr is funded by donations. BTC and XMR addresses will be published on the donation page once the platform launches.
