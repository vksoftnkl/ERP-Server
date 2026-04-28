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
