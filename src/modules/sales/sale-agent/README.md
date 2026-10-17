# Sale Agents

CRUD API for **sale agents** — the master holding agent identity, contact, address and
statutory details, classified under a sale agent group and scoped to a company/branch.

- **Base route:** `sale-agents` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Sale Agents`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sale_agents` (`sales` schema) — PK `saId`
- **Cache:** controller sets `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [sale-agent.module.ts](sale-agent.module.ts) | Module wiring — imports `AuditLogModule`; registers controller, service and exception filter |
| [sale-agent.controller.ts](sale-agent.controller.ts) | HTTP routes + Swagger docs |
| [sale-agent.service.ts](sale-agent.service.ts) | Business logic, persistence, validation, audit logging |
| [sale-agent-exception.filter.ts](sale-agent-exception.filter.ts) | Extends `SalesExceptionFilter`; maps DB/domain errors to the module's error shape (matches `sa*` field names) |
| [dto/save-sale-agent.dto.ts](dto/save-sale-agent.dto.ts) | Single create/update payload |
| [dto/sale-agent-response.dto.ts](dto/sale-agent-response.dto.ts) | Swagger response models (re-exports the shared sales error DTOs) |
| [types/sale-agent-api.types.ts](types/sale-agent-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a sale agent (chosen by `saId` presence in the body). |
| `GET` | `/get` | Fetch one active sale agent by `saId` (query param, UUID v7). |
| `DELETE` | `/delete` | Soft-delete a sale agent by `saId` (query param, UUID v7). |

The `saId` query param on `/get` and `/delete` is validated by `ParseUUIDPipe({ version: '7' })`.

### Create / update semantics

- **Omit `saId` → create; include `saId` → update** the existing agent (`save` dispatches on
  `saId`). The success message reflects which path ran.
- `saCompanyId`, `saGroupId` and `saName` are required on both paths; `saName` is trimmed and
  further normalized via `normalizeRequiredText`, `saCode` via `normalizeNullableString`
  (blank → `null`).
- Optional fields are applied only when present on the payload (`applyPresentFields` over
  `SALE_AGENT_OPTIONAL_FIELDS`).
- On update, `saBranchId` and `saCode` are only changed when the key is present in the body;
  otherwise the existing values are retained. Updating a missing/soft-deleted agent returns
  **not found**.
- Both create and update run inside a `$transaction` together with their audit-log write.

### Validation / uniqueness

- **Name uniqueness is per company, case-insensitive** (`ensureNameIsUnique`); **code
  uniqueness is per company, case-insensitive** and skipped when `saCode` is null
  (`ensureCodeIsUnique`). Duplicates yield a **conflict**, as do DB unique-constraint
  violations via `throwOnUniqueConstraintError`.
- **Company must exist and be active** (`ensureCompanyExists`, `comp_is_deleted = false`),
  **sale agent group must exist and be active** (`ensureGroupExists`,
  `sa_grp_is_deleted = false`), and **branch must exist and be active** when `saBranchId` is
  supplied (`ensureBranchExists`, `br_is_deleted = false`). A missing reference yields a
  **bad request**. `sale_agents` carries no DB-level FKs, so these checks are the guard;
  FK errors are still mapped defensively in `handleWriteError`.

### Soft delete

- **Soft delete only** — deleting flags `saIsDeleted = true` / `saIsActive = false` and stamps
  `saModifiedOn` / `saModifiedBy`; rows are never hard-deleted.
- No referential guard is needed — no table currently references `sale_agents` (the quotation
  and voucher `salesman` columns point at `employee_master`).

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` with actions `New` /
  `update` / `cancel`, screen `Sale Agent Master` (`screenType: 'master'`, table
  `sale agents`), capturing original vs. modified payloads.
- The acting user comes from `saCreatedBy` / `saModifiedBy` when supplied, else
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR` (`resolveActor`).

### Response mapping

- Responses are built by `toPayload`, which returns every column and serializes `saSyncDate`,
  `saCreatedOn` and `saModifiedOn` to ISO strings (`saSyncDate` stays `null` when unset).
