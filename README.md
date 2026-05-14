# Burmalda

A Discord-like real-time messenger built as a TypeScript monorepo.

> **MVP v1.0** — Auth, servers, channels, real-time text messages, typing indicators, optimistic UI.

## Stack

| Layer        | Tech                                                          |
| ------------ | ------------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router) + React 18 + TypeScript               |
| UI           | Tailwind CSS (custom Discord-like palette)                    |
| State        | Zustand                                                       |
| Realtime     | Socket.io client                                              |
| Backend      | NestJS 10 (REST + WebSocket gateway)                          |
| Realtime     | Socket.io + (Redis adapter ready for horizontal scaling)      |
| ORM          | Prisma 5                                                      |
| Database     | PostgreSQL 16                                                 |
| Cache/PubSub | Redis 7                                                       |
| Auth         | JWT (access + refresh) with Passport, bcrypt password hashing |
| Monorepo     | pnpm workspaces                                               |

## Project layout

```
.
├── apps/
│   ├── api/          # NestJS backend (REST + Socket.io gateway)
│   │   ├── prisma/   # Prisma schema + seed
│   │   └── src/
│   │       ├── auth/
│   │       ├── channels/
│   │       ├── messages/
│   │       ├── prisma/
│   │       ├── realtime/
│   │       ├── servers/
│   │       └── users/
│   └── web/          # Next.js frontend
│       └── src/
│           ├── app/         # App Router pages (login, register, /app)
│           ├── components/  # ServerSidebar, ChannelSidebar, ChatView
│           ├── lib/         # api client + socket
│           └── store/       # Zustand stores (auth, app)
├── packages/
│   └── shared/       # shared TypeScript types & WS event names
├── docker-compose.yml  # postgres + redis
└── pnpm-workspace.yaml
```

## Quickstart

Prerequisites: **Node 20+**, **pnpm 9+**, **Docker** (for Postgres + Redis).

```bash
# 1. Install deps
pnpm install

# 2. Create your .env (copy template)
cp .env.example .env
cp .env.example apps/api/.env       # NestJS reads from apps/api/.env via @nestjs/config
cp .env.example apps/web/.env.local # Next.js reads NEXT_PUBLIC_* from here

# 3. Start Postgres + Redis
pnpm docker:up

# 4. Generate Prisma client + run migrations
pnpm db:generate
pnpm db:migrate          # creates initial migration "init"

# 5. (optional) Seed demo data: alice@burmalda.app / password123, bob@burmalda.app / password123
pnpm db:seed

# 6. Run API + Web in parallel
pnpm dev
```

- API:  http://localhost:4000  (health: `/api/health`)
- Web:  http://localhost:3000

## Database schema (Prisma)

Models: **User**, **Server**, **Channel**, **Message**, **Member**, **Role**, **MemberRole**, **Attachment**, **Reaction**.

Key relationships:

```
User ─┬─ owns ─▶ Server
      ├─ Member ─▶ Server  (many-to-many membership with optional nickname + roles)
      └─ writes ─▶ Message

Server ─┬─ Channel ─▶ Message ─┬─ Attachment
        └─ Role ────────┐      └─ Reaction
                        ▼
                   MemberRole (M↔N: Member ↔ Role)
```

`Role.permissions` is a `BigInt` bitmask (Discord-style): VIEW_CHANNEL, SEND_MESSAGES, MANAGE_MESSAGES, KICK, BAN, MANAGE_CHANNELS, MANAGE_SERVER, ADMINISTRATOR.

## Real-time protocol

WebSocket connection (Socket.io):

```
client → server     handshake auth: { token: <accessJWT> }
server → client     auto-join rooms: server:<id>, channel:<id>, user:<id>
```

| Direction | Event                 | Payload                                         |
| --------- | --------------------- | ----------------------------------------------- |
| → server  | `channel:join`        | `{ channelId }`                                 |
| → server  | `channel:leave`       | `{ channelId }`                                 |
| → server  | `channel:typing:start`| `{ channelId }`                                 |
| ← server  | `message:new`         | `{ message: MessageDto }`                       |
| ← server  | `message:edit`        | `{ message: MessageDto }`                       |
| ← server  | `message:delete`      | `{ channelId, messageId }`                      |
| ← server  | `channel:typing`      | `{ channelId, userId, username }`               |

Flow for sending a message:

```
1. Client → POST /api/channels/:id/messages       (REST, persisted to Postgres)
2. Server → INSERT message + broadcast 'message:new' to room channel:<id>
3. All connected clients in that room receive the event and append to UI
```

To scale horizontally, attach the Socket.io Redis adapter so any API node can broadcast cross-instance.

## REST API surface (MVP)

Public:

- `POST /api/auth/register` — `{ email, username, displayName, password }`
- `POST /api/auth/login`    — `{ email, password }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh`  — `{ refreshToken }`
- `GET  /api/health`

Authenticated (`Authorization: Bearer <accessToken>`):

- `GET  /api/auth/me`
- `GET  /api/users/:id`
- `POST /api/servers`                             — create a server (auto-creates `#general` + `@everyone`)
- `GET  /api/servers/me`                          — list servers I'm a member of
- `GET  /api/servers/:id`                         — server detail (channels + members)
- `POST /api/servers/join/:inviteCode`
- `POST /api/servers/:id/channels`                — create text channel (owner-only in MVP)
- `GET  /api/channels/:id/messages?before=&limit=`
- `POST /api/channels/:id/messages`
- `PATCH /api/messages/:id`
- `DELETE /api/messages/:id`

## Roadmap (post-MVP)

- DM channels (1-to-1 + group)
- File uploads via S3/MinIO presigned URLs
- Reactions on messages
- Voice channels (WebRTC + LiveKit/mediasoup)
- Push notifications (Web Push)
- Full-text search (Postgres FTS or Elasticsearch)
- Webhooks + bot API

## License

MIT
