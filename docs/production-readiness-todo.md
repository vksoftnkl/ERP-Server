# Production readiness TODO — ERP server

Audited against the working tree on branch `DEV-v1`, 2026-09-21. Every tick below was
checked against code, not assumed.

Legend:

- `[x]` — done, evidence linked
- `[~]` — partially done; what is missing is stated
- `[ ]` — not done

**Deployment reality check.** The checklist is written for AWS (EC2 + RDS). Today this app
runs on a self-managed VPS (`169.58.213.171`, Postgres on the same box, nginx + PM2 — see
[deploy/README.md](deploy/README.md)) and on CloudJiffy/Jelastic
([ecosystem.config.js](ecosystem.config.js)). AWS-specific rows are kept, but marked
**[AWS]** where they only become actionable after a move; the underlying concern (backups,
alarms, log shipping) still applies and is flagged on its own line.

---

## 1. Security (do first)

- [ ] **Secrets out of code and `.env` files on disk → Secrets Manager / SSM, loaded at boot.**
      Good news: no secret is committed — `.env` is gitignored and `git ls-files` shows no
      `.env*` tracked. But secrets live as plain files: `/opt/erp-server/app/.env` and
      `/root/.erp-deploy-secrets` (sourced by [deploy/deploy.sh](deploy/deploy.sh#L13)). No
      AWS SDK / SSM code exists anywhere in `src`.
- [x] **Validate env vars at startup with a schema.** Joi schema in
      [src/config/env.validation.ts](src/config/env.validation.ts), wired via
      `ConfigModule.forRoot({ validationSchema })` in
      [src/app.module.ts](src/app.module.ts#L126).
      *Caveat worth fixing:* `DB_USER`/`DB_PASSWORD`/`DB_NAME` carry working defaults
      (`erp_app`/`erp_password`/`erp_db`) and `DATABASE_URL` is `optional()`, so a prod box
      with no DB config still boots and then fails at query time. `JWT_SECRET` is correctly
      `required()` with `min(16)` outside tests.
- [x] **`helmet()` + CORS locked to real origins.** [src/main.ts](src/main.ts#L127) —
      helmet with an explicit CSP; in `NODE_ENV=production` only `CORS_ORIGINS` is used (the
      localhost dev defaults are not merged in), and `*` forces `credentials: false`.
- [x] **Global ValidationPipe with `whitelist`, `forbidNonWhitelisted`, `transform`.**
      [src/main.ts](src/main.ts#L187).
- [~] **Rate limiting on auth endpoints and globally.** Global `ThrottlerGuard` is
      registered ([src/app.module.ts](src/app.module.ts#L247), 100 req / 60 s default).
      Missing: no `@Throttle` override anywhere, so `POST /auth/login` gets the same generous
      budget as a grid read. **Also see the `trust proxy` row in §6 — behind nginx every
      request currently looks like it comes from one IP, so the throttler is effectively a
      global counter, not a per-client one.**
- [~] **JWT: short-lived access + refresh rotation; strong signing; revocation.**
      Done: access TTL 15 min, refresh TTL 7 days ([src/config/configuration.ts](src/config/configuration.ts));
      sessions are tracked by token hash ([src/modules/auth/auth-session.service.ts](src/modules/auth/auth-session.service.ts)).
      Missing: (a) **no refresh rotation** — `refresh()` returns the *same* refresh token it
      was given ([src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts#L171));
      (b) **no logout route** — `revokeAccessTokenSession()` exists but no controller calls
      it, and nothing revokes on password change;
      (c) tokens are signed by a hand-rolled HMAC-SHA256 in
      [src/modules/auth/token.service.ts](src/modules/auth/token.service.ts), not RS256 and
      not `@nestjs/jwt` (which is in `package.json` but unused for signing).
- [ ] **Tenant isolation enforced at the service/Prisma layer + a test proving cross-tenant
      reads fail.** `company_id` is a verified token claim and lands in `RequestContext`
      ([src/modules/auth/guards/access-token.guard.ts](src/modules/auth/guards/access-token.guard.ts#L39)),
      but only ~27 of ~105 services mention `company_id` at all, most queries are not scoped
      by it, and there is no cross-tenant test in [test/](test/). Treat this as the single
      largest security gap before a second customer shares a database.
- [~] **Role/permission guards on every route; default-deny.** Authentication is
      default-deny: `AccessTokenGuard` is a global `APP_GUARD`, opt-out only via `@Public()`.
      Missing: there is **no authorization layer at all** — `AccessTokenGuard` is the only
      `CanActivate` in the repo. `user_type` rides in the token but nothing enforces it, so
      any authenticated user can call any endpoint.
- [~] **Request body size limits; file upload type/size validation.** Body limit done
      (`REQUEST_BODY_LIMIT`, default 10 MB, applied to `json` and `urlencoded` —
      [src/main.ts](src/main.ts#L124); nginx allows 20 MB so the app returns the JSON error).
      Missing: `FileInterceptor('file')` / `FileInterceptor('sec_photo')` are used with **no
      `limits` and no `fileFilter`** — see
      [opening-stock-voucher.controller.ts:335](src/modules/stocks/opening-stock-voucher/opening-stock-voucher.controller.ts#L335)
      and [items-section-master.controller.ts:57](src/modules/Inventory/items-section-master/items-section-master.controller.ts#L57).
- [ ] **`npm audit` clean or triaged; Dependabot/Renovate on.** `npm audit --omit=dev`
      today: **14 vulnerabilities (12 high, 2 moderate)** — `@nestjs/core` (pulling in
      `@nestjs/cache-manager` and `@nestjs/swagger`) and `qs`. No `.github/dependabot.yml`;
      `.github/` contains only `copilot-instructions.md`.
- [~] **DB not publicly reachable, SSL enforced, least-privilege app user. [AWS: RDS]**
      Done: the app connects as the non-superuser `erp_app`, with grants applied explicitly
      ([deploy/grant-app-privileges.sql](deploy/grant-app-privileges.sql)) and a verifier
      script ([deploy/verify-db.sh](deploy/verify-db.sh)) that asserts `super=f`. A dedicated
      read-only role for user-configured grid SQL is supported via `DATABASE_READONLY_URL`
      ([src/database/pg/pg.service.ts](src/database/pg/pg.service.ts#L42)).
      Missing: `erp_app` still holds `CREATE` on every schema (the seed runner needs it), so
      it is not DDL-free; `DB_SSL` defaults to `false`; `DATABASE_READONLY_URL` is unset in
      practice (the service logs a warning saying so).
- [ ] **Host access: key-only SSH, restricted SG, prefer SSM Session Manager. [AWS]**
      Nothing in the repo describes or enforces the VPS SSH posture. Write it down in the
      runbook even before an AWS move.

## 2. Database & Prisma

- [~] **All schema changes via `prisma migrate deploy`; never `db push` or hand DDL.**
      Done: 350 migrations under [prisma/migrations/](prisma/migrations/), applied by
      [deploy/deploy.sh](deploy/deploy.sh#L50) as the `postgres` superuser, followed by a
      re-grant. No `db push` in any script.
      Missing: it is still a **manual** run of `deploy.sh` on the box, not CI (see §5), and
      the stock-engine DDL history shows hand-applied SQL has happened.
- [~] **Migration runs before the new app version starts; rollback plan per migration.**
      Done: migrations run before `pm2 reload`, and `DB_AUTO_MIGRATE`/`DB_AUTO_SEED` can run
      them before the port opens ([src/main.ts](src/main.ts#L118)).
      Missing: Prisma has no down-migrations here and no per-migration rollback note.
      `deploy.sh` only prints a *code* rollback (`git reset --hard $OLD_SHA`) on health-check
      failure — which will not undo a schema change.
- [ ] **Connection pooling (PgBouncer / RDS Proxy).** None. Prisma opens its own pool and
      [PgService](src/database/pg/pg.service.ts#L33) opens two more `pg.Pool`s with default
      `max` (10 each), with no `max`/`idleTimeoutMillis` tuning. Low risk today only because
      PM2 runs a single fork — it becomes urgent the moment cluster mode goes on (§3).
- [~] **Indexes reviewed for tenant + common filters; `EXPLAIN ANALYZE` the heaviest
      reports.** Migrations add indexes routinely and
      [docs/performance-load-testing.md](docs/performance-load-testing.md) exists, but there
      is no record of an index review against actual report queries, and no tenant-scoped
      composite indexes (because queries are not tenant-scoped — §1).
- [x] **Transactions around multi-table writes.** `prisma.$transaction(async (tx) => ...)`
      wraps the bill, sale-order, quotation, receipt and master write paths — e.g.
      [bill.service.ts:535](src/modules/sales/bill/bill.service.ts#L535),
      [sale-order.service.ts:731](src/modules/sales/sale-order/sale-order.service.ts#L731).
      Read-only user SQL runs in an explicit `BEGIN READ ONLY`
      ([pg.service.ts:101](src/database/pg/pg.service.ts#L101)).
- [x] **Soft deletes / audit columns consistent.** `*_is_deleted` / `created_by` /
      `modified_on` conventions run through the Prisma fragments, with a dedicated audit-log
      module ([src/modules/audit-log/](src/modules/audit-log/)) and an archival queue
      processor.
- [ ] **Automated backups, retention ≥ 7 days, PITR, and a *tested* restore. [AWS: RDS]**
      **Nothing.** No `pg_dump`, no backup script, no documented schedule anywhere in
      `deploy/`, `scripts/` or `docs/`. On a self-managed VPS this is the highest-severity
      operational gap on the list — a disk failure today loses the customer's books.
- [ ] **Slow query log enabled.** Not configured. `DB_LOGGING` turns on Prisma's client-side
      query log (all-or-nothing, not threshold-based); Postgres `log_min_duration_statement`
      is not set by anything in the repo.

## 3. Reliability & process

- [~] **PM2 cluster mode, config committed, survives reboot.** Committed: yes
      ([ecosystem.config.js](ecosystem.config.js), [deploy/ecosystem.vps.config.js](deploy/ecosystem.vps.config.js));
      `pm2 save` runs in [deploy.sh](deploy/deploy.sh#L71) and a systemd unit ships in
      [deploy/systemd/](deploy/systemd/).
      Missing: **both configs are `instances: 1, exec_mode: 'fork'`** — no cluster mode, so
      one CPU core serves all traffic and every deploy has a restart gap. Turning this on
      requires the connection-pool work in §2 first.
- [x] **Graceful shutdown.** `app.enableShutdownHooks()` ([src/main.ts](src/main.ts#L123)),
      Prisma `$disconnect()` on `onModuleDestroy`
      ([prisma.service.ts](src/database/prisma/prisma.service.ts#L22)), both `pg` pools
      `end()`ed ([pg.service.ts:122](src/database/pg/pg.service.ts#L122)), and
      `kill_timeout: 10000` in the VPS PM2 config.
      *Small gap:* `kill_timeout` is set on the VPS config only, not the CloudJiffy one.
- [~] **Health endpoints — `/health` (liveness) and `/ready` (DB).** `GET /api/v1/health`
      exists, is `@Public()`, checks Postgres and Redis, and 503s when either is down
      ([health.controller.ts](src/modules/health/health.controller.ts)); `deploy.sh` polls it
      before declaring success.
      Missing: no separate liveness/readiness split (a Redis blip marks the process *dead*,
      which under a real orchestrator would restart a perfectly serving app), and
      `@nestjs/terminus` is not used.
- [x] **Global exception filter, consistent shape, no stack traces to clients.**
      [all-exceptions.filter.ts](src/common/filters/all-exceptions.filter.ts) — stacks are
      logged server-side only; clients get `{ success, statusCode, message, path, timestamp }`.
- [~] **Timeouts on outbound calls, with retries / circuit breaker.** Inbound requests have a
      15 s timeout ([timeout.interceptor.ts](src/common/interceptors/timeout.interceptor.ts)).
      There is essentially one outbound call today — image fetch in
      [image.cache.ts:175](src/modules/settings/print-render/engine/renderers/image.cache.ts#L175) —
      and it does use an `AbortController` timeout, but has no retry or breaker. Revisit when
      GST / e-invoice / SMS integrations land; right now the row is near-N/A.
- [~] **Idempotency keys on payment/invoice-creating endpoints.** There is real idempotency
      at the database level — cheque clearing relies on the `ux_avh_src` unique index as an
      idempotency key ([cheque-voucher.helper.ts:288](src/modules/accountsModule/cheques/cheque-voucher.helper.ts#L288)),
      and voucher numbering is under an advisory lock.
      Missing: no HTTP `Idempotency-Key` support, so a client that retries a timed-out
      `POST /bill` or `/receipts` can still double-post.
- [x] **Background jobs off the request thread.** BullMQ is wired
      ([src/common/queue/queue.module.ts](src/common/queue/queue.module.ts)) with audit-log
      archival and stock-reconciliation processors.
      *Note:* `REDIS_ENABLED: 'false'` on CloudJiffy ([ecosystem.config.js](ecosystem.config.js#L44)),
      so queues are inert there until a Redis node exists.

## 4. Observability

- [ ] **Structured JSON logs with request ID and tenant ID; no `console.log`.**
      Logging is plain text lines to `logs/app.log` / `logs/error.log`
      ([file-logger.service.ts](src/common/logging/file-logger.service.ts)) — not JSON, no
      request ID (none is generated anywhere), and although `RequestContext` holds
      user/company/branch/device, **none of it reaches the log line**
      ([request-logger.middleware.ts](src/common/middleware/request-logger.middleware.ts)
      logs only method/url/status/duration). `nestjs-pino` is not installed. 4 stray
      `console.log` calls remain in `src`.
- [ ] **Logs shipped off the box, retention set. [AWS: CloudWatch]** Logs sit on local disk
      (`logs/`, `/opt/erp-server/logs/`) with no rotation policy in the repo and no shipper.
- [ ] **Error tracking (Sentry) with source maps.** Not installed. (`source-map-support` is a
      devDependency but no error tracker consumes it.)
- [ ] **Metrics: latency, error rate, DB pool usage, event loop lag.** None exposed — no
      `/metrics`, no Prometheus client, no StatsD.
- [ ] **Alarms on 5xx rate, p95 latency, DB CPU/connections/storage, disk, PM2 restarts.**
      None. [AWS for the managed half; the VPS half needs something like node_exporter or a
      simple cron check either way.]
- [ ] **Alerts reach a human.** No email/SNS/Slack destination configured anywhere.

## 5. Deployment & CI/CD

- [ ] **CI pipeline: lint → typecheck → test → build → migrate → deploy.** No workflows —
      `.github/` holds only `copilot-instructions.md`. The scripts exist
      (`npm run lint`, `typecheck`, `test`, `test:e2e`, `build`) but nothing runs them
      automatically, and deploying is still a human running `deploy.sh` on the server.
      *Before wiring CI:* ~15 tests across 13 suites already fail on `DEV-v1` independently of
      any change — fix or quarantine those first, or the first red build teaches everyone to
      ignore red builds.
- [ ] **Immutable builds; `npm ci --omit=dev`.** [deploy.sh](deploy/deploy.sh#L39) does
      `git reset --hard` + `npm ci --include=dev` + `npm run build` **on the production box**,
      so the box compiles its own artifact and carries the full dev toolchain. Build in CI,
      ship `dist/` + prod deps.
- [~] **Zero-downtime deploy.** `pm2 reload` is used, which is the right verb — but with
      `instances: 1` in fork mode a reload is a stop/start, and the app's own boot runs
      migrations/seeds before opening the port, so the gap is tens of seconds, not zero.
      Cluster mode (§3) or two instances behind nginx is the fix.
- [ ] **Version / commit hash exposed at `/health`.** The health payload is status +
      timestamp + database + cache only ([health.service.ts](src/modules/health/health.service.ts));
      you cannot tell which commit is serving. Cheap win: inject the SHA at build time and add
      it to the response.
- [~] **One-command rollback.** On health-check failure `deploy.sh` *prints* the rollback
      command; there is no `rollback.sh`, no kept previous release directory, and no DB
      rollback path.
- [ ] **Staging environment mirroring prod.** None. Today: localhost, CloudJiffy, and the
      production VPS — with the VPS being the only place the real topology exists.

## 6. Nginx / edge

- [x] **TLS with auto-renewing certs; HTTP → HTTPS redirect.**
      [deploy/nginx/erp.conf](deploy/nginx/erp.conf) — Let's Encrypt for
      `169-58-213-171.sslip.io`, the ACME challenge path stays on port 80, everything else
      301s to HTTPS; a self-signed vhost answers the bare IP.
- [x] **HSTS.** Delivered by helmet's default `Strict-Transport-Security` on app responses,
      which pass through nginx unchanged. *Consider* also setting it at the nginx layer so
      error pages nginx generates itself carry it too.
- [x] **`proxy_read_timeout` and `client_max_body_size` set deliberately.**
      [erp-proxy.conf](deploy/nginx/erp-proxy.conf) — 120 s read/send, 10 s connect, 20 MB
      body, each with a comment explaining the number.
- [x] **Gzip on JSON responses.** `compression()` at the app level
      ([src/main.ts](src/main.ts#L142)). *Note:* nginx has no `gzip`/brotli block of its own,
      and `proxy_buffering off` means nginx streams the app's already-compressed body — which
      is fine, just be aware compression happens in Node, on the single fork.
- [ ] **Real client IP + `trust proxy` so rate limiting works.** nginx sets
      `X-Real-IP`/`X-Forwarded-For` correctly, and audit logging reads them
      ([request-context.middleware.ts](src/common/middleware/request-context.middleware.ts#L11)).
      But the app **never calls `app.set('trust proxy', ...)`**, so `req.ip` is always
      nginx's loopback address — and `ThrottlerGuard` keys on `req.ip`. Net effect: the rate
      limiter counts *all* clients together, so one busy user can lock out everyone, and an
      attacker is never isolated. Fix this together with the per-route auth throttle in §1.
- [~] **Access logs with request time.** `access_log` is on, but on nginx's default
      `combined` format, which has no `$request_time`. Define a log format that includes
      `$request_time` and `$upstream_response_time`.

## 7. Testing & quality

- [~] **Unit tests for money/tax/stock math.** 147 `*.spec.ts` files, including tax-master,
      price-master, selling-price and bill/sale-order service specs that touch rounding.
      Missing: no test suite dedicated to the GST rules themselves — CGST/SGST vs IGST
      selection, HSN rate resolution, and rounding at each level (line → tax → invoice) as a
      table of known-answer cases. That is the math customers audit you on.
- [~] **E2E for the critical flows.** Strong coverage in [test/](test/): login
      (`auth.e2e-spec.ts`), billing (`bill-draft-http`, `bill-posted-http`), receipts, cheque
      bounce, opening/physical stock and transfers, plus an all-endpoints smoke test.
      Missing: **no tenant-isolation E2E** (§1) — the one this checklist explicitly calls for.
- [x] **Load test a realistic scenario.** [scripts/perf/load-test.js](scripts/perf/load-test.js)
      with smoke/baseline/stress scenarios (`npm run perf:*`) and
      [docs/performance-load-testing.md](docs/performance-load-testing.md).
      *Worth doing next:* re-run it against the VPS and record the breaking point, since the
      numbers change entirely once cluster mode and pooling land.
- [x] **API documented (Swagger) and versioned (`/api/v1`).** URI versioning with a default
      of `1` and a global `api` prefix ([src/main.ts](src/main.ts#L197)); one aggregate
      Swagger doc plus per-module docs with a module search box.

## 8. Operational

- [~] **Runbook.** [deploy/README.md](deploy/README.md) covers topology, redeploy, CORS
      changes, accounting-year partitions, TLS and post-deploy checks, and there is a
      [VPS deployment runbook PDF](docs/vps-deployment-runbook.pdf).
      Missing sections: restore-the-database, rotate-a-secret, and add-a-tenant.
- [ ] **Data retention & backup policy written down.** Nothing — and GST records need
      multi-year retention. Pairs with the missing backups in §2.
- [ ] **Cost alarms. [AWS]** N/A on the current VPS billing model; do it on day one of a
      move.
- [ ] **Multi-AZ database and a second app instance.** Single VPS, single Postgres, single
      PM2 fork. Everything is a single point of failure today.

---

## If you only do five things

1. **Back up the database** — automated `pg_dump` (or PITR via WAL archiving) to off-box
   storage, plus one rehearsed restore. Nothing else on this list protects the data.
2. **Fix `trust proxy`** — one line in `main.ts`, and rate limiting starts working per client
   instead of per nginx.
3. **Add an authorization layer** — `user_type` is already in the token; a `@Roles` guard over
   it closes the "any logged-in user can call anything" hole.
4. **Scope queries by `company_id`** (with a test that proves a cross-tenant read fails) —
   before a second tenant shares the database, not after.
5. **Move the build into CI** — lint, typecheck, test, build, then ship `dist/`; stop
   compiling on the production box. Clear the ~15 already-failing tests first.
