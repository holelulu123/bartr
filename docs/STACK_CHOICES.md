# Bartr — Stack Choices & Rationale

Every technology in this project was chosen for a reason. This document explains what we chose, what we considered instead, and why.

---

## Runtime: Node.js 20 LTS

**Chosen over:** Go, Rust, Python, Deno

| | Node.js | Go | Rust |
|---|---------|-----|------|
| Dev speed | Fast | Moderate | Slow |
| Runtime perf | Good (V8) | Excellent | Excellent |
| Memory idle | ~50 MB | ~8 MB | ~3 MB |
| Dependency count | High (npm) | Low (stdlib) | Low (crates) |
| Web ecosystem | Massive | Good | Growing |
| Hiring/community | Huge | Large | Smaller |

**Why Node.js:** Development speed. A marketplace needs to iterate fast — features like listings, search, messaging, and reputation all need to ship before the platform has value. Node.js gets us there faster than anything else. The ecosystem for web APIs (Fastify, pg, ioredis, jose) is mature.

**Why not Go:** Go would be the right choice if this were a high-throughput backend (payment processor, real-time data pipeline). For a bulletin-board marketplace that will peak at hundreds of RPS, Node.js is fast enough and develops faster. Go's lack of generics (until recently) and verbose error handling slows iteration.

**Why not Rust:** Overkill for a web application. Compile times kill the feedback loop. The web ecosystem is immature compared to Node or Go.

**When to reconsider:** If the API consistently uses >2GB RAM or can't handle peak RPS on a 4-core VPS, rewrite hot paths in Go. The API is stateless, so a per-route migration is possible.

---

## API Framework: Fastify 5

**Chosen over:** Express, Hono, Koa, Elysia

| | Fastify | Express | Hono |
|---|---------|---------|------|
| Throughput | ~70K RPS | ~15K RPS | ~90K RPS |
| TypeScript | First-class | Bolted on | First-class |
| Plugin system | Built-in | Middleware only | Middleware |
| Schema validation | Built-in (JSON Schema) | Need express-validator | Zod adapter |
| Maturity | 7 years | 14 years | 3 years |

**Why Fastify:** 4-5x faster than Express with a cleaner architecture. The plugin system (`fastify-plugin`) lets us encapsulate database connections, auth, MinIO, etc. as decorate-on-instance plugins — each route file gets `fastify.pg`, `fastify.redis`, `fastify.minio` without manual dependency injection. Built-in schema validation rejects bad requests before they hit business logic.

**Why not Express:** Slow, callback-oriented design, no built-in validation, middleware execution order is a footgun. Express is legacy.

**Why not Hono:** Slightly faster than Fastify in benchmarks, but much less mature. The plugin ecosystem is small. Multi-runtime support (Deno, Bun, Cloudflare Workers) is irrelevant for a self-hosted VPS deployment.

---

## Frontend: Next.js 14

**Chosen over:** Astro, SvelteKit, plain HTML + htmx, Remix

| | Next.js | Astro | SvelteKit | htmx |
|---|---------|-------|-----------|------|
| SSR | Yes | Yes | Yes | Server-only |
| Client interactivity | Full React | Islands | Full Svelte | Minimal |
| Bundle size (hello world) | ~85 KB | ~0 KB | ~15 KB | ~14 KB |
| Dependency count | ~120 packages | ~40 packages | ~30 packages | 1 file |
| Learning curve | Medium | Low | Low | Very low |

**Why Next.js:** The marketplace will have interactive features — search filters, real-time trade status, messaging UI, user dashboards. These require client-side state management that a framework like Next.js handles well. SSR ensures listing pages are crawlable by search engines (critical for marketplace discovery). React's ecosystem gives us component libraries and patterns for complex UI.

**Why not Astro:** Astro ships zero JavaScript by default, which is ideal for content sites. A marketplace with interactive search, filters, and real-time updates needs more client-side JS than Astro's island model comfortably provides.

**Why not htmx:** The most aligned choice with the minimalist ethos. Server-rendered HTML with htmx partials would eliminate the entire Node.js frontend container. Seriously considered. Rejected because: (1) real-time messaging UI is awkward in htmx, (2) complex filter state is easier in React, (3) team familiarity. **This remains the strongest alternative if we find Next.js is overkill after Task 4.**

**When to reconsider:** After the listing system (Task 4) and messaging (Task 7) are built, evaluate whether the client-side complexity justifies Next.js. If most pages are read-heavy with minimal interactivity, consider migrating to Astro or server-rendered HTML.

---

## Database: PostgreSQL 16

**Chosen over:** MySQL, SQLite, MongoDB, CockroachDB

This was the easiest decision. PostgreSQL is the correct database for a marketplace.

**Why PostgreSQL:**
- **Full-text search** (`tsvector`) eliminates the need for Elasticsearch — one less service to run, monitor, and sync
- **JSONB** handles flexible fields (payment methods) without a separate document store
- **UUID primary keys** prevent ID enumeration (security/privacy)
- **Check constraints** enforce valid statuses at the database level (not just application code)
- **Encrypted bytea** stores messages and emails as encrypted binary directly in the DB
- **Mature replication** — read replicas, logical replication, streaming replication all built-in
- **Extensions** — `uuid-ossp` now, `pgcrypto` if we need DB-level encryption later

**Why not MongoDB:** No ACID transactions for trades. No joins for reputation aggregation. Schema-less design leads to data quality issues over time. MongoDB is for document workloads, not relational marketplace data.

**Why not SQLite:** Single-writer limitation. No network access (can't run in a separate container). Good for embedded or single-user apps, wrong for a multi-user web service.

---

## Cache / Queue: Redis 7

**Chosen over:** Memcached, Valkey, KeyDB, no cache

**Why Redis:**
- **Pub/sub** — needed for real-time WebSocket events (Task 7)
- **Streams** — job queue for workers (Task 6) without adding BullMQ/RabbitMQ
- **TTL** — rate limit counters and session cache expire automatically
- **Sub-millisecond reads** — listing view counters, hot user profiles
- **5 MB idle memory** — negligible cost to run

**Why not Memcached:** No pub/sub, no streams, no persistence. Redis does everything Memcached does plus more.

**Why not removing it:** Redis is currently idle (only used for health checks). But Tasks 6 and 7 need it. Removing and re-adding is more work than keeping it idle.

---

## Object Storage: MinIO

**Chosen over:** Filesystem, Backblaze B2, AWS S3, Cloudflare R2

**Why MinIO:**
- **S3-compatible API** — switching to B2 or Wasabi later requires changing only endpoint URL and credentials, zero code changes
- **Self-hosted** — no third-party sees user images (privacy)
- **Bucket policies** — can set lifecycle rules (auto-delete old backups)
- **~30 MB RAM** — lightweight enough for a single VPS

**Why not filesystem:** Writing to a Docker volume works but doesn't give us the S3 API. When we outgrow local disk and need B2, we'd have to write a migration layer. MinIO gives us that layer for free.

**Why not B2 directly:** B2 is a third-party service. Every user image would transit through Backblaze's infrastructure. For a privacy-focused platform, self-hosted storage is better at launch. B2 becomes the backup/overflow target later.

---

## Password Hashing: Argon2id

**Chosen over:** bcrypt, scrypt, PBKDF2

**Why Argon2id:**
- **OWASP recommendation** — Argon2id is the current winner of the Password Hashing Competition and OWASP's first-choice recommendation
- **Memory-hard** — resistant to GPU/ASIC cracking (bcrypt is not memory-hard)
- **Tunable** — can independently adjust time cost, memory cost, and parallelism
- **No native addon** — the `argon2` npm package uses pre-built binaries, avoiding `node-gyp` build issues that plague `bcrypt`

**Why not bcrypt:** bcrypt was the original choice. We swapped it out because: (1) the npm `bcrypt` package requires native C compilation via node-gyp, which breaks across architectures and Node versions, (2) bcrypt is not memory-hard, making it more vulnerable to GPU attacks, (3) Argon2id is the modern standard.

---

## JWT Library: jose

**Chosen over:** jsonwebtoken, fast-jwt, @fastify/jwt

**Why jose:**
- **Zero dependencies** — in a security-critical library, fewer deps = fewer attack surfaces
- **Written by the JWT/OIDC spec author** (Filip Skokan) — the person who literally wrote the standards
- **Actively maintained** — regular releases, security patches within hours
- **Web Crypto API** — uses the platform's native crypto, not a userland implementation
- **Universal** — works in Node.js, Deno, Bun, browsers, edge runtimes

**Why not jsonwebtoken:** The `jsonwebtoken` npm package was the original choice. We swapped it because: (1) minimal maintenance activity, (2) depends on `jws` and `jwe` packages with their own dep trees, (3) for a security-critical path (every authenticated request), we want the most trustworthy implementation available.

---

## Monorepo: pnpm workspaces

**Chosen over:** npm workspaces, yarn workspaces, Turborepo, Nx

**Why pnpm:**
- **Content-addressable storage** — packages are stored once on disk and hard-linked, saving ~60% disk space vs npm
- **Strict dependency resolution** — phantom dependencies (using a package you didn't declare) cause build errors instead of silent bugs
- **Fast** — consistently the fastest package manager in benchmarks
- **Simple workspace config** — `pnpm-workspace.yaml` with a list of glob patterns, done

**Why not Turborepo:** Turborepo adds a build caching layer. With 4 packages and sub-second build times, the caching overhead isn't justified. Add it if build times exceed 30 seconds.

---

## Containerization: Docker Compose

**Chosen over:** Kubernetes, Docker Swarm, Podman, bare metal

**Why Docker Compose:**
- **Single VPS** — the entire stack runs on one machine. Kubernetes is designed for multi-node clusters and is absurd overhead for a single-server deployment.
- **Declarative** — `docker-compose.yml` is the entire infrastructure definition. Anyone can read it.
- **Isolation** — each service gets its own container, filesystem, and network namespace. A bug in the image processor can't crash the API.
- **Reproducible** — `docker compose up` gives you an identical environment on any Linux machine.

**When to outgrow it:** If we need horizontal scaling (multiple API instances), switch to Docker Swarm (simple) or Kubernetes (complex). This is a Task 10+ concern at 50K+ users.

---

## Reverse Proxy: Nginx

**Chosen over:** Caddy, Traefik, HAProxy

**Why Nginx:**
- **~2 MB memory** — lowest footprint of any reverse proxy
- **Mature rate limiting** — `limit_req_zone` with shared memory zones, battle-tested
- **Static file serving** — serves pre-built assets without hitting Node.js
- **WebSocket proxy** — handles `Upgrade` headers correctly
- **Ubiquitous** — every hosting guide, every security tutorial assumes Nginx

**Why not Caddy:** Caddy's automatic TLS (via Let's Encrypt) is genuinely better than Nginx's manual certbot setup. The config syntax is simpler. **We should evaluate Caddy at Task 10 (production hardening)** when TLS configuration becomes critical. For development, Nginx is fine.

**Why not Traefik:** Traefik is designed for dynamic container discovery in Kubernetes/Swarm. For a static Docker Compose setup, it's overcomplicated.

---

## Testing: Vitest

**Chosen over:** Jest, Node test runner, Mocha

**Why Vitest:**
- **Native ESM** — our codebase is ESM (`"type": "module"`). Jest's ESM support is experimental and flaky. Vitest is ESM-first.
- **Fast** — Vite-powered transform pipeline, HMR-like watch mode
- **Compatible** — same `describe/it/expect` API as Jest, zero learning curve
- **TypeScript** — no `ts-jest` config, just works

---

## Summary Table

| Layer | Choice | Runner-up | Switch trigger |
|-------|--------|-----------|----------------|
| Runtime | Node.js 20 | Go | >2GB RAM or can't handle peak RPS |
| API | Fastify 5 | Hono | Never (Fastify is the right tool) |
| Frontend | Next.js 14 | Astro / htmx | UI stays simple after Task 4 |
| Database | PostgreSQL 16 | — | Never |
| Cache | Redis 7 | — | Never |
| Storage | MinIO | Backblaze B2 | Outgrow local disk |
| Passwords | Argon2id | — | Never |
| JWT | jose | — | Never |
| Package mgr | pnpm | — | Never |
| Containers | Docker Compose | Swarm/K8s | Multi-node needed |
| Proxy | Nginx | Caddy | Task 10 (TLS setup) |
| Testing | Vitest | — | Never |
