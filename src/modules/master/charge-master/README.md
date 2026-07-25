# Charge Master

Shared "additional charges" master used by both **Sales** and **Purchase**
(freight, packing, insurance, cash discount, …). Table: `public.charge_master`
(Prisma model `ChargeMaster`, fragment `prisma/public/chargeMaster.prisma`,
migration `20260724120000_create_charge_master`).

## Endpoints (`/charges`, `API_VERSION`)

| Method | Path              | Purpose                                        |
| ------ | ----------------- | ---------------------------------------------- |
| POST   | `/charges/create` | Create (no `chgId`) or update (with `chgId`)   |
| GET    | `/charges/get`    | Fetch one by `chgId`, or many by `chgModule`   |
| DELETE | `/charges/delete` | Soft delete by `chgId`                         |

## Notes

- **`GET /charges/get` takes exactly one of `chgId` or `chgModule`** (neither or
  both → 400).
  - `chgId` → `data` is a single charge object.
  - `chgModule` → `data` is an array of the charges that module can apply.
    Because a `B` charge is shared, `P` returns `P + B`, `S` returns `S + B`,
    and `B` returns `B` only (`CHARGE_MODULE_LOOKUP` / `resolveChargeModules`).
    The list is meant for the entry screens, so it is restricted to
    `chg_is_active = true` rows and ordered by `chgDispOrder` (nulls last) then
    `chgName`. It is unpaginated — the master is small by design.
- **Soft delete** — sets `chg_is_deleted = true` / `chg_is_active = false`; rows
  are never physically removed and are excluded from all reads.
- **Enum-style fields** (`chgModule`, `chgRole`, `chgMethod`, `chgType`,
  `chgApplyOn`, `chgCostAlloc`) are upper-cased on input and validated against
  the value sets in `types/charge-master-api.types.ts` — by the DTO's `@IsIn`
  lists on the HTTP path and again by `ChargeMasterService.ensureValuesAreAllowed`
  (`CHARGE_VALUE_GUARDS`) on every write. The DB no longer checks them: the
  `ck_chg_*` constraints were dropped in migration
  `20260724130000_drop_charge_master_check_constraints`, so this module is the
  only place the allowed values are defined. `chgRole` and `chgCostAlloc` accept
  `null`; fields absent from an update request are left untouched.
- **Uniqueness**
  - `chgCode` — unique (case-insensitive) among non-deleted rows.
  - `chgRole` — at most one of `FREIGHT / LOADING / UNLOADING / CASH_DISC /
    OTHERS` per module. This mirrors the DB-only partial unique index
    `uq_charge_role` (its `WHERE` predicate is not expressible in Prisma), so it
    is enforced in the service (`ensureRoleIsUnique`).
- **`chgLedgerCode`** is a GL ledger mapping with no DB foreign key; the service
  verifies the referenced `acc_ledger_master` row exists and is active.
- **Ledger-derived response fields** — every payload echoes `chgLedgerName`,
  `ledHsnSac`, `ledGstRate` and `ledTaxability` (`led_name` / `led_hsn_sac` /
  `led_gst_rate` / `led_taxability`) read from the mapped `acc_ledger_master`
  row. They are read-only display values, not stored on `charge_master`, and are
  deliberately excluded from the audit snapshots so they never show up as a
  change.
- Audit entries are written under screen name **"Charge Master"** (auto-created
  on first write). Add an entry to `audit-screen-sql.constants.ts` if you want
  field-level projection/snapshots.
