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
  - Every set except `chgModule` is defined by an enum in
    [`types/charge-enum.ts`](types/charge-enum.ts) — `ChargeRole`, `ChargeMethod`,
    `ChargeType`, `ChargeApplyOn`, `ChargeCostAlloc`, plus `ChargeDocType` for the
    `txn_charge_detail` discriminator. The `CHARGE_*` arrays this module's `@IsIn`
    lists and guards consume are derived from those enums, so the two cannot
    drift; the charge-detail DTOs type their `cd_*` fields with the enums directly
    (`@IsEnum`).
- **Uniqueness**
  - `chgCode` — unique (case-insensitive) among non-deleted rows.
  - `chgRole` — at most one of `FREIGHT / LOADING / UNLOADING / CASH_DISC /
    OTHERS` per module. This mirrors the DB-only partial unique index
    `uq_charge_role` (its `WHERE` predicate is not expressible in Prisma), so it
    is enforced in the service (`ensureRoleIsUnique`).
- **`chgLedgerCode`** is a GL ledger mapping with no DB foreign key; the service
  verifies the referenced `acc_ledger_master` row exists and is active.
- **Ledger-derived response fields** — every payload echoes `chgLedgerName` and
  `ledHsnSac` (`led_name` / `led_hsn_sac`) read from the mapped
  `acc_ledger_master` row. They are read-only display values, not stored on
  `charge_master`, and are deliberately excluded from the audit snapshots so
  they never show up as a change. `ledGstRate` / `ledTaxability` were echoed
  here until 20260912100000 dropped those columns in favour of `led_tax_id`.
- **The effective rate (CHG-TAX)** — every payload also carries the rate the
  entry screens price the charge at, resolved through `inventory.tax_rate_master`:
  `chgTaxRate` (total %), `chgTaxCgstPerc` / `chgTaxSgstPerc` / `chgTaxIgstPerc` /
  `chgTaxCessPerc`, `chgTaxTaxability`, and `chgTaxSource` (`CHARGE` when
  `chgTaxId` names it, `LEDGER` when the charge inherits the ledger's
  `led_tax_id`, null when neither does). `ledTaxId` and `ledgerTaxPerc` carry
  the ledger's own id and rate regardless of the override, and `ledGstRate`
  repeats `chgTaxRate` under the name the Qt charge grid still reads. All of
  them are derived and read-only, and like `chgLedgerName` they stay out of
  the audit snapshots.
- **`chgTaxId`** — the per-charge GST rate override
  (`chg_tax_id` -> `inventory.tax_rate_master`, migration
  `20260912070000_add_chg_tax_id`). Accepted on create and update, and echoed
  back with `chgTaxName` (the rate's `tax_name`, a read-only display value
  resolved through the `tax` relation and kept out of the audit snapshots —
  `chgTaxId` itself is a stored column and is audited normally).
  - `null` — the normal case — inherits the posting ledger's `led_tax_id`, so
    several charges can share one revenue ledger and still differ on rate.
  - It must be `null` unless `chgTaxApl` is true **and** `chgBeforeTax` is
    false: a before-tax charge is taxed at the *item's* rate inside the item
    line and a non-taxable charge is never taxed, so a rate here would be one
    nothing reads. This is the DB CHECK `ck_chg_tax_id`, restated in
    `ensureTaxIdIsApplicable` (against the values an update *resolves* to, not
    just the ones it sends) so it comes back as a 400 naming `chgTaxId` rather
    than a raw 23514. `txn_charge_detail` restates the same rule for
    `cdTaxCode`.
  - `fk_chg_tax` only proves the row exists, so a rate the request names is
    also checked for being live (`assertTaxRateRefs`: not soft-deleted, not
    deactivated). An update that leaves `chgTaxId` untouched skips that check —
    a rate retired after the fact must not block an unrelated edit.
- Audit entries are written under screen name **"Charge Master"** (auto-created
  on first write). Add an entry to `audit-screen-sql.constants.ts` if you want
  field-level projection/snapshots.
