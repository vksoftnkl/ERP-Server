# HSN Code Master

Read-only lookup API for **HSN / SAC codes** — the GST tax-classification codes that pair each
good or service (`hsnIsService`) with its unit quantity code (`hsnUqc`) and rate of tax
(`hsnRateOfTax`).

- **Base route:** `hsn-code-masters` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `HSN Code Master`
- **Auth:** Bearer `access-token` (required)
- **Caching:** controller-level `@CacheTTL(1)`
- **Primary table:** `hsn_master` (`fixed` schema) — PK `hsnId`

## Files

| File | Purpose |
| --- | --- |
| [hsn-code-master.module.ts](hsn-code-master.module.ts) | Module wiring — registers the controller and service |
| [hsn-code-master.controller.ts](hsn-code-master.controller.ts) | HTTP route + Swagger docs |
| [hsn-code-master.service.ts](hsn-code-master.service.ts) | Query logic, filtering, and payload mapping |
| [dto/get-hsn-code-master-query.dto.ts](dto/get-hsn-code-master-query.dto.ts) | Query-string filters (`hsnId`, `hsnCode`, `activeOnly`) |
| [dto/hsn-code-master-response.dto.ts](dto/hsn-code-master-response.dto.ts) | Swagger success / error response models |
| [types/hsn-code-master-api.types.ts](types/hsn-code-master-api.types.ts) | Payload / meta / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Fetch HSN records from `fixed.hsn_master` by `hsnId` / `hsnCode` or list them. Defaults to active records only. |

### Query semantics

- All filters are optional. With **no filters**, the endpoint lists all active HSN records.
- `hsnId` fetches one record by primary key.
- `hsnCode` matches by **exact code, case-insensitive** (`equals` + `mode: 'insensitive'`),
  after trimming whitespace.
- `activeOnly` defaults to `true`; when true, only rows with `hsnIsActive = true` are returned.
  Pass `activeOnly=false` to include inactive records.
- Results are ordered by `hsnCode` ascending, then `hsnId` ascending.
- The response `message` switches to the singular ("HSN code fetched successfully") when
  `hsnId` or `hsnCode` is supplied, and stays plural otherwise.

## Business rules

- **Not-found handling:** when `hsnId` or `hsnCode` is supplied but no matching rows exist, the
  service throws `NotFoundException`. A filter-less list that returns zero rows does **not**
  throw.
- **Rate-of-tax conversion:** `hsnRateOfTax` is stored as a Prisma `Decimal` and coerced to a
  JavaScript `number` in the response payload (`toPayload`).
- Nullable payload fields: `hsnDescription` and `hsnUqc` may be `null`.
- The `get` response carries a `meta` block echoing the applied filters (`hsnId`, `hsnCode`,
  `activeOnly`) plus the returned `count`.

> This module is **read-only** — it exposes no create, update, or delete endpoints, performs no
> audit logging, and does not export its service for reuse.
