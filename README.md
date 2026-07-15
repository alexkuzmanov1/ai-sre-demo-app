# mini-shop

A small but realistic NestJS + MongoDB + Redis API. It is the **patient**
application for an AI incident-responder demo: scripted "bad commits" break it
in specific, isolated ways, the app reports every unhandled error to a webhook,
and every deploy is logged to a single timeline the responder correlates
against. This repo is the **healthy baseline**.

## Stack

- NestJS 10 + TypeScript (`strict`)
- MongoDB via `@nestjs/mongoose`
- Redis via `ioredis` (product caching)
- Docker Compose for MongoDB + Redis
- pnpm

## Quick start

```bash
pnpm install
cp .env.example .env          # then edit .env if needed
docker compose up -d          # MongoDB + Redis
pnpm seed                     # drops + reseeds collections, syncs indexes
pnpm start:dev                # watch mode on http://localhost:3000
```

In a second terminal:

```bash
pnpm traffic                  # continuous realistic traffic
```

> **Environment:** all config is read from `.env` (copied from `.env.example`).
> Secrets belong in `.env` (git-ignored) — never in `.env.example`, which is
> committed. To point MongoDB at Atlas, set `MONGODB_URI` in `.env`:
> `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shop?retryWrites=true&w=majority`

## Endpoints

| Method | Path                    | Behavior                                                                 |
| ------ | ----------------------- | ------------------------------------------------------------------------ |
| GET    | `/users/:id/summary`    | `{ id, name, currency, orderCount, totalSpentCents }`                    |
| GET    | `/orders`               | All orders, lean, sorted by `createdAt` desc                             |
| POST   | `/orders`               | Body `{ userId, productId, qty }` → creates an order                     |
| GET    | `/products`             | Redis-cached (`products:all`, TTL 30s), falls back to Mongo on miss      |
| GET    | `/health`               | `{ status: 'ok' }`                                                       |
| POST   | `/debug/throw`          | Throws on purpose, to exercise the error-reporting pipeline              |

- **Currency** is resolved defensively via `user.preferences?.currency ?? 'EUR'`
  in an isolated function (`resolveCurrency`) in `src/users/users.service.ts`.
  A null-preferences user returns `"EUR"`.
- **Order numbers** come from `generateOrderNumber()` in
  `src/orders/orders.service.ts` (`ORD-<epoch-ms>-<4 random>`). `orderNumber`
  has a **unique index** (`orderNumber_1`).
- **Redis** connection settings live **only** in `src/config/redis.config.ts`.

> These three spots are load-bearing for the demo scenarios and must keep their
> exact shape — do not "simplify" them.

## Error reporting

A global exception filter (`src/common/error-reporter.filter.ts`) catches every
unhandled exception. It:

1. Logs the error through Nest.
2. Fire-and-forget POSTs an `ErrorEvent` to `RESPONDER_WEBHOOK_URL`:
   ```json
   {
     "service": "mini-shop",
     "message": "...",
     "stack": "...",
     "route": "/orders",
     "method": "POST",
     "timestamp": "ISO-8601",
     "requestId": "uuid",
     "meta": { "statusCode": 500 }
   }
   ```
3. Returns a normal error JSON to the client.

Reporting failures (webhook down / no URL) are logged and swallowed — the filter
never crashes the app or blocks the response.

Quick test with a throwaway listener:

```bash
# terminal A — capture incidents
node -e "require('http').createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{console.log(b);res.end('ok')})}).listen(4000)"
# terminal B
curl -X POST http://localhost:3000/debug/throw
```

## Deploy history

`deploys.json` (created at runtime, git-ignored) is the single deploy timeline.
An entry `{ sha, timestamp }` is appended:

- on every app boot,
- by `pnpm deploy:log`,
- by every `demo.sh` break / fix / revert.

## Break / fix / revert

All git + deploy operations go through **`scripts/demo.sh`** so the human and
the AI SRE behave identically. Scenarios are a fixed, closed set:
`null-check`, `order-number`, `redis-config`.

> The `break/<scenario>` and `fix/<scenario>` branches are created in a later
> step. This baseline only ships the orchestration script.

```bash
pnpm demo:break <scenario>   # merge break/<scenario> into main (the "bad deploy")
pnpm demo:fix   <scenario>   # merge fix/<scenario> into main (the remediation)
pnpm demo:revert             # revert the most recent commit on main
pnpm demo:status             # branch, last 3 commits, deploys tail, active scenario
```

- `break`/`fix` reject any scenario outside the three names (and bare invocation)
  with a usage line, exiting 1 **without touching git**.
- `break` fails loudly if `break/<scenario>` doesn't exist.
- `fix` fails loudly if `fix/<scenario>` doesn't exist, pointing you at `revert`.
- `revert` handles both merge commits (`revert -m 1`) and plain commits, and
  never depends on any branch existing — the reliable fallback.
- Each of break / fix / revert appends exactly one entry to `deploys.json`.

**Hot reload:** run with `pnpm start:dev` (watch mode). Every break / fix /
revert merge changes files under `src/`, so Nest recompiles and hot-reloads
automatically — no manual restart needed.

## Traffic generator

`pnpm traffic` loops every 3s hitting `/users/:id/summary` (random seeded id,
including null-preferences users), `/orders`, and `/products`, and every ~10s
POSTs a new order with a random valid user/product. It logs `METHOD path ->
status` and never exits on errors.

## Scripts

| Script             | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `pnpm start:dev`   | Run in watch mode                          |
| `pnpm build`       | Compile with `nest build`                  |
| `pnpm lint`        | ESLint over `src` + `scripts`              |
| `pnpm seed`        | Drop + reseed collections, `syncIndexes()` |
| `pnpm traffic`     | Continuous traffic generator               |
| `pnpm deploy:log`  | Append a deploy entry manually             |
| `pnpm demo:break`  | `demo.sh break`                            |
| `pnpm demo:fix`    | `demo.sh fix`                              |
| `pnpm demo:revert` | `demo.sh revert`                           |
| `pnpm demo:status` | `demo.sh status`                           |
