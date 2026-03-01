# ── base ──────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/workers/package.json packages/workers/
RUN pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/ ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/workers packages/workers
# Build shared first (workers depends on it at compile time)
RUN pnpm --filter @bartr/shared build
RUN pnpm --filter @bartr/workers build

# ── runner (production) ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Copy root package.json + workspace config
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/workers/node_modules ./packages/workers/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy shared package (compiled dist + package.json)
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/

# Copy compiled workers (dist only, no .ts source)
COPY --from=build /app/packages/workers/dist ./packages/workers/dist
COPY --from=build /app/packages/workers/package.json ./packages/workers/

WORKDIR /app/packages/workers
CMD ["node", "dist/index.js"]
