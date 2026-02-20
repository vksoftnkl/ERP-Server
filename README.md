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

## 2. Start PostgreSQL

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
- `http://localhost:3000/api/v1`
- Request payload limit is configurable with `REQUEST_BODY_LIMIT` (default `10mb`).
- Bind host/IP is configurable with `HOST` (default `0.0.0.0`).

VLAN hosting example (`.env`):

```bash
HOST=192.168.10.25
PORT=3000
```

Then access from VLAN:
- `http://192.168.10.25:3000/api/v1`

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
  -subj "/CN=localhost"
```

2. Configure `.env`:

```bash
HTTPS_ENABLED=true
HTTPS_CERT_PATH=certs/server.crt
HTTPS_KEY_PATH=certs/server.key
```

3. Restart the app and use:
- `https://localhost:3000/api/v1`

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

- Add authentication (JWT + refresh token rotation)
- Add role-based access control + permissions matrix
- Add structured logging (Pino/Winston + request ID)
- Add OpenAPI docs + schema governance
- Add CI pipeline (lint, test, build, migration checks)
