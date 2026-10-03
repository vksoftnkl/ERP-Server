# Item Customer Rates Master

CRUD API for **customer-specific item rates** — special negotiated prices, discounts and
price-level overrides for a given customer against a given item unit rate
(`csr_customer_id` × `csr_unit_rate_id`).

- **Base route:** `item-cust-rates` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Item Customer Rates`
- **Auth:** Bearer `access-token` (required)
- **Cache:** controller-level `CacheTTL(60)`
- **Primary table:** `cust_item_rates` (`sales` schema) — PK `csr_id` (uuid v7)

## Files

| File | Purpose |
| --- | --- |
| [items-cust-rates-master.module.ts](items-cust-rates-master.module.ts) | Module wiring — imports `AuditLogModule`, registers controller, service and exception filter |
| [items-cust-rates-master.controller.ts](items-cust-rates-master.controller.ts) | HTTP routes + Swagger docs |
| [items-cust-rates-master.service.ts](items-cust-rates-master.service.ts) | Business logic, persistence, audit logging, configured-grid list |
| [item-cust-rate-exception.filter.ts](item-cust-rate-exception.filter.ts) | Maps DB/domain/validation errors to the module's `{ success, message, errors }` shape (infers `csr_*` field names) |
| [dto/save-item-cust-rate.dto.ts](dto/save-item-cust-rate.dto.ts) | Single create/update payload |
| [dto/list-item-cust-rate-query.dto.ts](dto/list-item-cust-rate-query.dto.ts) | List query params (search, pagination, optional filters) |
| [dto/item-cust-rate-response.dto.ts](dto/item-cust-rate-response.dto.ts) | Swagger response models |
| [types/item-cust-rate-api.types.ts](types/item-cust-rate-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a customer item rate, chosen by `csr_id` presence in the body. |
| `GET` | `/list` | List rates with search + pagination (served from a configured grid). |
| `GET` | `/get` | Fetch one active rate by `csr_id` (query param, uuid v7). |
| `DELETE` | `/delete` | Soft-delete one rate by `csr_id` (query param, uuid v7). |

### Create / update semantics

- **Omit `csr_id` → create; include `csr_id` → update** the existing row
  ([service `save`](items-cust-rates-master.service.ts)); the success message reflects which
  branch ran.
- `csr_customer_id` and `csr_unit_rate_id` are **required** on every save; all pricing,
  discount, validity, status and upload fields are optional.
- Updates only touch fields **present** in the body — optional fields are applied via
  `hasOwnProperty` checks (`applyOptionalFields`), and `csr_valid_from` / `csr_valid_to` fall
  back to the stored values when omitted.
- Each create and update runs inside a `$transaction` together with its audit-log write.

### Validation

- `csr_price_level`, when supplied, must be one of `A`, `B`, `C`, `D` (regex on the DTO;
  skipped when null).
- `csr_valid_from` / `csr_valid_to` must be valid dates, and `csr_valid_to` must be **greater
  than or equal to** `csr_valid_from` (`validateDateRange`).
- Date strings are parsed to `Date`; an unparseable value raises a `Validation failed`
  bad-request error naming the offending field.
- `csr_rate_type` defaults to `FIXED`; `csr_priority` defaults to `0`; `csr_is_active` defaults
  to `true` (DB-level defaults on the model).

### Soft delete

- **Soft delete only** — `DELETE /delete` flags `csr_is_deleted = true` and stamps
  `csr_modified_on` / `csr_modified_by`; rows are never hard-deleted.
- `getById`, `softDelete` and update all scope on `csrIsDeleted: false`; a missing/deleted row
  raises a `404` (`Item customer rate not found`, field `csr_id`).

### Error mapping

`handleWriteError` translates persistence failures before they leave the service:

- A **DB unique-constraint** violation becomes a `409` conflict
  (`Item customer rate already exists`).
- A **foreign-key** violation becomes a `400` (`Invalid relation reference`, field
  `csr_customer_id`).

## List

`GET /list` is backed by `ConfiguredGridSqlService` via `runConfiguredGridQuery`, keyed by the
grid table name `cust item rates`. It applies `search` plus resolved pagination
(`page` / `limit` / `skip`) and returns `{ data, meta }`; if no configured grid is found it
raises a bad-request error. The query DTO also declares optional filters
(`csr_branch_id`, `csr_customer_id`, `csr_unit_rate_id`, `csr_rate_type`, `csr_price_level`,
`csr_is_active`).

## Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` inside the same transaction,
with `screenName` `Item Customer Rate Master` and `screenType` `master`:

- Create → action `New` (original `null` → new payload).
- Update → action `update` (original vs. modified payload).
- Soft delete → action `cancel`.

The display name is `"{csr_customer_id}:{csr_unit_rate_id}"`. The acting user resolves from the
payload's `csr_created_by` / `csr_modified_by`, then `RequestContextService.getUserId()`,
falling back to `DEFAULT_ACTOR`.
