# Supplier Group Master

CRUD API for **supplier groups** — the master used to group / classify suppliers within the
purchase module.

- **Base route:** `supplier-groups` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Supplier Groups`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `supplier_groups` (`purchase` schema) — PK `spgId`
- **Cache:** controller sets `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [supplier-group.module.ts](supplier-group.module.ts) | Module wiring — imports `AuditLogModule`; declares controller, service, and exception filter |
| [supplier-group.controller.ts](supplier-group.controller.ts) | HTTP routes + Swagger docs |
| [supplier-group.service.ts](supplier-group.service.ts) | Business logic, persistence, audit logging |
| [supplier-group-exception.filter.ts](supplier-group-exception.filter.ts) | Extends the shared `PurchaseExceptionFilter`, matching `spg*` field names |
| [dto/save-supplier-group.dto.ts](dto/save-supplier-group.dto.ts) | Single create/update payload |
| [dto/supplier-group-response.dto.ts](dto/supplier-group-response.dto.ts) | Swagger request/response models |
| [types/supplier-group-api.types.ts](types/supplier-group-api.types.ts) | Payload / response TypeScript contracts (re-exports the shared purchase error & success types) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a supplier group, decided by `spgId` presence in the body. |
| `GET` | `/get` | Fetch one active supplier group by `spgId` (query param, UUID v7). |
| `DELETE` | `/delete` | Soft-delete a supplier group by `spgId` (query param, UUID v7). |

### Create / update semantics

- **Omit `spgId` → create; include `spgId` → update** the existing group
  ([service `save`](supplier-group.service.ts)). The success message reflects which path ran.
- `spgName` is required, trimmed, and normalized via `normalizeRequiredText` before persistence.
- Optional fields (`spgAlias`, `spgShort`, `spgDesc`, `spgIsActive`) are copied only when present
  in the payload via `applyPresentFields`, so absent keys are left untouched on update.
- Both create and update run inside a Prisma `$transaction` that also writes the audit entry.
- `spgCreatedBy` / `spgModifiedBy` resolve through `resolveActor` (payload value → request-context
  user → fallback); `spgCreatedOn` / `spgModifiedOn` are set server-side.

### Uniqueness & validation

- **Group name uniqueness** is enforced case-insensitively across non-deleted rows
  (`ensureNameIsUnique`, excluding the current row on update).
- A DB unique-constraint violation is also mapped to a conflict via
  `throwOnUniqueConstraintError` with a `spgName` error detail.

### Soft delete

- **Soft delete only** — deleting sets `spgIsDeleted = true` and `spgIsActive = false`; rows are
  never hard-deleted.
- **Guarded by supplier usage:** deletion is rejected (`throwPurchaseBadRequest`) when any active
  supplier references the group (`supplier.count` on `supGroupId` with `supIsDeleted = false`).
- Runs in a `$transaction` and records `spgModifiedOn` / `spgModifiedBy`.

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` with actions
  `New` (create), `update`, and `cancel` (soft delete), capturing original vs. modified records.
- Audit metadata: table `supplier groups`, screen `Supplier Group Master`, screen type `master`.
  The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

## Shared purchase utilities

The module reuses common purchase helpers instead of re-implementing them:

- Service helpers from `src/common/utils/module-service.utils` — `applyPresentFields`,
  `normalizeRequiredText`, `resolveActor`, `throwOnUniqueConstraintError`,
  `throwPurchaseBadRequest`, `throwPurchaseConflict`, `throwPurchaseNotFound`, `DEFAULT_ACTOR`,
  and the `PurchaseWriteClient` transaction-client type.
- The exception filter extends `PurchaseExceptionFilter` from
  `src/common/utils/module-exception-filter.utils`.
- Response/error/success contracts re-export the shared `Purchase*` types from
  `src/common/types/module-api.types`.
