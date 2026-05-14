# Burmalda — Production deployment guide (free tier)

This guide walks you from zero to a live Burmalda instance using only free services.

## Architecture

```
                ┌──────────────────────┐
                │  Vercel (Next.js)    │  https://yourapp.vercel.app
                └──────────┬───────────┘
                           │ HTTPS / WSS
                           ▼
                ┌──────────────────────┐
                │  Fly.io (NestJS)     │  https://burmalda-api.fly.dev
                │  REST + Socket.io    │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  Neon (Postgres)     │
                └──────────────────────┘
```

| Service | What | Free tier |
| ------- | ---- | --------- |
| Vercel  | Next.js frontend | Hobby plan, custom domains free |
| Fly.io  | NestJS backend (REST + WebSocket) | 3 shared-cpu-1x VMs, 256–512 MB |
| Neon    | PostgreSQL                       | 0.5 GB storage, no sleeping |
| (Optional) Upstash | Redis for Socket.io scaling | 10k commands/day |

---

## 1. Provision Postgres on Neon

1. Go to https://neon.tech → Sign up with GitHub.
2. Create project → pick a region close to your Fly region (e.g. `Europe (Frankfurt)`).
3. Copy the connection string. It looks like:
   ```
   postgres://user:pass@ep-cool-name-123.eu-central-1.aws.neon.tech/burmalda?sslmode=require
   ```
   You'll use this as `DATABASE_URL`.

## 2. Deploy API to Fly.io

### Install Fly CLI

```bash
# Linux/Mac
curl -L https://fly.io/install.sh | sh

# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

### Sign up / log in

```bash
fly auth signup    # or fly auth login
```

### Launch the app

From the **repository root**:

```bash
fly launch \
  --name burmalda-api \
  --region fra \
  --dockerfile apps/api/Dockerfile \
  --copy-config \
  --no-deploy \
  --yes
```

This will:
- create a Fly app named `burmalda-api`
- use `apps/api/fly.toml` and `apps/api/Dockerfile`
- not deploy yet (we need to set secrets first)

### Set secrets

```bash
fly secrets set \
  DATABASE_URL="postgres://...neon.tech/burmalda?sslmode=require" \
  JWT_ACCESS_SECRET="$(openssl rand -hex 32)" \
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
  CORS_ORIGIN="https://YOUR_VERCEL_DOMAIN.vercel.app" \
  --app burmalda-api
```

### Deploy

From the repo root:

```bash
fly deploy --app burmalda-api --dockerfile apps/api/Dockerfile
```

The `Dockerfile` runs `prisma migrate deploy` on container start, so your schema is automatically applied to Neon on first boot.

### Verify

```bash
curl https://burmalda-api.fly.dev/api/health
# → {"ok":true,"service":"burmalda-api","ts":"..."}
```

## 3. Configure Vercel frontend

In Vercel project → **Settings → Environment Variables**:

```
NEXT_PUBLIC_API_URL = https://burmalda-api.fly.dev
NEXT_PUBLIC_WS_URL  = https://burmalda-api.fly.dev
```

Then **Deployments → ⋯ → Redeploy**.

## 4. Seed demo data (optional)

```bash
fly ssh console -C "sh -c 'cd /app/apps/api && npx prisma db seed'" --app burmalda-api
```

You can now log in at your Vercel URL using:
- `alice@burmalda.app` / `password123`
- `bob@burmalda.app`   / `password123`

## 5. Custom domain (optional)

### Free options

| Provider | Domain | How |
| -------- | ------ | --- |
| is-a.dev | `yourname.is-a.dev` | PR to https://github.com/is-a-dev/register |
| js.org   | `yourname.js.org`   | PR to https://github.com/js-org/js.org |
| eu.org   | `yourname.eu.org`   | Apply at https://nic.eu.org (1–2 weeks) |

### Cheap (~$1/year)

- Porkbun `.xyz`, Namecheap `.click`, etc.

### Connect to Vercel

Vercel → Project → **Settings → Domains** → Add → enter your domain.
Vercel will tell you which DNS records to add (CNAME).

For the API, you can also map e.g. `api.yourdomain.com` to Fly:

```bash
fly certs create api.yourdomain.com --app burmalda-api
```

Then add the CNAME shown by Fly to your DNS provider.

## Troubleshooting

### Build fails with `ERR_INVALID_THIS` (Vercel)

This is a pnpm 9.0 bug on Node 22. We force pnpm 9.15.4 via `npx` in `vercel.json`. If you still see it, ensure your Vercel project does NOT override the install/build commands from the dashboard.

### WebSocket disconnects every minute

Make sure `auto_stop_machines = false` in `apps/api/fly.toml`. Free tier with auto-stop will kill long-lived connections.

### Cannot connect to Postgres on first boot

Neon's free tier puts databases to sleep after some inactivity. The first request wakes them up, taking 1–3 seconds. Subsequent requests are fast.
