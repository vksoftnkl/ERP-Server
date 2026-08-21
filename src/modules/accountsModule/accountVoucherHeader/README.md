# Account Voucher Header

Transaction-composable helper functions for the **account voucher header** —
the top row of every accounting voucher (receipt, payment, journal, etc.).
The helpers generate the scoped voucher numbers/serials, build the Prisma
create/update inputs, and soft-delete (cancel) a header. There is **no
controller, service, or NestJS module here** — callers import these functions
into their own transactions.

- **Kind:** plain exported functions (no HTTP surface, no DI provider)
- **Base route / Swagger tag / auth:** none — this module is not registered as a NestJS module and exposes no routes
- **Primary table:** `acc_voucher_header` (`accounts` schema) — PK `avhVoucherId` (`avh_voucher_id`)
- **Read dependency:** `acc_voucher_types` (model `AccVoucherType`, PK `vchrTypeId`) — read to resolve `vchrTypeCode` for the ref no
- **Persistence:** Prisma via a caller-supplied `PrismaService` **or** `Prisma.TransactionClient`

## Files

| File | Purpose |
| --- | --- |
| [account-voucher-header.helper.ts](account-voucher-header.helper.ts) | All logic — voucher numbering, create/update input builders, and the create / update / soft-delete entry points |
| [account-voucher-header.helper.spec.ts](account-voucher-header.helper.spec.ts) | Jest unit tests (mocked Prisma clients) covering numbering, renumbering-on-scope-change, and soft-delete |

## Exported API

Each entry point accepts an `AccountVoucherHeaderWriteClient` — a `PrismaService`
**or** a `Prisma.TransactionClient`. When handed a `PrismaService` it opens its
own `$transaction`; when handed a transaction client it runs inline so a caller
can compose the write into a larger unit of work.

| Function | Behaviour |
| --- | --- |
| `createAccountVoucherHeader(client, payload)` | Insert a new header with generated numbers; returns the created `AccVoucherHeader`. |
| `updateAccountVoucherHeader(client, avhVoucherId, payload)` | Update an active header, renumbering only when the numbering scope changes (see below). |
| `softDeleteAccountVoucherHeader(client, avhVoucherId, payload?)` | Cancel + soft-delete a header. |
| `buildAccountVoucherHeaderCreateInput(client, payload)` | Build the Prisma create input **without** persisting — must be called with a transaction client. |
| `buildAccountVoucherHeaderUpdateInput(client, avhVoucherId, payload)` | Build the Prisma update input **without** persisting — must be called with a transaction client. |

The two `build*` functions throw `BadRequestException` if passed a root
`PrismaService`, because they rely on advisory locks held for the caller's
transaction.

Exported payload types (`avhVoucherId` / numbering fields are server-managed and
omitted from the inputs): `CreateAccountVoucherHeaderPayload`,
`UpdateAccountVoucherHeaderPayload`, `SoftDeleteAccountVoucherHeaderPayload`,
and the `AccountVoucherHeaderWriteClient` union.

## Voucher numbering

Numbers are derived at write time, never taken from the caller:

- **`avhVoucherNo`** — running number scoped to `(avhAccYear, avhCompanyId, avhBranchId)`; next = current max + 1.
- **`avhVoucherSlno`** — serial scoped to `(avhAccYear, avhCompanyId, avhBranchId, avhVoucherTypeId)`; next = current max + 1.
- **`avhVoucherRefno`** — `` `${vchrTypeCode}-${avhVoucherSlno}` `` (e.g. `JV-5`), using the current `vchrTypeCode` resolved from `acc_voucher_types`.
- **`avhBillRefno`** — seeded to the same value as `avhVoucherRefno` on create.
- Concurrency is serialized with **Postgres transaction-scoped advisory locks** (`pg_advisory_xact_lock`) taken in a fixed order (voucher-no scope, then slno scope) so concurrent writers cannot deadlock or collide on numbers.

## Create semantics

- Validates scope first (`avhAccYear`, `avhCompanyId`, `avhBranchId` required non-blank strings; `avhVoucherTypeId` a positive integer).
- Resolves the voucher type and rejects a missing type (`NotFoundException`) or blank `vchrTypeCode` (`BadRequestException`).
- If `avhVoucherDate` is provided, `avhBillDate` is synced to it (`syncBillDateWithVoucherDate`).

## Update semantics

- Loads the existing **non-deleted** header or throws `NotFoundException`.
- Resolves the effective scope by merging the payload over the existing row.
- **Renumbers only when necessary:**
  - Voucher-no scope changed (`avhAccYear` / `avhCompanyId` / `avhBranchId`) → regenerate `avhVoucherNo`, `avhVoucherSlno`, and ref nos.
  - Only `avhVoucherTypeId` changed → regenerate `avhVoucherSlno` and ref nos, but keep `avhVoucherNo`.
  - Neither changed → no advisory locks, no renumbering; just apply the patched fields and bump `avhUpdatedOn`.
- `avhVoucherDate` → `avhBillDate` sync applies here too.

## Soft delete

- Loads the active header (throws `NotFoundException` if missing/deleted), then updates it to `avhIsActive = false`, `avhIsDeleted = true`, `avhVoucherStatus = CANCELLED`, stamping `avhStatusOn` / `avhUpdatedOn`.
- Optional `payload` fields are applied only when present: `avhUpdatedBy`, `avhStatusBy` (defaults to `avhUpdatedBy` when omitted), and `avhCancelReason`.
- Rows are never hard-deleted.

## Status

**Partial / WIP.** This folder contains only the helper and its unit test. There
is **no `*.module.ts`, controller, service, DTOs, or `types/` folder**, so the
module is not registered with NestJS and exposes no HTTP endpoints or DI
provider. The functions are consumed by other modules that compose voucher-header
writes into their own transactions; wiring a controller/service (or a shared
provider) would be the remaining work to make this a self-contained module.

## Status: disabled

`account-voucher-header.helper.ts` is fully commented out as of `61f16c1`, so this
folder currently exports nothing. Its unit test is parked as
`account-voucher-header.helper.spec.ts.disabled` — kept for restoration, but held
out of Jest's `testRegex` (`.*\.spec\.ts$`) and `tsc`, which would otherwise fail
on a spec importing a module with no exports.

To restore: uncomment the helper, drop the `.disabled` suffix, then reconcile the
test against the current schema (`avhBillRefno`, `avhBillDate` and `avhUpdatedOn`
were removed from `AccVoucherHeader`).
