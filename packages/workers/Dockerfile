FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/workers/package.json packages/workers/
RUN pnpm install --frozen-lockfile

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/workers/node_modules ./packages/workers/node_modules
COPY packages/shared packages/shared
COPY packages/workers packages/workers
COPY tsconfig.base.json ./

WORKDIR /app/packages/workers
CMD ["pnpm", "dev"]
