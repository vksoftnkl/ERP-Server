# Ledger Bank Accounts

Standalone CRUD API for a **single ledger bank account** — the bank account rows that hang off an
account ledger (`acc_ledger_master`). Each row is keyed by `lbaId` and always belongs to one parent
ledger via `lbaLedgerId`.

- **Base route:** `ledger-bank-accounts` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Ledger Bank Accounts`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `acc_ledger_bank_accounts` (`accounts` schema) — PK `lbaId`
- **Foreign keys:** `lbaLedgerId → acc_ledger_master.ledId` (required), `lbaCompanyId → company.compId` (optional)

## Files

| File | Purpose |
| --- | --- |
| [ledger-bank-account.module.ts](ledger-bank-account.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter |
| [ledger-bank-account.controller.ts](ledger-bank-account.controller.ts) | HTTP routes + Swagger docs |
| [ledger-bank-account.service.ts](ledger-bank-account.service.ts) | Business logic, persistence, audit logging |
| [ledger-bank-account-exception.filter.ts](ledger-bank-account-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `lba*` field names) |
| [dto/save-ledger-bank-account.dto.ts](dto/save-ledger-bank-account.dto.ts) | Single create/update payload |
| [dto/ledger-bank-account-response.dto.ts](dto/ledger-bank-account-response.dto.ts) | Swagger response models |
| [types/ledger-bank-account-api.types.ts](types/ledger-bank-account-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a bank account (by `lbaId` presence). Accepts a single object only. |
| `GET` | `/get` | Fetch one active bank account by `lbaId` (UUID v7). |
| `DELETE` | `/delete` | Soft-delete a single bank account by `lbaId` (UUID v7). |

### Create / update semantics

- **Omit `lbaId` → create; include `lbaId` → update** the existing row.
- The payload is a **single object** — there is no batch mode.
- Only optional fields present on the payload are written; each is applied via `hasOwnProperty`
  (`applyOptionalFields`), so absent keys leave the stored value untouched on update.
- `lbaLedgerId` is required and the referenced ledger **must exist and be active**
  (`ensureLedgerExists`, checks `ledIsDeleted = false`).
- `lbaAccountHolder`, `lbaBankName`, and `lbaAccountNo` are required and trimmed/normalized
  (`normalizeRequiredText`).

### Company resolution

`resolveCompanyId` reconciles the account's company against the parent ledger:

- On update, an omitted `lbaCompanyId` falls back to the existing stored value; on create it defaults
  to `null`.
- If the ledger has a company (`ledCompanyId`), a null account company inherits it, and a
  non-null account company **must match** the ledger's — a mismatch is rejected (`Ledger company mismatch`).
- Any resolved non-null company is verified to exist and be active (`ensureCompanyExists`).

## Business rules

- **Account number uniqueness** is per ledger, case-insensitive (`ensureAccountNumberIsUnique`),
  and excludes the row being updated. A duplicate raises a conflict.
- **At most one default** (`lbaIsDefault`) per ledger — enforced both in code and by the DB. In code,
  setting `lbaIsDefault: true` first clears the existing default(s) for that ledger
  (`clearDefaultAccount`, excluding the current row on update) so the constraint never trips. At the DB
  level a partial unique index `uq_lba_default_per_ledger` on `(lba_ledger_id) WHERE lba_is_default AND
  NOT lba_is_deleted` guarantees a single active default per ledger.
- **Soft delete only** — rows are never hard-deleted. Deleting flags `lbaIsDeleted = true` /
  `lbaIsActive = false` and stamps the modifier. `GET /get`, uniqueness checks, and updates all filter
  on `lbaIsDeleted = false`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`,
  `screenType: 'master'`), capturing original vs. modified records. The acting user comes from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- Create/update run inside a `$transaction`; Prisma unique- and foreign-key-constraint errors are
  translated into the module's conflict / bad-request error shapes.

## Validation (DTO)

Enforced by [SaveLedgerBankAccountDto](dto/save-ledger-bank-account.dto.ts) via `class-validator`:

- `lbaId` — optional UUID v7 (its presence switches create → update).
- `lbaCompanyId` — nullable UUID; `lbaLedgerId` — required UUID.
- `lbaAccountHolder`, `lbaBankName` — trimmed, non-empty, max 200.
- `lbaAccountNo` — trimmed, non-empty, max 50.
- `lbaIfscCode` — optional, upper-cased, exactly 11 chars.
- `lbaMicrCode` (max 15), `lbaUpiId` (max 100), `lbaChequeName` (max 200), `lbaBranchName` (max 200),
  `lbaRemarks` (max 250) — nullable strings.
- `lbaAccountType` — optional, upper-cased free-text string (stored as `VarChar(20)`; no fixed enum).
- `lbaIsDefault`, `lbaIsActive` — optional booleans.

## Relationship to Account Ledger Masters

This module is a **dedicated, single-row surface** for the same `acc_ledger_bank_accounts` table that
[accountLedgerMasters](../accountLedgerMasters/README.md) also manages as a nested `ledgerBankAccount[]`
array (via its `/get-bank` and `/delete-bank` routes). Use this module to create, fetch, or soft-delete
one bank account directly by `lbaId` without touching the parent ledger payload. The service is scoped
to this module — it is **not exported** for cross-module reuse.
