# ERP Server — Architecture, System Design & Performance Plan

---

## 1. Overview

The ERP server is a **NestJS 10 monolith** serving a multi-branch retail/wholesale ERP. It exposes a versioned REST API (`/api/v1/*`), backed by **PostgreSQL 14+** via **Prisma 6**, with **Redis** for HTTP-level caching. All endpoints are JWT-protected except explicitly `@Public` routes.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript 5.7 |
| Framework | NestJS 10.4 (Express adapter) |
| ORM | Prisma 6.19 |
| Database | PostgreSQL 14+ (11 schemas) |
| Cache | Redis 5 via `cache-manager` + Keyv |
| Auth | Custom HMAC-SHA256 JWT (no Passport) |
| Validation | class-validator + class-transformer |
| API Docs | Swagger/OpenAPI (per-module) |
| Rate Limiting | @nestjs/throttler (100 req / 60s default) |
| Security | Helmet, Compression, CORS |
| Logging | File logger (app.log / error.log with rotation) |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Request                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │  Express Middleware     │
          │  Helmet / Compression   │
          │  CORS / Body Parser     │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  RequestContextMiddleware│ ← AsyncLocalStorage (IP, userId)
          │  RequestLoggerMiddleware │ ← structured request log
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Guards                 │
          │  AccessTokenGuard (JWT) │
          │  ThrottlerGuard         │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Interceptors           │
          │  HttpCacheInterceptor   │ ← Redis GET cache
          │  CacheInvalidation      │ ← POST/PUT/DELETE bust
          │  TimeoutInterceptor     │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Controller + DTO       │
          │  GlobalValidationPipe   │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Service Layer          │
          │  (business logic)       │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  PrismaService          │
          │  (11 DB schemas)        │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  PostgreSQL             │
          │  + Redis (cache layer)  │
          └─────────────────────────┘
```

---

## 4. Module Breakdown

### 4.1 Domain Modules

| Module | Submodules | Responsibility |
|---|---|---|
| `auth` | — | Login, token issuance, session tracking |
| `users` | — | User CRUD, profile management |
| `inventory` | 17 | Items, categories, brands, pricing, tax, EAN, stock balance, batches, reorder, godowns |
| `stocks` | — | Physical stock, opening stock, batch ledger |
| `accountsModule` | 9 | GL accounts, ledgers, vouchers, tenders, bank accounts, employee masters |
| `sales` | — | Customers, groups, areas, cities, states, loyalty schemes |
| `purchase` | — | Suppliers, supplier groups |
| `settings` | — | Branch/company masters, GSP config |
| `fixed` | 11 | Banks, devices, menus, price levels, HSN codes, state codes, UI column config |
| `master` | — | Batch prefixes, widget masters |
| `audit-log` | — | Change tracking with screen/action audit |
| `health` | — | Readiness & liveness checks |
| `master-lookup` | — | Reference data service |
| `grid-details` / `grid-columns` | — | Dynamic SQL grid builder |
| `dropdown-details` / `dropdown-columns` | — | Dynamic dropdown configuration |

### 4.2 Cross-Cutting Infrastructure

| Component | Location | Purpose |
|---|---|---|
| `AllExceptionsFilter` | `common/filters` | Standardized error responses |
| `HttpCacheInterceptor` | `common/interceptors` | Redis GET cache, `X-Cache` header |
| `CacheInvalidationInterceptor` | `common/interceptors` | Bust cache on mutations |
| `TimeoutInterceptor` | `common/interceptors` | Request timeout enforcement |
| `RequestContextMiddleware` | `common/middleware` | AsyncLocalStorage: IP + userId |
| `RequestContextService` | `common/request-context` | Injectable context accessor |
| `ConfiguredGridSqlService` | `common/configured-grid-sql` | Safe dynamic SQL execution |
| `FileLoggerService` | `common/logging` | app.log / error.log rotation |
| `SequenceModule` | `common/Sequence` | Batch prefix ID generation |
| `RedisModule` | `common/redis` | Cache manager setup |

---

## 5. Database Design

### 5.1 Multi-Schema Layout (PostgreSQL)

```
public       → users, company, branch, widgets, customer rates
accounts     → GL accounts, ledgers, vouchers (header/detail/bills/cheques), tenders
inventory    → items, brands, categories, sections, pricing, tax, EAN, stock balance, batches
stock        → stock adjustments, opening stock, batch stock ledger
sales        → customers, areas, cities, states, loyalty, customer groups
purchase     → suppliers, supplier groups
settings     → GSP config, company group masters
fixed        → banks, devices, menus, price levels, HSN codes, state codes, UI config
grid         → custom grid SQL definitions and columns
audit        → audit logs, login sessions
reports      → (reserved)
transport    → (reserved)
```

### 5.2 Common Schema Patterns

- **Primary keys**: UUID v7 via `dbgenerated()` — globally unique, time-ordered
- **Soft deletes**: `isDeleted` boolean across all entities (no hard deletes)
- **Audit fields**: `createdOn`, `createdBy`, `modifiedOn`, `modifiedBy`, `syncDate` on every entity
- **Multi-tenancy**: `companyId` + `branchId` FKs present in most entities (application-level, not schema-level enforcement)
- **Hierarchy**: AccountGroup uses self-referential `accGroupParentId` + `accGroupChildIds`
- **Indexes**: FK columns indexed (e.g., `idx_acc_group_company_id`, `idx_acc_group_parent_id`)

### 5.3 Entity Relationship Sketch (Key Domains)

```
Company (1) ──< Branch (many)
Branch ──< ItemMaster ──< ItemPrice
                     ──< ItemTax
                     ──< EANCode
                     ──< BatchStock

Customer ──< SalesInvoice (future)
Supplier ──< PurchaseOrder (future)

AccountGroup (self-ref) ──< AccountLedger
AccountLedger ──< VoucherHeader ──< VoucherDetail
```

---

## 6. Authentication & Authorization

### 6.1 Flow

```
Client → POST /api/v1/auth/login
       ← { accessToken, refreshToken }

Client → GET /api/v1/* 
         Authorization: Bearer <accessToken>
       → AccessTokenGuard verifies HMAC-SHA256 signature
       → SessionService validates token still active in DB
       → User ID injected into AsyncLocalStorage
```

### 6.2 Token Spec

| Field | Value |
|---|---|
| Algorithm | Custom HMAC-SHA256 (not standard RS256/HS256 via `jsonwebtoken`) |
| Access TTL | 15 min (configurable `JWT_ACCESS_EXPIRY`) |
| Refresh TTL | 7 days (configurable `JWT_REFRESH_EXPIRY`) |
| Claims | `sub`, `user_name`, `sid`, `iat`, `exp`, `typ` |
| Session store | `audit.UserLoginSession` table |

### 6.3 Issues & Recommendations

- **Risk**: Custom crypto implementation is harder to audit than battle-tested libraries. Migrate to `@nestjs/jwt` + standard HS256/RS256.
- **Risk**: Session validity checked per request against DB — adds latency. Move session blacklist to Redis with TTL matching token expiry.
- **Gap**: No role-based access control (RBAC) observed. Recommend adding a `roles` claim and role guard for module-level authorization.

---

## 7. Caching Architecture

### 7.1 Current Design

```
GET Request → HttpCacheInterceptor
            → key = pathname + sorted(queryParams)
            → Redis HIT  → return cached JSON + X-Cache: HIT
            → Redis MISS → execute handler → store in Redis → X-Cache: MISS

POST/PUT/DELETE → CacheInvalidationInterceptor
               → pattern-match key prefixes → Redis DEL
```

### 7.2 Gaps & Recommendations

| Issue | Recommendation |
|---|---|
| No per-user cache isolation | Append `userId` to cache key for user-scoped data |
| No cache TTL per resource type | Define TTLs: static master data (1hr), transactional data (1min) |
| Wild-pattern cache invalidation can over-bust | Scope invalidation keys to module prefix |
| Redis unavailable → fallback to no-op (silent miss) | Alert on Redis failure; degraded-mode flag |
| No cache warm-up on startup | Pre-populate frequently accessed master data after startup |

---

## 8. Performance Analysis

### 8.1 Current Strengths

- HTTP-level caching avoids DB hits for repeated GET calls
- Prisma `.select()` fetches only required columns
- Pagination enforced (max 100 per page) prevents unbounded queries
- Indexes on FK columns reduce join cost
- Compression middleware reduces payload size
- Request timeout interceptor prevents runaway queries

### 8.2 Bottlenecks & Fixes

#### 8.2.1 N+1 Query Risk
Prisma eager loading must be explicit. If services call `findMany()` and then loop to fetch related records, N+1 occurs.
- **Fix**: Audit all service methods for nested loops; use Prisma `include` or `select` with nested relations.

#### 8.2.2 Offset Pagination at Scale
`skip = (page-1) * limit` degrades as page number grows (full table scan up to offset).
- **Fix**: For large datasets (audit log, stock ledger), move to **cursor-based pagination** using UUID v7 (time-ordered).

#### 8.2.3 ConfiguredGridSqlService — Raw SQL Risk
Dynamic SQL is executed directly. Forbidden-token checks are string-based and can be bypassed.
- **Fix**: Move complex list queries to Prisma with parameterized filters. If raw SQL is necessary, use a strict allowlist of pre-approved query IDs, not runtime-composed SQL.

#### 8.2.4 No Connection Pool Tuning
Prisma uses a default connection pool. Under load, connections exhaust.
- **Fix**: Set `connection_limit` and `pool_timeout` in `DATABASE_URL`. Consider PgBouncer in transaction mode for horizontal scaling.

#### 8.2.5 Synchronous File Logging
`FileLoggerService` writes logs synchronously in the request path.
- **Fix**: Use async log writes (streams or a log queue). Consider structured JSON logging with Pino or Winston async transport.

#### 8.2.6 No Background Job Queue
Batch operations (e.g., stock reconciliation, audit log archival) run in the request thread.
- **Fix**: Introduce BullMQ (Redis-backed) for async job processing.

---

## 9. Scalability Design

### 9.1 Current State
Single-instance monolith. No horizontal scaling primitives observed (sticky sessions not needed — JWT is stateless, but session DB check couples each request to the DB).

### 9.2 Scaling Roadmap

```
Phase 1 — Vertical & config hardening (low effort)
  ✓ Tune Prisma connection pool
  ✓ Enable PgBouncer
  ✓ Redis session blacklist (remove per-request DB session check)
  ✓ Async logging

Phase 2 — Horizontal readiness (medium effort)
  ✓ Stateless session validation (Redis only)
  ✓ BullMQ for background jobs
  ✓ Cursor-based pagination for high-volume endpoints
  ✓ Per-user cache keys

Phase 3 — Service extraction (high effort, only if needed)
  ✓ Extract inventory & stock as a dedicated service
  ✓ Extract audit log as an async consumer
  ✓ API Gateway (rate limiting, auth offloading)
```

---

## 10. Security Review

| Area | Current | Gap / Recommendation |
|---|---|---|
| Auth | Custom HMAC JWT | Migrate to standard `@nestjs/jwt` RS256 |
| Session | DB-backed | Move blacklist to Redis with TTL |
| Input validation | class-validator (global pipe) | Add input length caps on free-text fields |
| SQL injection | Prisma parameterized + forbidden-token check | Remove dynamic SQL grid; use Prisma only |
| Rate limiting | Throttler (100/60s) | Add stricter limits on auth endpoints (5/60s) |
| RBAC | None observed | Implement role-based guards |
| Secrets | Joi-validated env vars | Use secrets manager (Vault, AWS SSM) in prod |
| Audit trail | AuditLogService (DB) | Ensure audit table is append-only (no UPDATE/DELETE) |
| HTTPS | Optional (cert config present) | Enforce HTTPS in production; reject HTTP |
| Multi-tenancy | companyId/branchId FKs (app-level) | Add DB row-level security (RLS) for defense in depth |

---

## 11. Observability Gaps

| Gap | Recommendation |
|---|---|
| No distributed tracing | Add OpenTelemetry (OTEL) with Jaeger/Tempo |
| File-based logs only | Ship logs to Loki or CloudWatch |
| No metrics endpoint | Expose Prometheus metrics via `@nestjs/terminus` + `prom-client` |
| No alerting | Configure alerts on error rate, p99 latency, cache miss rate |
| Health check exists but basic | Add DB pool health, Redis health, disk space |

---

## 12. Environment & Config

### 12.1 Required Environment Variables

```
DATABASE_URL          (or DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS)
JWT_SECRET            (required — no default)
REDIS_ENABLED         (true/false)
REDIS_URL             (or REDIS_HOST / REDIS_PORT)
```

### 12.2 Optional / Defaults

```
PORT                  default 3000
API_PREFIX            default 'api'
THROTTLE_ENABLED      default true
JWT_ACCESS_EXPIRY     default 15m
JWT_REFRESH_EXPIRY    default 7d
BODY_LIMIT            default 10mb
```

### 12.3 Recommendations

- Use `.env.vault` or AWS SSM for `JWT_SECRET` in production — never commit to repo.
- Add `NODE_ENV` validation to fail fast on missing production-required vars.
- Separate staging and production Redis instances to avoid cross-environment cache pollution.

---

## 13. Immediate Action Items (Prioritized)

| Priority | Action | Effort |
|---|---|---|
| P0 | Migrate custom HMAC JWT to `@nestjs/jwt` (security) | Medium |
| P0 | Move session validation to Redis (performance + scale) | Medium |
| P1 | Add RBAC role guards | Medium |
| P1 | Replace dynamic SQL grid with Prisma parameterized queries | High |
| P1 | Tune Prisma connection pool + add PgBouncer | Low |
| P2 | Switch to cursor-based pagination for audit/stock endpoints | Medium |
| P2 | Add BullMQ for background jobs | Medium |
| P2 | Async file logging (Pino/Winston async transport) | Low |
| P3 | Add OpenTelemetry tracing | Medium |
| P3 | Prometheus metrics endpoint | Low |
| P3 | DB row-level security for multi-tenancy | High |
