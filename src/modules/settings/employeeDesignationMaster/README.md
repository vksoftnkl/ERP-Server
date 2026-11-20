# Employee Designation Master

CRUD API for **employee designations** — the job-title / rank master used to classify employees
(e.g. Manager, Supervisor, Clerk).

- **Base route:** `employee-designation-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Employee Designation Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `employee_designations` (`public` schema) — PK `edId`

## Files

| File | Purpose |
| --- | --- |
| [employee-designation-master.module.ts](employee-designation-master.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter |
| [employee-designation-master.controller.ts](employee-designation-master.controller.ts) | HTTP routes + Swagger docs |
| [employee-designation-master.service.ts](employee-designation-master.service.ts) | Business logic, persistence, audit logging |
| [employee-designation-master-exception.filter.ts](employee-designation-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `ed*` field names via regex) |
| [dto/save-employee-designation-master.dto.ts](dto/save-employee-designation-master.dto.ts) | Single create/update payload |
| [dto/employee-designation-master-response.dto.ts](dto/employee-designation-master-response.dto.ts) | Swagger response models |
| [types/employee-designation-master-api.types.ts](types/employee-designation-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a designation, chosen by the presence of `edId` in the body. |
| `GET` | `/get` | Fetch one active designation by `edId` (required, UUID v7 query param). |
| `DELETE` | `/delete` | Soft-delete a designation by `edId` (required, UUID v7 query param). |

### Create / update semantics

- **Omit `edId` → create; include `edId` → update** the existing (non-deleted) designation;
  updating a missing/deleted id returns not-found.
- `edName` is **required** (max 150) and normalized before persistence
  (`normalizeRequiredName`).
- Optional fields (`edCode`, `edRemarks`, `edIsActive`) are only written when the
  key is present on the payload (`hasOwnProperty`); `edCode` and `edRemarks` are normalized to
  `null` when blank.
- **Auto code (HR review step 5, 20/11/2026):** a designation **created** with a blank `edCode` gets
  its whole name, upper case, letters and digits only, at most 20 (Driver → `DRIVER`, Sales Manager →
  `SALESMANAGER`), then `2`, `3`, … while a live designation holds it in any case. Read and written
  under `lockCodeSeries(tx, DESIGNATION_CODE_SERIES)` (`settings/shared/code-from-name.ts`,
  `code-series-lock.ts`). An edit never makes a code; a blank one clears it. Initials are not used:
  the driver dropdown 76 matches the code `DRIVER`.
- **Default Designation is gone (H6):** `edIsDefault` is still accepted (so an older client is not
  refused) and ignored; it is no longer answered. The column stays, at its default `false`.
- Each write runs inside a Prisma `$transaction` covering the row change plus its audit entry.

## Business rules

- **Name uniqueness** among non-deleted rows, case-insensitive (`ensureNameIsUnique`); a
  duplicate raises a conflict on `edName`.
- **Code uniqueness** among non-deleted rows, case-insensitive, only checked when `edCode` is
  provided (`ensureCodeIsUnique`); a duplicate raises a conflict on `edCode`.
- The DB backstop is the partial unique index `ux_ed_code` (lower(ed_code), live rows, non-blank).
  A race onto it answers 409 `DESIGNATION_CODE_DUPLICATE` on `edCode`; any other unique violation
  409 `DESIGNATION_DUPLICATE`.
- **Soft delete only** — deleting flags `edIsDeleted = true`, `edIsActive = false`; rows are
  never hard-deleted. Delete is **blocked** when active
  employees still reference the designation (`employeeMaster.count` on `empDesignationId` with
  `empIsDeleted = false` > 0 → bad request).
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), capturing original vs. modified payloads. The acting user comes from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
