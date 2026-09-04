# Customer Groups

CRUD API for **customer groups** — the master used to classify/group customers and to carry
default commercial terms for that group (discount %, collection/debit days, credit and bill
limits, overdue-billing flag).

- **Base route:** `customer-groups` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Customer Groups`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `cust_groups` (`sales` schema) — PK `cgrId`
- **Cache:** controller sets `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [customer-group.module.ts](customer-group.module.ts) | Module wiring — imports `AuditLogModule`; registers controller, service and exception filter |
| [customer-group.controller.ts](customer-group.controller.ts) | HTTP routes + Swagger docs |
| [customer-group.service.ts](customer-group.service.ts) | Business logic, persistence, validation, audit logging |
| [customer-group-exception.filter.ts](customer-group-exception.filter.ts) | Extends `SalesExceptionFilter`; maps DB/domain errors to the module's error shape (matches `cgr*` field names) |
| [dto/save-customer-group.dto.ts](dto/save-customer-group.dto.ts) | Single create/update payload |
| [dto/customer-group-response.dto.ts](dto/customer-group-response.dto.ts) | Swagger response models (re-exports the shared sales error DTOs) |
| [types/customer-group-api.types.ts](types/customer-group-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a customer group (chosen by `cgrId` presence in the body). |
| `GET` | `/get` | Fetch one active customer group by `cgrId` (query param, UUID v7). |
| `DELETE` | `/delete` | Soft-delete a customer group by `cgrId` (query param, UUID v7). |

The `cgrId` query param on `/get` and `/delete` is validated by `ParseUUIDPipe({ version: '7' })`.

### Create / update semantics

- **Omit `cgrId` → create; include `cgrId` → update** the existing group (`save` dispatches on
  `cgrId`). The success message reflects which path ran.
- `cgrName` is required and trimmed; it is further normalized via `normalizeRequiredText`
  before persistence.
- Optional fields are applied only when present on the payload (`applyPresentFields` over
  `CUSTOMER_GROUP_OPTIONAL_FIELDS`); `cgrCollectionDays` defaults to `[]` when null.
- On update, `cgrCompanyId` is only changed when the key is present in the body; otherwise the
  existing company is retained. Updating a missing/soft-deleted group returns **not found**.
- Both create and update run inside a `$transaction` together with their audit-log write.

### Validation / uniqueness

- **Name uniqueness is per company, case-insensitive** (`ensureNameIsUnique`) — a duplicate
  `cgrName` within the same `cgrCompanyId` (excluding the current row on update) yields a
  **conflict**. Unique-constraint violations from the DB are also mapped to a conflict via
  `throwOnUniqueConstraintError`.
- **Company must exist and be active** when `cgrCompanyId` is supplied (`ensureCompanyExists`,
  checks `company.compIsDeleted = false`); a null company id skips the check. A missing company
  yields a **bad request**.

### Soft delete

- **Soft delete only** — deleting flags `cgrIsDeleted = true` / `cgrIsActive = false` and stamps
  `cgrModifiedOn`; rows are never hard-deleted.
- **Referential guard:** deletion is blocked with a **bad request** if any active customer
  (`customer.cusGroupId = cgrId`, `cusIsDeleted = false`) still references the group; the error
  reports the referencing customer count.

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` with actions `New` /
  `update` / `cancel`, screen `Customer Group Master` (`screenType: 'master'`, table
  `cust groups`), capturing original vs. modified payloads.
- The acting user comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.

### Response mapping

- Responses are built by `toPayload`, which serializes timestamps to ISO strings and converts
  the `Decimal` columns `cgrOrder`, `cgrDiscPerc`, and `cgrDebitLimit` to numbers via `toNumber`.
