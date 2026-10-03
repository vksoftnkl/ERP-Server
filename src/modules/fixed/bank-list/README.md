# Bank List

CRUD API for the **bank master** — the fixed reference list of banks (name, short name, alias,
RBI code, IBAN support) that ledger bank accounts are drawn from.

- **Base route:** `bank-lists` (API-versioned via `API_VERSION`, applied per-route with `@Version`)
- **Swagger tag:** `Bank List`
- **Auth:** Bearer `access-token` (required)
- **Cache:** controller-level `@CacheTTL(1)`
- **Primary table:** `bank_master` (`fixed` schema) — PK `bnkId`

## Files

| File | Purpose |
| --- | --- |
| [bank-list.module.ts](bank-list.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service and exception filter |
| [bank-list.controller.ts](bank-list.controller.ts) | HTTP routes + Swagger docs |
| [bank-list.service.ts](bank-list.service.ts) | Business logic, persistence, audit logging |
| [bank-list-exception.filter.ts](bank-list-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `bnk*` field names) |
| [dto/save-bank-list.dto.ts](dto/save-bank-list.dto.ts) | Single create/update payload |
| [dto/list-bank-list-query.dto.ts](dto/list-bank-list-query.dto.ts) | List query params (search / pagination base + `bnkIsActive`) |
| [dto/bank-list-response.dto.ts](dto/bank-list-response.dto.ts) | Swagger response models |
| [types/bank-list-api.types.ts](types/bank-list-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a bank, chosen by `bnkId` presence. |
| `GET` | `/list` | List banks with search + pagination (configured-grid powered). |
| `GET` | `/get` | Fetch one bank by `bnkId` (UUID v7). |
| `DELETE` | `/delete` | Soft-delete a bank by `bnkId` (UUID v7). |

### Create / update semantics

- **Omit `bnkId` → create; include `bnkId` → update** the existing bank (`save` branches on the
  field). The response message likewise switches on `bnkId` presence.
- `bnkName` is required and trimmed; on save it is normalized via `normalizeRequiredText`.
- Optional fields (`bnkShortName`, `bnkAlias`, `bnkRbiCode`, `bnkIbanSupported`, `bnkIsActive`) are
  copied only when present in the payload (`applyPresentFields`) — omitting a field on update leaves
  the stored value untouched.
- Each save runs in a Prisma `$transaction`: uniqueness check, the create/update, then the audit
  write. On update the target must exist and not be soft-deleted, or a not-found error is raised.

### List

- `/list` is served by `ConfiguredGridSqlService` (via `runConfiguredGridQuery`) against the
  `bank master` grid (alias `bank_list_grid`), forwarding `search` and resolved pagination
  (`page` / `limit` / `skip` from `resolvePagination`).
- If no configured grid is found for bank list, a bad-request error is returned.

## Business rules

- **Bank name uniqueness** is case-insensitive across all non-deleted banks (`ensureNameIsUnique`);
  updates exclude the current row. Violations surface as a conflict; a DB unique-constraint race is
  caught and re-thrown as the same error (`throwOnUniqueConstraintError`).
- **Soft delete only** — deleting sets `bnkIsDeleted = true` / `bnkIsActive = false` with modified
  audit stamps; rows are never hard-deleted.
- **Delete guard** — a bank cannot be soft-deleted while it is referenced by active ledger bank
  accounts: `softDelete` counts `acc_ledger_bank_account` rows whose `lbaBankName` matches the
  bank's name (and `lbaIsDeleted = false`) and rejects the delete when any exist.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`)
  under screen `Bank List Master` (type `master`), capturing original vs. modified records. The
  acting user comes from `RequestContextService.getUserId()` / the payload's `bnkCreatedBy` /
  `bnkModifiedBy` (`resolveActor`), falling back to `DEFAULT_ACTOR`.
