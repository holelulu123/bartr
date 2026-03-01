# ── base ──────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/ ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/web packages/web
# Build shared first (web imports from it)
RUN pnpm --filter @bartr/shared build
RUN pnpm --filter @bartr/web build
# Ensure public dir exists (may not in some setups) so COPY in runner won't fail
RUN mkdir -p /app/packages/web/public

# ── runner (production) ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone output mirrors the monorepo structure:
#   .next/standalone/
#     ├── node_modules/
#     ├── package.json
#     └── packages/web/
#         ├── server.js
#         ├── .next/
#         ├── node_modules/
#         └── package.json

# Copy the standalone build (includes minimal node_modules + server.js)
COPY --from=build /app/packages/web/.next/standalone ./

# Copy static assets (not included in standalone output)
COPY --from=build /app/packages/web/.next/static ./packages/web/.next/static

# Copy public directory (favicon, robots.txt, etc.)
COPY --from=build /app/packages/web/public ./packages/web/public

WORKDIR /app/packages/web
EXPOSE 3000
CMD ["node", "server.js"]
