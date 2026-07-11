# Customer Master

CRUD API for **customers** — the sales-side party master. Each customer is 1:1 linked to an
account ledger (`acc_ledger_master`) that shares its primary key, so a customer and its ledger
are provisioned and kept in sync together.

- **Base route:** `customers` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Customers`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `customers` — PK `cusId` (UUID v7)
- **Linked table:** `acc_ledger_master` — shares the customer's `cusId` as its `ledId` (see below)

## Files

| File | Purpose |
| --- | --- |
| [customer.module.ts](customer.module.ts) | Module wiring — imports `AuditLogModule` and `AccountLedgerMastersModule` |
| [customer.controller.ts](customer.controller.ts) | HTTP routes + Swagger docs (`@CacheTTL(1)`) |
| [customer.service.ts](customer.service.ts) | Business logic, persistence, linked-ledger sync, audit logging |
| [customer-exception.filter.ts](customer-exception.filter.ts) | Extends `SalesExceptionFilter`, mapping DB/domain errors to `cus*` field names |
| [dto/save-customer.dto.ts](dto/save-customer.dto.ts) | Single create/update payload |
| [dto/customer-response.dto.ts](dto/customer-response.dto.ts) | Swagger response models |
| [types/customer-api.types.ts](types/customer-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a customer, chosen by `cusId` presence. Accepts a single object. |
| `GET` | `/get` | Fetch one customer by `cusId` (required UUID-v7 query param), with related names embedded. |
| `DELETE` | `/delete` | Soft-delete a customer by `cusId` (required UUID-v7 query param). |

### Create / update semantics

- **Omit `cusId` → create; include `cusId` → update** the existing customer.
- On create, `cusName` is required and normalized ([`normalizeRequiredText`](customer.service.ts));
  it becomes both the customer name and the linked ledger's required `ledName`.
- `cusStateName` is required and normalized; `cusStateCode` is trimmed, upper-cased, and must be
  **exactly 2 characters** ([`normalizeStateCode`](customer.service.ts)).
- `cusBirthDate` / `cusMarriageDate` are parsed to dates (invalid ISO strings 400) and
  `cusCollectionDays` defaults to an empty array.
- On create, `cusBilledDate` is set to now and `cusBilledCount` to `1`; on update, `cusBilledDate`
  is refreshed to now and `cusBilledCount` is **incremented**.
- Optional fields are copied only when actually present on the payload
  ([`applyOptionalFields`](customer.service.ts) via `applyPresentFields`); on update, area / group /
  company / price-level ids fall back to the existing row when the key is absent.
- The whole create and the whole update each run in a single Prisma `$transaction`, so the customer
  write and its linked-ledger write are atomic.

### Linked account ledger (shared PK)

Every customer is backed by a row in `acc_ledger_master` that uses the **same id** as the customer:

- **On create**, the ledger is provisioned **first** via
  `accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx)`, and the returned `ledId` is
  reused as the new customer's `cusId` — establishing the 1:1 identity link.
- **On update**, if a non-deleted linked ledger exists it is kept in sync via
  `accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx)`. This is a **guarded no-op** for
  legacy customers that have no linked ledger.
- The ledger DTO is built by [`buildLinkedLedgerDto`](customer.service.ts): `ledGroupId` is taken
  from `cusAreaId` (the area shares its id with a linked account group), and the remaining shared
  fields are copied through `CUSTOMER_TO_LEDGER_FIELD_MAP` **only when present** on the customer
  payload (e.g. `cusEmail → ledEmail`, `cusGstNo → ledGstinNo`, `cusNotes → ledRemarks`,
  `cusIsActive → ledIsActive`).
- On update, a name collision raised by the ledger write (`ConflictException`, from the ledger's
  company-scoped name uniqueness) is re-surfaced in the customer's vocabulary as a `cusName`
  conflict rather than leaking the `ledName` field.

### Soft delete

- **Soft delete only** — the customer is never hard-deleted. `DELETE /delete` sets
  `cusIsDeleted = true`, `cusIsActive = false`, and stamps `cusModifiedOn` / `cusModifiedBy`.
- Within the same transaction, the **linked ledger is soft-deleted too** (`updateMany` where
  `ledId = cusId`, setting `ledIsDeleted = true` / `ledIsActive = false`) so it can't stay active
  while the customer is logically deleted; a no-op for rows with no linked ledger.

## Validation & business rules

- **Referenced masters must exist and be active** before create/update:
  `cusCompanyId` (when provided), `cusAreaId`, and `cusGroupId` are checked via
  [`ensureCompanyExists`](customer.service.ts), [`ensureAreaExists`](customer.service.ts), and
  [`ensureCustomerGroupExists`](customer.service.ts); a missing/inactive reference yields a 400 on
  the corresponding `cus*` field.
- **Uniqueness** — Prisma unique-constraint violations are mapped to a `409` "Customer already
  exists" against `cusName` ([`throwOnUniqueConstraintError`](customer.service.ts)).
- The exception filter narrows raw errors to `cus*` field names via the regex `\b(cus[A-Za-z0-9]+)\b`.

## Audit logging

Every mutation is audited through `AuditLogService.logEntityChange` (table `customers`, screen
`Customer Master`, screen type `master`), capturing original vs. modified records:

- Create → action `New`; Update → action `update`; Soft delete → action `cancel`.
- The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`
  (create/update also honor an explicit `cusCreatedBy` / `cusModifiedBy` via `resolveActor`).

## Related names on read

`GET /get` enriches the payload with names resolved from linked masters
([`resolveRelatedNames`](customer.service.ts)): `cusCompanyName`, `cusBranchName`, `cusAreaName`,
`cusGroupName`, and `cusPriceLevelName`.
