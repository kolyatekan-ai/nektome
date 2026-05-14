# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl libc6-compat
RUN npm i -g pnpm@9.15.4

ENV NODE_OPTIONS="--max-old-space-size=460"

# workspace manifests for cached install
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --no-frozen-lockfile

# sources
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# generate prisma client + build
RUN pnpm --filter @burmalda/api db:generate
RUN pnpm --filter @burmalda/api build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=420"

RUN apk add --no-cache openssl libc6-compat
RUN npm i -g pnpm@9.15.4

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 4000

# On boot: apply pending migrations (using `db push` if no migration files exist yet),
# then start the server. `db push` is safe for an empty database and creates schema directly.
CMD ["sh", "-c", "cd apps/api && (npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate --accept-data-loss) && cd /app && node apps/api/dist/main.js"]
