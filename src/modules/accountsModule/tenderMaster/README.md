# Tender Master

CRUD API for **tenders** — the individual modes of payment (cash, card, UPI, cheque, etc.)
that sit under a tender type and are each linked to an account ledger, with per-tender amount
limits, surcharge/MDR settings, settlement routing, instrument details and POS presentation.

- **Base route:** `tender-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Tender Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `acc_tender_master` (`accounts` schema) — PK `tnd_id` (exposed as `tndId`)
- **Related tables (FKs declared in [accountTenderMaster.prisma](../../../../prisma/accounts/accountTenderMaster.prisma)):**
  `companys` (`fk_tnd_company`), `branch_master` (`fk_tnd_branch`), `acc_tender_types`
  (`fk_tnd_type`), `acc_ledger_master` — posting, settlement and surcharge ledgers
  (`fk_tnd_ledger`, `fk_tnd_settlement_ledger`, `fk_tnd_surcharge_ledger`) — and
  `acc_ledger_bank_accounts` (`fk_tnd_bank_account`)

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
- Required on every request: `tndCompanyId`, `tndTypeId`, `tndName`, `tndLedgerId`, `tndMinAmount`.
- Every other column is optional and only written when the key is actually present on the payload
  (`applyPresentFields` + `hasOwnProperty` guards), so omitting a field leaves the stored value
  untouched on update.
- **Nullable columns** (`tndBranchId`, `tndSettlementLedgerId`, `tndBankAccountId`, `tndDailyLimit`,
  `tndSurchargeLedgerId`, the UPI/MID/TID fields, `tndNeedsRef` / `tndAllowChange` /
  `tndAllowInReturn`, `tndHotkey`, `tndColour`, `tndEffectiveFrom` / `tndEffectiveTo`,
  `tndRemarks`) accept an explicit `null` to clear them. Blank strings are stored
  as `NULL`.
- **NOT NULL columns with a DB default** (`tndSettlementDays`, `tndSurchargePerc`,
  `tndSurchargeAmount`, `tndConversionRate`, `tndEditSurcharge`, `tndEditLedger`,
  `tndOpenCashDrawer`, `tndIsDefault`, `tndDisplayPosition`, `tndIsActive`) ignore a `null` rather
  than failing the write — the default (create) or the stored value (update) survives.
- `tndShortName` defaults to the first 30 chars of `tndName` (`tnd_short_name` is `VARCHAR(30)`).
- `tndNeedsRef` / `tndAllowChange` / `tndAllowInReturn` are **tri-state**: `null` means "inherit the
  tender type's flag" and is what the POS resolves against `acc_tender_types`.
- `tndEffectiveFrom` / `tndEffectiveTo` are DATE columns — sent as ISO date strings and returned as
  `YYYY-MM-DD`, not full timestamps.
- On update, a not-found (or already-deleted) `tndId` returns a not-found error.

### Validation rules

Field-level rules live in the DTO; cross-field and lookup rules in the service. Together they
mirror the table's CHECK constraints so a bad payload returns a field error instead of a raw DB
error.

- `tndName` — required, trimmed, non-empty, max 100.
- `tndTypeId` — required numeric string (`/^\d+$/`), parsed to a 32-bit int for the FK.
- `tndLedgerId` — required UUID.
- `tndMinAmount` — required finite number `≥ 0` (`ck_tnd_min_amount`).
- `tndMaxAmount` — nullable, `≥ 0`; when present must be `≥ tndMinAmount` (`ck_tnd_amount_range`).
  On update the check runs against the **merged** value, so moving only one end still validates.
- `tndDailyLimit` — nullable, `≥ 0` (`ck_tnd_daily_limit`).
- `tndSurchargePerc` — `0…100` (`ck_tnd_surcharge_perc`); `tndSurchargeAmount` — `≥ 0`
  (`ck_tnd_surcharge_amt`).
- `tndSettlementDays` — integer `0…90` (`ck_tnd_settlement_days`).
- `tndConversionRate` — strictly `> 0` (`ck_tnd_conversion_rate`).
- `tndColour` — `#RRGGBB` or `#RRGGBBAA` (`ck_tnd_colour`).
- `tndEffectiveTo` — must be on or after `tndEffectiveFrom` (`ck_tnd_effective_range`), also merged
  with stored values on update.
- `tndDisplayPosition` — optional integer `≥ 0`.
- **Existence checks** against non-deleted rows: `tndCompanyId` (`ensureCompanyExists`),
  `tndBranchId` (`ensureBranchExists`), `tndTypeId` (`ensureTenderTypeExists`), and — via the shared
  `ensureLedgerExists` — `tndLedgerId`, `tndSettlementLedgerId` and `tndSurchargeLedgerId`, each
  reporting the error against its own field. `tndBankAccountId` is checked against
  `acc_ledger_bank_accounts` (`ensureBankAccountExists`).

### Uniqueness

All three rules mirror **DB-only partial unique indexes** (Prisma cannot express a `WHERE` clause),
scoped to `(company, branch)` over non-deleted rows, excluding the current row on update:

- `ux_tnd_name` / `ux_tnd_short_name` — case-insensitive tender name and short name
  (`ensureNameIsUnique`) → conflict on `tndName` / `tndShortName`.
- `ux_tnd_hotkey` — one hotkey per company/branch (`ensureHotkeyIsUnique`) → conflict on
  `tndHotkey`.
- `ux_tnd_default` — at most one **active** default tender per company/branch
  (`ensureSingleDefault`) → conflict on `tndIsDefault`, naming the tender that already holds it.

A duplicate that still slips past these checks surfaces as a DB unique-constraint violation, mapped
to the same conflict shape on `tndName` (`throwOnUniqueConstraintError`).

### Soft delete

- **Soft delete only** — rows are never hard-deleted. `DELETE /delete` sets `tnd_is_deleted = true`
  / `tnd_is_active = false` and stamps `tnd_modified_on` / `tnd_modified_by`, all inside a
  `$transaction`.

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` — actions `New` (create),
  `update`, and `cancel` (soft delete) — capturing original vs. modified payloads under screen
  name **Tender Master** (`screenType: 'master'`).
- The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

## Relationship to tenderTypeMaster

Each tender belongs to a tender type (`tnd_type_id → ttm_type_id`). The service validates the
referenced type against `acc_tender_types` on every create/update, and the type supplies the
fallback for the three tri-state override flags. Tender name uniqueness is scoped by
**company/branch**, not by type. The tender type records themselves are managed by the sibling
[tenderTypeMaster](../tenderTypeMaster) module; this module only reads them for FK validation and
does not import its service.
