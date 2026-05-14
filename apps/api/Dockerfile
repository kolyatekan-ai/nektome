# Use debian-slim (glibc) instead of alpine — more reliable with bcrypt
# native bindings, prisma engines.

# ---- builder ----
FROM node:20-slim AS builder
WORKDIR /app

# Native build deps + openssl (required by Prisma engine)
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
       python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm i -g pnpm@9.15.4

ENV NODE_OPTIONS="--max-old-space-size=420"

# workspace manifests first for cache layer
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --no-frozen-lockfile

# sources
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# generate Prisma client + compile NestJS
RUN pnpm --filter @burmalda/api db:generate
RUN pnpm --filter @burmalda/api build

# ---- runner ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=380"

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm i -g pnpm@9.15.4

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 4000

# On every boot: sync the schema with the database via 'prisma db push'.
# Idempotent — if the DB already matches the schema, nothing happens.
# We use 'db push' (not 'migrate deploy') because we don't ship migration
# files in the MVP — the prisma schema is the source of truth.
CMD ["sh", "-c", "cd apps/api && npx prisma db push --skip-generate --accept-data-loss && cd /app && node apps/api/dist/main.js"]
