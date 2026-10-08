# Employee Department Master

CRUD API for **employee departments** — the organizational departments that employees are
grouped under. Supports create/update, single-record fetch, and soft delete.

- **Base route:** `employee-department-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Employee Department Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `employee_departments` (`public` schema) — PK `edptId`

## Files

| File | Purpose |
| --- | --- |
| [employee-department-master.module.ts](employee-department-master.module.ts) | Module wiring — imports `AuditLogModule`, registers controller/service/filter |
| [employee-department-master.controller.ts](employee-department-master.controller.ts) | HTTP routes + Swagger docs |
| [employee-department-master.service.ts](employee-department-master.service.ts) | Business logic, persistence, audit logging |
| [employee-department-master-exception.filter.ts](employee-department-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `edpt*` field names) |
| [dto/save-employee-department-master.dto.ts](dto/save-employee-department-master.dto.ts) | Single create/update payload |
| [dto/employee-department-master-response.dto.ts](dto/employee-department-master-response.dto.ts) | Swagger response/error models |
| [types/employee-department-master-api.types.ts](types/employee-department-master-api.types.ts) | Payload / response / error TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a department. Message reflects which (by `edptId` presence). |
| `GET` | `/get` | Fetch one active department by `edptId` (required UUID v7 query param). |
| `DELETE` | `/delete` | Soft-delete a department by `edptId` (required UUID v7 query param). |

## Create / update semantics

- **Omit `edptId` → create; include `edptId` → update** the existing department
  ([`save`](employee-department-master.service.ts) dispatches on `edptId`).
- Both create and update run inside a `$transaction`.
- On update, the record must exist and be active (`edptIsDeleted = false`) or a **not-found**
  error is thrown.
- Optional string fields (`edptCode`, `edptAlias`, `edptRemarks`) are only written when the key
  is present on the payload (`hasOwnProperty`), and are normalized to `null` when blank.
  `edptName` is required and trimmed via `normalizeRequiredText`.
- `edptIsActive` is only set when explicitly supplied.

## Validation & uniqueness

- **Payload validation** (via `class-validator` on the DTO): `edptName` required, non-empty,
  `MaxLength(150)`; `edptCode` `MaxLength(50)`; `edptRemarks` `MaxLength(250)`; `edptId` a UUID.
- **Name uniqueness** — case-insensitive across non-deleted rows (`ensureNameIsUnique`); a clash
  raises a **conflict** on `edptName`.
- **Code uniqueness** — when a code is supplied, case-insensitive across non-deleted rows
  (`ensureCodeIsUnique`); a clash raises a **conflict** on `edptCode`.
- DB unique-constraint violations are re-mapped to a conflict response (`handleWriteError` /
  `throwOnUniqueConstraintError`).

## Soft delete

- **Soft delete only** — `DELETE /delete` flags `edptIsDeleted = true` / `edptIsActive = false`
  and stamps `edptModifiedOn` / `edptModifiedBy`; rows are never hard-deleted.
- **Blocked when in use** — deletion is rejected with a **bad-request** error if any active
  employee (`employeeMaster` where `empDepartmentId = edptId`, `empIsDeleted = false`) still
  references the department.

## Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange`, run inside the same
  transaction. Actions map to `New` (create), `update` (update), and `cancel` (soft delete),
  capturing original vs. modified records with screen name `Employee Department Master`.
- The acting user comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.
