# ── base ──────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────
FROM base AS build
RUN apk add --no-cache git
COPY --from=deps /app/ ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/api packages/api
COPY .git .git
RUN git describe --tags --abbrev=0 2>/dev/null > VERSION || echo "" > VERSION
RUN rm -rf .git
# Build shared first (api depends on it at compile time)
RUN pnpm --filter @bartr/shared build
RUN pnpm --filter @bartr/api build

# ── runner (production) ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Copy root package.json + workspace config (pnpm needs it for workspace resolution)
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy node_modules (includes workspace symlinks and native binaries like sharp/argon2)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy shared package (compiled dist + package.json)
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/

# Copy compiled API (dist only, no .ts source)
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/package.json ./packages/api/
COPY --from=build /app/VERSION ./VERSION

# Copy migration SQL files (runtime: migration runner reads ../../db/migrations from cwd)
COPY db/migrations ./db/migrations

WORKDIR /app/packages/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
