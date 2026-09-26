# Performance and Load Testing

This project includes a built-in load test runner:

- Script: `scripts/perf/load-test.js`
- Presets: `smoke`, `baseline`, `stress`
- Custom mix template: `scripts/perf/routes.example.json`

## 1. Prerequisites

1. Start PostgreSQL:
```bash
docker compose up -d
```
2. Apply migrations:
```bash
npm run migration:run
```
3. Start the API:
```bash
npm run start:dev
```

## 2. Run preset tests

```bash
npm run perf:smoke
npm run perf:baseline
npm run perf:stress
```

The target defaults to the API's own `.env` (`PORT` and `HTTPS_ENABLED`) — currently
`http://localhost:3011`. Override it with `PERF_BASE_URL` or `--base-url`.

## 3. Run with overrides

```bash
npm run perf:load -- --base-url http://localhost:3011 --duration 90s --concurrency 40
```

Common options:

- `--scenario smoke|baseline|stress`
- `--duration 30s|2m|10000ms`
- `--concurrency 25`
- `--timeout-ms 5000`
- `--think-time-ms 50`
- `--accept-status 429,503`
- `--header "Authorization: Bearer <token>"`
- `--output logs/perf/baseline.json`
- `--insecure-tls` (for local self-signed HTTPS only)

## 4. Custom route mix

Edit `scripts/perf/routes.example.json` and run:

```bash
npm run perf:custom
```

Or point directly to your own file:

```bash
npm run perf:load -- --routes-file ./scripts/perf/routes.example.json
```

## 5. Rate-limit note for this application

Global throttling is enabled via `THROTTLE_TTL` and `THROTTLE_LIMIT`. Under high load, this can produce many `429` responses and skew throughput/latency interpretation.

For infrastructure capacity tests, use a dedicated test environment and increase throttle limits there, for example:

```bash
THROTTLE_LIMIT=100000 THROTTLE_TTL=60 npm run start:dev
```

If you intentionally want to measure behavior with throttling active, keep limits unchanged and mark `429` as accepted:

```bash
npm run perf:load -- --scenario baseline --accept-status 429
```

## 6. Suggested workflow

1. Run `perf:smoke` to confirm stability.
2. Run `perf:baseline` three times and save JSON reports.
3. Compute p95/p99 latency and throughput medians across runs.
4. Run `perf:stress` to find degradation and failure thresholds.
5. Compare results after every API/DB/index change.
