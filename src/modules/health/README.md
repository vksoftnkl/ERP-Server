# Health

Single health-check endpoint that reports API liveness together with the status of its
**database** and **Redis cache** dependencies.

- **Base route:** `health` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Health`
- **Auth:** `@Public()` — **unauthenticated**, no bearer token required
- **Caching:** `@CacheTTL(0)` — the response is never cached
- **Dependencies checked:** Postgres via [PrismaService](../../database/prisma/prisma.service.ts) · Redis via [RedisCacheService](../../common/redis/redis-cache.service.ts)

## Files

| File | Purpose |
| --- | --- |
| [health.module.ts](health.module.ts) | Module wiring — registers the controller and service |
| [health.controller.ts](health.controller.ts) | HTTP route + Swagger docs; maps a down dependency to `503` |
| [health.service.ts](health.service.ts) | Probes the database and cache, builds the status payload |
| [dto/health-response.dto.ts](dto/health-response.dto.ts) | Swagger response models |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Return API health status. Returns `200` when healthy, `503` when a dependency is down. |

## What each check verifies

- **Database** — runs `SELECT 1` through `prisma.$queryRawUnsafe`. Success → `up`; any thrown
  error → `down`.
- **Cache** — only probed when `redisCacheService.isEnabled()` is true; then calls
  `redisCacheService.ping()`. Success → `up`, thrown error → `down`. When Redis is not enabled the
  cache is reported as `disabled` (never probed).

## Response shape

`HealthResponseDto` (also the `200` body returned by the service):

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `'ok'` \| `'degraded'` | `ok` only when database is `up` **and** cache is not `down`; otherwise `degraded`. |
| `timestamp` | `string` | ISO-8601 timestamp of the check (`new Date().toISOString()`). |
| `database.status` | `'up'` \| `'down'` | Result of the `SELECT 1` probe. |
| `cache.status` | `'up'` \| `'down'` \| `'disabled'` | Result of the Redis ping, or `disabled` when Redis is off. |

## Status codes

- **`200 OK`** — returns the `HealthResponseDto` payload (may still be `degraded`, e.g. cache
  `disabled` while the database is `up`).
- **`503 Service Unavailable`** — thrown (`ServiceUnavailableException`) when `database.status`
  **or** `cache.status` is `down`. The exception body carries the same status payload; documented
  in Swagger via `HttpErrorResponseDto`.
