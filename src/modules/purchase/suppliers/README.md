# Suppliers

CRUD API for the **supplier master** — purchase-side parties, their contact / tax / regional
details, and the bank accounts held on each supplier's linked account ledger.

- **Base route:** `suppliers` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Suppliers`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `suppliers` (`purchase` schema) — PK `supId`
- **Linked table:** `acc_ledger_master` (`accounts` schema) — every supplier shares its `supId`
  with a linked ledger's `ledId` (1:1). Bank accounts live on that ledger
  (`acc_ledger_bank_accounts`).

## Files

| File | Purpose |
| --- | --- |
| [suppliers.module.ts](suppliers.module.ts) | Module wiring — imports `AuditLogModule` and `AccountLedgerMastersModule` |
| [suppliers.controller.ts](suppliers.controller.ts) | HTTP routes + Swagger docs |
| [suppliers.service.ts](suppliers.service.ts) | Business logic, persistence, linked-ledger sync, audit logging |
| [supplier-exception.filter.ts](supplier-exception.filter.ts) | Extends the shared `PurchaseExceptionFilter`, tagging errors on `sup*` field names |
| [dto/save-supplier.dto.ts](dto/save-supplier.dto.ts) | Single create/update payload (incl. nested bank accounts) |
| [dto/supplier-response.dto.ts](dto/supplier-response.dto.ts) | Swagger response / error models |
| [types/supplier-api.types.ts](types/supplier-api.types.ts) | Payload / response TypeScript contracts (aliases the shared `Purchase*` API types) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a supplier, chosen by `supId` presence in the body. |
| `GET` | `/get` | Fetch one supplier by `supId` (query param, UUID v7), with related names and bank accounts embedded. |
| `DELETE` | `/delete` | Soft-delete a supplier by `supId` (query param, UUID v7). |

The payload is always a **single object** — there is no batch mode and no list-all endpoint.
`GET /get` and `DELETE /delete` both require a valid UUID **v7** `supId` (`ParseUUIDPipe`).

## Create / update semantics

- **Omit `supId` → create; include `supId` → update** the existing (non-deleted) supplier.
- Required text fields are normalized/trimmed via `normalizeRequiredText`: `supName`,
  `supPurchaseType`, `supStateName`, `supGstType`. `supStateCode` is trimmed, upper-cased, and
  must be exactly 2 characters (`normalizeStateCode`).
- `supBilledDate` is set to the server clock on every create and update.
- Only keys actually present on the payload are copied onto the write (`applyOptionalFields` /
  `hasOwnProperty`); `supCollectionDays` defaults to `[]` when sent as null.
- The acting user is resolved by `resolveActor` from the payload's `supCreatedBy`/`supModifiedBy`,
  falling back to `RequestContextService.getUserId()` then `DEFAULT_ACTOR`.
- Create, update, and soft-delete each run inside a single Prisma `$transaction`, so the supplier
  row, its linked ledger, and the audit entry commit atomically.

## Linked account ledger

Every supplier is backed by an account ledger, and the two masters **share one identity**:

- On **create**, the linked ledger is provisioned first via
  `AccountLedgerMastersService.createLedgerWithinTx(dto, tx)` under a fixed account group
  (`SUPPLIER_LINKED_LEDGER_GROUP_ID = 019f081c-98cc-757a-9346-4cfba810c47f`); the returned
  `ledId` is then reused as the new supplier's `supId`.
- On **update**, if a non-deleted linked ledger exists it is kept in sync via
  `updateLedgerWithinTx(dto, tx)` (with `ledId = supId`). Legacy suppliers with no linked ledger
  are a **no-op**.
- On **soft-delete**, the linked ledger is flagged deleted/inactive alongside the supplier
  (`updateMany` on `accLedgerMaster` where `ledId = supId`); also a no-op for legacy rows.
- `buildLinkedLedgerDto` copies required ledger fields (name, state name, state code) from the
  supplier's normalized values, plus the shared fields listed in `SUPPLIER_TO_LEDGER_FIELD_MAP`
  (only when the supplier payload carries that key).

## Nested bank accounts

A supplier's bank accounts are managed through the `ledgerBankAccount[]` array on the
create/update payload but are **owned by the linked ledger** (`acc_ledger_bank_accounts`):

- The array rides straight through to the ledger DTO in `buildLinkedLedgerDto`; the ledger service
  handles the insert/update/default-flag logic.
- On create every item is inserted; on update an item **with** `lbaId` updates that row, an item
  **without** `lbaId` is inserted.
- Omitting the array (or sending an empty one) leaves existing bank accounts **untouched** —
  removal goes through the ledger's bank-account delete endpoint.
- Blank rows are stripped before validation via `normalizeBankAccountItems` (reused from the
  ledger module).
- `GET /get` embeds the ledger's active bank accounts via
  `AccountLedgerMastersService.listBankAccountPayloads(supId)`.

## Validation & business rules

- **Supplier name uniqueness** is per company, case-insensitive (`ensureNameIsUnique`), backed by
  the partial unique DB index `uq_sup_company_name` (where `sup_is_deleted = false`).
- The target **supplier group must exist and be active** (`ensureSupplierGroupExists`, validates
  `supGroupId` against `supplier_group`).
- **Soft delete only** — deleting flags `supIsDeleted = true` / `supIsActive = false` (and mirrors
  the flags onto the linked ledger); rows are never hard-deleted.
- A duplicate-name race that slips past the code check is caught at commit and remapped to a field
  error via `throwOnUniqueConstraintError`.

## Audit logging

Every mutation is recorded through `AuditLogService.logEntityChange` inside the same transaction,
capturing original vs. modified records:

- `create` → action `New`, `update` → action `update`, `softDelete` → action `cancel`.
- Logged against table `suppliers`, screen `Supplier Master`, screen type `master`, keyed on
  `supId` with `supName` as the display name.

## Cross-module reuse

- Imports **`AccountLedgerMastersService`** (via `AccountLedgerMastersModule`) for
  `createLedgerWithinTx`, `updateLedgerWithinTx`, and `listBankAccountPayloads`, and reuses the
  ledger module's `SaveAccountLedgerMasterDto`, `LedgerBankAccountItemDto`, and
  `normalizeBankAccountItems`.
- The response model embeds `LedgerBankAccountPayloadDto` from the `ledgerBankAccount` module.
- Error/success shapes and the exception filter come from the shared `Purchase*` contracts
  (`src/common/types/module-api.types`, `src/common/utils/module-exception-filter.utils`), and the
  service leans on shared helpers in `src/common/utils/module-service.utils`.
