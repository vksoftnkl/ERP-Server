# ERP Server Boilerplate (NestJS + PostgreSQL + Prisma)

Enterprise-ready NestJS starter with:
- Structured module layout
- PostgreSQL with Prisma ORM
- Config management + env validation
- Global validation pipes
- Throttling guard
- Global exception filter
- Request timeout interceptor
- Versioned API routes (`/api/v1/*`)
- Health check endpoint
- Migrations support

## 1. Project setup

```bash
npm install
npm run prisma:generate
cp .env.example .env
```

## 2. Start PostgreSQL and Redis

```bash
docker compose up -d
```

## 3. Run DB migration

```bash
npm run migration:run
```

## 4. Run app

```bash
npm run start:dev
```

Base URL:
- `https://localhost:3010/api/v1`
- Request payload limit is configurable with `REQUEST_BODY_LIMIT` (default `10mb`).
- Bind host/IP is configurable with `HOST` (default `0.0.0.0`).
- Access tokens can be stored and validated through Redis by enabling `REDIS_ENABLED=true`.
- Access tokens do not expire by time; Redis-backed sessions remain active until revoked or deleted.

LAN hosting example (`.env`):

```bash
HOST=0.0.0.0
PORT=3010
CORS_ORIGINS=https://localhost:3000,http://localhost:3000,https://127.0.0.1:3000,http://127.0.0.1:3000,https://192.168.10.25:3000,http://192.168.10.25:3000
CORS_CREDENTIALS=false
```

Then access from LAN:
- `https://192.168.10.25:3010/api/v1`

If `HTTPS_ENABLED=true` with a cert generated for `localhost`, browsers will warn on LAN IP access.
Generate a certificate whose SAN includes your LAN host/IP to avoid warnings.

Troubleshooting:
- `CORS_ORIGINS` must include the exact frontend origin (`scheme + host + port`), for example `https://localhost:3000` and `http://localhost:3000` are different origins.
- Verify your cert SAN values with:

```bash
openssl x509 -in certs/server.crt -noout -subject -issuer -dates -ext subjectAltName
```

Logs:
- Application and request logs are automatically appended to `logs/app.log` on every run.
- Optional override: set `LOG_FILE_PATH=/custom/path/app.log`.
- Error and fatal logs are also written to `logs/error.log`.
- Optional override: set `ERROR_LOG_FILE_PATH=/custom/path/error.log`.

## HTTPS setup

1. Generate a local certificate and key:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

2. Configure `.env`:

```bash
HTTPS_ENABLED=true
HTTPS_CERT_PATH=certs/server.crt
HTTPS_KEY_PATH=certs/server.key
```

3. Restart the app and use:
- `https://localhost:3010/api/v1`

## API endpoints

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/users`
- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `PATCH /api/v1/users/:id`
- `DELETE /api/v1/users/:id`

## Migrations

- Create/apply in development: `npm run prisma:migrate:dev -- --name <migration_name>`
- Deploy pending migrations: `npm run migration:run`
- Reset local DB: `npm run prisma:migrate:reset`
- Migrate + seed in one step: `npm run db:deploy`

## Database seeding

Reference data lives in `prisma/seed` — SQL files plus TypeScript seeds registered in
`src/database/seed/seeds/index.ts`. Every seed is idempotent, so it is safe to re-run.

### On deploy (automatic)

The app applies the seeds during bootstrap, before it starts listening, so a deploy
needs no manual `psql` step. PM2 launches `dist/src/main.js` directly, which is why the
hook lives in the app (`src/database/seed/startup-seed.ts`) rather than in an npm
lifecycle script.

| Variable | Default | Effect |
| --- | --- | --- |
| `DB_AUTO_SEED` | on when `NODE_ENV=production`, off otherwise | Run the seeds at startup |
| `DB_AUTO_MIGRATE` | `false` | Run `prisma migrate deploy` before seeding |
| `DB_SEED_FAIL_FAST` | `false` | Abort startup when a migration/seed fails |
| `DB_SEED_LOCK_TIMEOUT_SECONDS` | `60` | How long to wait for the seed advisory lock |

Deployed values are set in `ecosystem.config.js`. Concurrent boots are serialised by a
Postgres session advisory lock, and each run is recorded in `public._erp_seed_history`
(name, checksum, status, duration, run count, last error):

```sql
SELECT seed_name, last_status, run_count, last_run_at FROM public._erp_seed_history;
```

### By hand

```bash
npm run seed:run                          # all seeds, using DATABASE_URL
npm run seed:run -- --only=Bank_Master.sql
npm run seed:run -- --migrate             # migrate deploy first
npm run seed:run -- --force               # re-run "once" seeds as well
npm run db:deploy                         # prisma migrate deploy + all seeds
npm run seed:run:dist                     # same, from dist/ (no tsx needed)
```

### Adding a seed

- **SQL**: drop the file into `prisma/seed`. It runs automatically, after the files
  listed in `prisma/seed/seed.manifest.json`, in file-name order. Add it to the manifest
  when order matters (a seed that reads rows another seed inserts) or when it must run
  only once (`"mode": "once"`). Make it idempotent — guard inserts with
  `ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS`.
- **TypeScript**: export a `TsSeed` from `src/database/seed/seeds/` and append it to
  `TS_SEEDS` in that folder's `index.ts`. Bump its `version` when the data changes.

A seed that depends on rows it does not create (a menu, a company, a branch) should stay
in the default `always` mode: it no-ops until those rows exist, then applies on a later
deploy.

### Regenerating the exported seeds

`Ui_Tables.sql`, `Ui_Table_Columns.sql`, `Grid_Details.sql`, `Grid_Columns.sql`,
`Dropdown_Details.sql` and `Dropdown_Columns.sql` are exported from a reference database
rather than hand-written — screens read those tables to decide which columns exist, so an
environment without them renders empty grids and saves NULLs. After changing a grid,
dropdown or item-grid layout on the reference database:

```bash
npm run seed:export:ui-config      # rewrites the six UI-config files from DATABASE_URL
git diff prisma/seed               # review
```

The reference masters are exported the same way — `Price_Levels.sql`,
`Item_Price_Levels.sql`, `Item_Gst_Units.sql`, `Stock_Adjust_Reasons.sql`,
`Acc_Tender_Types.sql` and `Acc_Voucher_Types.sql`:

```bash
npm run seed:export:masters
```

Both exporters share the writer in [scripts/lib/seed-file-writer.js](scripts/lib/seed-file-writer.js);
adding a table means adding a config entry, not new code.

Each file skips a table/grid/dropdown that already has columns, so re-running never
fights a site's own layout edits — which also means it will not add a newly introduced
column to an already-configured grid. Use a targeted seed for that, like
`Quotation_Item_Grid_ItemSize_Column.sql`.

## Performance and load testing

Built-in load test runner commands:

- `npm run perf:smoke`
- `npm run perf:baseline`
- `npm run perf:stress`
- `npm run perf:custom`

Full guide: `docs/performance-load-testing.md`

## Suggested next enterprise steps

- Add logout + refresh token rotation on top of the Redis-backed access-token session store
- Add role-based access control + permissions matrix
- Add structured logging (Pino/Winston + request ID)
- Add OpenAPI docs + schema governance
- Add CI pipeline (lint, test, build, migration checks)
