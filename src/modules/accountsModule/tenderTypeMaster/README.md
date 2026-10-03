# Tender Type Master

CRUD API for **tender types** — the classification a payment tender is grouped under
(e.g. cash, card, UPI). Each tender type is the parent of the individual payment tenders held
in `acc_tender_master`.

- **Base route:** `tender-type-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Tender Type Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `acc_tender_types` (`accounts` schema) — PK `accttTypeId` (auto-increment `BigInt`, exposed as string `ttmTypeId`)
- **Referenced by:** `acc_tender_master` — child tenders link via `acctndTypeId → accttTypeId`

## Files

| File | Purpose |
| --- | --- |
| [tender-type-master.module.ts](tender-type-master.module.ts) | Module wiring — imports `AuditLogModule` |
| [tender-type-master.controller.ts](tender-type-master.controller.ts) | HTTP routes + Swagger docs |
| [tender-type-master.service.ts](tender-type-master.service.ts) | Business logic, persistence, audit logging |
| [tender-type-master-exception.filter.ts](tender-type-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `ttm*` field names) |
| [dto/save-tender-type-master.dto.ts](dto/save-tender-type-master.dto.ts) | Single create/update payload |
| [dto/tender-type-master-response.dto.ts](dto/tender-type-master-response.dto.ts) | Swagger response models |
| [types/tender-type-master-api.types.ts](types/tender-type-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a tender type (by `ttmTypeId` presence). Accepts a single object. |
| `GET` | `/get` | Fetch one active tender type by `ttmTypeId`. |
| `DELETE` | `/delete` | Soft-delete a tender type by `ttmTypeId`. |

### Create / update semantics

- **Omit `ttmTypeId` → create; include `ttmTypeId` → update** the existing tender type.
- The payload is a single object (no batch mode). `ttmTypeName` is required and trimmed
  (max 150 chars); `ttmIsActive` is optional and only written when present in the body.
- Each write runs in a `$transaction` together with its audit entry.
- `accttTypeShortName` is derived from the name via `buildShortName` (currently the name
  verbatim).
- The DB columns use the `acctType*` prefix; the API surfaces the same fields under the `ttm*`
  prefix (mapped by `toPayload`).

## Business rules

- **Tender type name uniqueness** is enforced case-insensitively across non-deleted rows
  (`ensureNameIsUnique`), and any unique-constraint violation is also caught and reshaped
  (`throwOnUniqueConstraintError`).
- **Soft delete only** — rows are never hard-deleted. Deleting flags
  `accttTypeIsDeleted = true` / `accttTypeIsActive = false` and stamps the modifier.
- **Delete is blocked while in use** — if any active row in `acc_tender_master`
  (`acctndTypeId = <id>`, not deleted) references the type, the delete fails with a bad-request
  error naming the count of dependent tenders.
- **Numeric id validation** — `ttmTypeId` must be a whole-number string; a non-numeric value is
  rejected before any DB access (`parseTenderTypeId`).
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), capturing original vs. modified records under screen `Tender Type Master`
  (`master`). The acting user comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.
