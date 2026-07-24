# Charge Master

Shared "additional charges" master used by both **Sales** and **Purchase**
(freight, packing, insurance, cash discount, …). Table: `public.charge_master`
(Prisma model `ChargeMaster`, fragment `prisma/public/chargeMaster.prisma`,
migration `20260724120000_create_charge_master`).

## Endpoints (`/charges`, `API_VERSION`)

| Method | Path              | Purpose                                        |
| ------ | ----------------- | ---------------------------------------------- |
| POST   | `/charges/create` | Create (no `chgId`) or update (with `chgId`)   |
| GET    | `/charges/get`    | Fetch one by `chgId`                           |
| DELETE | `/charges/delete` | Soft delete by `chgId`                         |

## Notes

- **Soft delete** — sets `chg_is_deleted = true` / `chg_is_active = false`; rows
  are never physically removed and are excluded from all reads.
- **Enum-style fields** (`chgModule`, `chgRole`, `chgMethod`, `chgType`,
  `chgApplyOn`, `chgCostAlloc`) are validated in the DTO against the same value
  sets as the DB `CHECK` constraints and are upper-cased on input.
- **Uniqueness**
  - `chgCode` — unique (case-insensitive) among non-deleted rows.
  - `chgRole` — at most one of `FREIGHT / LOADING / UNLOADING / CASH_DISC /
    OTHERS` per module. This mirrors the DB-only partial unique index
    `uq_charge_role` (its `WHERE` predicate is not expressible in Prisma), so it
    is enforced in the service (`ensureRoleIsUnique`).
- **`chgLedgerCode`** is a GL ledger mapping with no DB foreign key; the service
  verifies the referenced `acc_ledger_master` row exists and is active.
- Audit entries are written under screen name **"Charge Master"** (auto-created
  on first write). Add an entry to `audit-screen-sql.constants.ts` if you want
  field-level projection/snapshots.
