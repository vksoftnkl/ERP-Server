# Account Ledger Masters

CRUD API for **account ledgers** — the individual ledger accounts (party, bank, cash, etc.)
that sit under an account group in the chart of accounts — together with each ledger's nested
**bank accounts**.

- **Base route:** `account-ledger-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Account Ledger Masters`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `acc_ledger_master` (`accounts` schema) — PK `ledId`
- **Nested table:** `acc_ledger_bank_accounts` — PK `lbaId`, FK `lbaLedgerId → ledId`

## Files

| File | Purpose |
| --- | --- |
| [account-ledger-masters.module.ts](account-ledger-masters.module.ts) | Module wiring — imports `AuditLogModule`, **exports the service** for reuse |
| [account-ledger-masters.controller.ts](account-ledger-masters.controller.ts) | HTTP routes + Swagger docs |
| [account-ledger-masters.service.ts](account-ledger-masters.service.ts) | Business logic, persistence, audit logging |
| [account-ledger-master-exception.filter.ts](account-ledger-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `led*` field names) |
| [dto/save-account-ledger-master.dto.ts](dto/save-account-ledger-master.dto.ts) | Single create/update payload |
| [dto/save-bulk-account-ledger-master.dto.ts](dto/save-bulk-account-ledger-master.dto.ts) | Batch upsert payload (`{ data: [...] }`) |
| [dto/ledger-bank-account-item.dto.ts](dto/ledger-bank-account-item.dto.ts) | A single nested bank account entry |
| [dto/account-ledger-master-response.dto.ts](dto/account-ledger-master-response.dto.ts) | Swagger response models |
| [types/account-ledger-master-api.types.ts](types/account-ledger-master-api.types.ts) | Payload / response TypeScript contracts |
| [types/account-ledger-master-enum.ts](types/account-ledger-master-enum.ts) | App-layer enums (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a ledger. Accepts a single object **or** a batch `{ "data": [ ... ] }`. |
| `GET` | `/get` | Fetch one ledger by `ledId`, or list all active ledgers (ordered by `ledName`). |
| `DELETE` | `/delete` | Soft-delete a ledger by `ledId`. |
| `GET` | `/get-bank` | Fetch one bank account by `lbaId`, or list all active bank accounts for a `ledId`. |
| `DELETE` | `/delete-bank` | Soft-delete a single bank account by `lbaId`. |

### Create / update semantics

- **Omit `ledId` → create; include `ledId` → update** the existing ledger.
- The `/create` body is a union (single object or `{ data: [...] }`). Nest's global
  `ValidationPipe` can't infer which, so the controller validates explicitly against the
  resolved DTO ([controller `validateBody`](account-ledger-masters.controller.ts)).
- **Batch mode is all-or-nothing:** the whole array runs in one `$transaction`; if any entry
  fails, nothing is saved.
- On create, `ledLedgerType` is forced to `'PARTY'` to satisfy the `chk_led_ledger_type`
  DB check constraint (which only permits uppercase domain values).

## Nested bank accounts

A ledger's bank accounts are managed through the `ledgerBankAccount[]` array on the
create/update payload:

- Item **with** `lbaId` → updates that row (must belong to the parent ledger).
- Item **without** `lbaId` → inserts a new row.
- Omitting the array (or sending an empty one) leaves existing bank accounts **untouched** —
  removal goes through `DELETE /delete-bank`.
- `lbaLedgerId` in the item is **ignored**; the server always injects the parent ledger's id.
- Blank rows (all-null / empty grid rows) are stripped before validation
  (`normalizeBankAccountItems`).
- **At most one default** (`lbaIsDefault`) per ledger — enforced both in code
  (`assertSingleDefault`) and by a partial unique index. Marking a new default first clears the
  existing one so the index never trips.

## Business rules

- **Ledger name uniqueness** is per company, case-insensitive (`ensureNameIsUnique`).
- **Bank account number uniqueness** is per ledger, case-insensitive
  (`ensureBankAccountNumberIsUnique`).
- The target **account group must exist and be active** (`ensureGroupExists`, validates
  `ledGroupId`).
- **Soft delete only** — for GST / audit retention, rows are never hard-deleted. Deleting flags
  `ledIsDeleted = true` / `ledIsActive = false` (and clears `lbaIsDefault` for bank accounts).
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), capturing original vs. modified records. The acting user comes from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- List/get responses embed related names (`ledCompanyName`, `ledBranchName`, `ledGroupName`,
  `ledGroupLedgerProfile`) and the active bank accounts (default-first, then oldest-first).

## Enums (app-layer)

Validation lives in the app, not in Postgres — the equivalent native PG enum types were dropped
(migration `20260623110000_move_acc_ledger_enums_to_app_layer`). See
[types/account-ledger-master-enum.ts](types/account-ledger-master-enum.ts).

- `LedGstPartyRegType` — `REGULAR` · `COMPOSITION` · `UNREGISTERED`
- `LedObType` (opening balance) — `DR` · `CR`
- `BankAccountType` — `SAVINGS` · `CURRENT` · `CASH_CREDIT` · `OVERDRAFT`

## Reuse from other modules

The module **exports `AccountLedgerMastersService`** because several masters share their primary
key with a linked ledger (e.g. **customer** and **supplier**, which mirror into
`acc_ledger_master` under the same id). Those modules compose ledger writes into their own
transactions via the intentionally non-private methods:

- `createLedgerWithinTx(dto, tx)` — provision a ledger inside a caller's transaction.
- `updateLedgerWithinTx(dto, tx)` — keep the linked ledger in sync.
- `listBankAccountPayloads(ledId, client?)` — embed a ledger's bank accounts in another
  master's response without re-implementing the payload mapping (never throws on a missing
  ledger).
