# Branch Master

CRUD API for **company branches** — the individual branch/location records (address, contact,
billing setup, inventory options and GST/FSSAI compliance details) that belong to a company.

- **Base route:** `branch-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Branch Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `branch_master` (`public` schema) — PK `brId`, with a unique `brCode`

## Files

| File | Purpose |
| --- | --- |
| [branch-master.module.ts](branch-master.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service and exception filter |
| [branch-master.controller.ts](branch-master.controller.ts) | HTTP routes + Swagger docs (`@CacheTTL(1)`) |
| [branch-master.service.ts](branch-master.service.ts) | Business logic, persistence, related-name resolution, audit logging |
| [branch-master-exception.filter.ts](branch-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (fields matching `br*` or `compId`) |
| [dto/save-branch-master.dto.ts](dto/save-branch-master.dto.ts) | Single create/update payload |
| [dto/branch-master-response.dto.ts](dto/branch-master-response.dto.ts) | Swagger response models |
| [types/branch-master-api.types.ts](types/branch-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a branch, chosen by `brId` presence. |
| `GET` | `/get` | Fetch one branch by `brId` (required UUID query param). |
| `DELETE` | `/delete` | Soft-delete a branch by `brId` (required UUID query param). |

Both `GET /get` and `DELETE /delete` take `brId` as a query parameter validated by `ParseUUIDPipe`.

### Create / update semantics

- **Omit `brId` → create; include `brId` → update** the existing (non-deleted) branch. The
  controller's success message reflects which path ran.
- `brName` is **required** and trimmed (`normalizeRequiredName` / `normalizeRequiredText`).
- `brStateCode` is trimmed and upper-cased, and must be **exactly 2 characters**
  (`normalizeStateCode`) — otherwise a bad-request validation error is returned.
- The target **company must exist and be active** (`ensureCompanyExists` validates `brCompId`
  against `company` where `compIsDeleted = false`); a missing company yields a bad request on
  field `compId`.
- **One default branch per company** — when `brIsDefault` is `true`, `clearDefaultBranch` first
  unsets `brIsDefault` on the company's other active branches (excluding the current row on
  update).
- Optional fields are applied **only when present** in the payload (`applyPresentFields` over
  `BRANCH_MASTER_OPTIONAL_FIELDS`); absent keys are left untouched.
- Each create/update runs inside a Prisma `$transaction` together with its audit log write.

### Uniqueness & validation

- **Branch name uniqueness** is per company, case-insensitive (`ensureNameIsUnique`, scoped to
  `brCompId` and `brIsDeleted = false`) → conflict on `brName`.
- **Branch code uniqueness** is global (across all rows), case-insensitive, and only checked when
  `brCode` is provided (`ensureCodeIsUnique`) → conflict on `brCode`. The DB also enforces a
  `@unique` constraint on `br_code`; a raced unique-constraint violation is mapped by
  `handleWriteError` (`throwOnUniqueConstraintError`).

### Soft delete

- **Soft delete only** — `softDelete` runs in a transaction, flags `brIsDeleted = true` /
  `brIsActive = false`, and stamps `brModifiedOn` / `brModifiedBy`. Rows are never hard-deleted.
- A missing or already-deleted branch yields a not-found error on field `brId`.

### Related names on get

`GET /get` enriches the response via `resolveRelatedNames`, embedding names resolved from other
tables (each only when the corresponding id is set):

- `brCompName` — from `company` (`compName`) by `brCompId`.
- `brBankName` — from `acc_ledger_master` (`ledName`) by `brBankId`.
- `brDefaultGodownName` — from `godown_location` (`gdlName`) by `brDefaultGodownId`.

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` on create,
  `update` on update, `cancel` on soft delete), capturing original vs. modified payloads under
  screen `Branch Master` / table `branch master`.
- The acting user comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.
