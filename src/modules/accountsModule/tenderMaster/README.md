# Tender Master

CRUD API for **tenders** — the individual modes of payment (cash, card, UPI, cheque, etc.)
that sit under a tender type and are each linked to an account ledger, with per-tender amount
limits and surcharge settings.

- **Base route:** `tender-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Tender Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `acc_tender_master` (`accounts` schema) — PK `acctndId` (exposed as `tndId`)
- **Related tables:** `acc_tender_types` — FK `acctndTypeId → accttTypeId`; `acc_ledger_master` —
  FK `acctndLedgerId → ledId`

## Files

| File | Purpose |
| --- | --- |
| [tender-master.module.ts](tender-master.module.ts) | Module wiring — imports `AuditLogModule` (service is **not** exported) |
| [tender-master.controller.ts](tender-master.controller.ts) | HTTP routes + Swagger docs |
| [tender-master.service.ts](tender-master.service.ts) | Business logic, persistence, audit logging |
| [tender-master-exception.filter.ts](tender-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `tnd*` field names) |
| [dto/save-tender-master.dto.ts](dto/save-tender-master.dto.ts) | Single create/update payload |
| [dto/tender-master-response.dto.ts](dto/tender-master-response.dto.ts) | Swagger response models |
| [types/tender-master-api.types.ts](types/tender-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a tender, chosen by `tndId` presence in the body. |
| `GET` | `/get` | Fetch one active tender by `tndId` (required UUID v7 query param). |
| `DELETE` | `/delete` | Soft-delete a tender by `tndId` (required UUID v7 query param). |

The body of `/create` is a single object ([SaveTenderMasterDto](dto/save-tender-master.dto.ts)) —
there is no batch mode and no list-all endpoint (`/get` always requires a `tndId`).

### Create / update semantics

- **Omit `tndId` → create; include `tndId` → update** the existing tender.
- Optional fields are only written when the key is actually present on the payload
  (`hasOwnProperty` guards), so omitting a field leaves the stored value untouched on update.
- `acctndShortName` is stored equal to `tndName` (`buildShortName` returns the name unchanged);
  it is not exposed in the response payload.
- On update, a not-found (or already-deleted) `tndId` returns a not-found error.

### Validation rules

- `tndName` — required, trimmed, non-empty.
- `tndTypeId` — required numeric string (`/^\d+$/`), parsed to `BigInt` for the FK.
- `tndLedgerId` — required UUID.
- `tndMinAmount` — required finite number `≥ 0`.
- `tndMaxAmount` — optional/nullable, finite `≥ 0`; when present it **must be `≥ tndMinAmount`**
  (`validateAmountRange`).
- `tndSurchargePerc` — optional number `≥ 0`; `tndDisplayPosition` — optional integer `≥ 0`.
- **Tender type must exist and be active** (`ensureTenderTypeExists`, validates `tndTypeId`
  against `acc_tender_types`).
- **Account ledger must exist and be active** (`ensureLedgerExists`, validates `tndLedgerId`
  against `acc_ledger_master`).

### Uniqueness

- **Tender name is unique per tender type**, case-insensitive (`ensureNameIsUnique`, scoped by
  `acctndTypeId` and excluding the current row on update) — a duplicate returns a conflict.
- A DB unique-constraint violation is also mapped to the same conflict shape on `tndName`
  (`throwOnUniqueConstraintError`).

### Soft delete

- **Soft delete only** — rows are never hard-deleted. `DELETE /delete` sets
  `acctndIsDeleted = true` / `acctndIsActive = false` and stamps `acctndModifiedOn` /
  `acctndModifiedBy`, all inside a `$transaction`.

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` — actions `New` (create),
  `update`, and `cancel` (soft delete) — capturing original vs. modified payloads under screen
  name **Tender Master** (`screenType: 'master'`).
- The acting user comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.

## Relationship to tenderTypeMaster

Each tender belongs to a tender type (`acctndTypeId → accttTypeId`). The service validates the
referenced type against `acc_tender_types` on every create/update, and tender-name uniqueness is
scoped **within a tender type** — the same name may exist under different types. The tender type
records themselves are managed by the sibling
[tenderTypeMaster](../tenderTypeMaster) module; this module only reads them for FK validation and
does not import its service.
