# Account Groups

CRUD API for **account groups** — the hierarchical chart-of-accounts nodes (e.g. Assets,
Liabilities, Sundry Debtors) that ledgers hang off of. Groups form a self-referencing tree, and
each group inherits its classification (type, ledger profile, nature) and company from its parent.

- **Base route:** `account-groups` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Account Groups`
- **Auth:** Bearer `access-token` (required)
- **Cache:** controller-level `@CacheTTL(1)`
- **Primary table:** `acc_group_master` (`accounts` schema) — PK `accGroupId` (`uuidv7()`)

## Files

| File | Purpose |
| --- | --- |
| [accounts-group.module.ts](accounts-group.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service, and exception filter |
| [accounts-group.controller.ts](accounts-group.controller.ts) | HTTP routes + Swagger docs |
| [accounts-group.service.ts](accounts-group.service.ts) | Business logic, hierarchy maintenance, persistence, audit logging |
| [account-group-exception.filter.ts](account-group-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `accGroup*` field names) |
| [dto/save-account-group.dto.ts](dto/save-account-group.dto.ts) | Single create/update payload |
| [dto/account-group-response.dto.ts](dto/account-group-response.dto.ts) | Swagger response models |
| [types/account-group-api.types.ts](types/account-group-api.types.ts) | Payload / response TypeScript contracts |
| [types/account-group-enum.ts](types/account-group-enum.ts) | App-layer enums (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an account group, chosen by presence of `accGroupId`. |
| `GET` | `/get` | Fetch one active account group by `accGroupId` (required UUID v7 query param). |
| `DELETE` | `/delete` | Soft-delete an account group by `accGroupId` (required UUID v7 query param). |

### Create / update semantics

- **Omit `accGroupId` → create; include `accGroupId` → update** the existing group.
- On **create**, `accGroupParentId` is **required** — every group must have a parent.
- **Type, company, ledger profile, and nature are never supplied by the client.** They are
  inherited from the (effective) parent (`accGroupType`, `accLedgerProfile`, `accGroupNature`,
  `accGroupCompanyId`). On update, a root group (no parent) keeps its existing values for all four.
- Only these fields are client-writable: `accGroupName`, `accGroupAlias`, `accGroupShort`,
  `accGroupDescription`, `accGroupParentId`, `accGroupSort`, the four Tally behaviour flags
  (`accGroupBehaveAsSubledger`, `accGroupNetDebitCredit`, `accGroupUsedForCalculation`,
  `accGroupAffectsGrossProfit`) and `accGroupIsActive` (applied via `applyOptionalFields`,
  respecting which keys are actually present in the payload).
- The four flags map one to one onto Tally's `ISSUBLEDGER`, `NETDEBITCREDITFORREPORTING`,
  `USEDFORCALCULATION` and `AFFECTSGROSSPROFIT`. The columns have existed since the table was
  created, `NOT NULL DEFAULT false`, but until 2026-09-17 no payload could reach them, so every
  export wrote Tally's default for all four whatever the group actually was.
- `accGroupIsActive` is **not** soft delete. An inactive group keeps its ledgers and its place in
  the tree; it just stops being offered. It was in neither DTO until 2026-09-17, so a group could
  not be deactivated from anywhere.
- **Reserved groups** (`accGroupIsReserved`) cannot be edited or deleted.
- A group cannot be its own parent, and moving a group cannot introduce a **circular hierarchy**
  (the new parent may not be inside the group's own active subtree).

### Hierarchy

The hierarchy is `accGroupParentId` and nothing else. Walk it with a recursive CTE over
`idx_acc_group_parent_id`.

`accGroupChildIds` — a denormalized array of a group's own id plus every descendant — was
**removed** on 2026-09-17 (migration `20260917140000`, column `acc_group_child_ids`). Only this
service maintained it, so every row written by anything else (the seeds, the three sales masters
that mirror into this table, a Tally import, a fix typed into psql) was born stale: on the live
box 21 of 48 groups held NULL and 14 held `{}`, and where it was populated it disagreed with
reality — `Customers` claimed 1 child against 11. It was also marked **required** in the GET
payload, so any consumer that trusted it built the wrong tree, an export most of all, since an
export has to emit parents before children.

`getActiveSubtreeIds` survives, for one purpose: refusing to reparent a group underneath one of
its own descendants.

### Deletion rules

`DELETE /delete` runs in a `$transaction` and refuses when the group:

- does not exist / is already deleted (`404`),
- is **reserved** (`accGroupIsReserved`),
- has **active child groups**, or
- is referenced by **active ledgers** (`acc_ledger_master` where `ledGroupId = accGroupId`).

Delete is **soft only** — it sets `accGroupIsDeleted = true` / `accGroupIsActive = false`; rows are
never hard-deleted.

## Business rules

- **Group name uniqueness** is *unique within what one company can see*, which is three rules, not
  one (`ensureNameIsUnique`, and `20260917110000` behind it):

  1. no two **shared** groups (`accGroupCompanyId` NULL) share a name —
     `uq_acc_group_name_shared`;
  2. no two groups in the **same company** share a name — `uq_acc_group_name_company`;
  3. a company-scoped group must not collide with a **shared** one — enforced by the trigger
     `tr_acc_group_name_scope`, because no index can say "must not match a row in the other
     scope".

  NULL `accGroupCompanyId` means *shared by every company* and is deliberate. Postgres treats
  NULLs as distinct, so a plain `UNIQUE (company_id, name)` is inert for exactly those rows.
  Matching is case-insensitive (`lower()`) because Tally matches master names that way, and a
  Tally company file receives the shared groups **plus** that company's own — Tally merges two
  same-named entries into one and combines their balances, silently.

  The service's pre-check and the DB both skip rule 3 when neither the name nor the scope is
  changing, so a row that already violates it stays editable. DB-level unique/foreign-key
  violations are also mapped (`throwOnUniqueConstraintError`, `isForeignKeyConstraintError`).
- **Parent must exist and be active** (`ensureParentExists`) for both create and (when a parent is
  given) update.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`) under screen `Account Group Master` (`master`), capturing original vs. modified
  records. The acting user comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.
- `GET /get` responses embed resolved related names — `accGroupParentName` and
  `accGroupCompanyName`. Tally identity fields (`accGroupTallyMasterId`, `accGroupTallyAlterId`)
  are `BigInt` columns serialized to strings.

## Validation rules (DTO)

From [dto/save-account-group.dto.ts](dto/save-account-group.dto.ts):

- `accGroupName` — **required**, trimmed, max 150 chars.
- `accGroupAlias` — nullable, max 100 · `accGroupShort` — nullable, max 50 ·
  `accGroupDescription` — nullable, max 250.
- `accGroupId` / `accGroupParentId` — optional/nullable UUIDs.
- `accGroupSort` — optional integer.

## Enums (app-layer)

Allowed-value validation lives in the app, not in Postgres — the equivalent `chk_acc_group_type`,
`chk_acc_group_nature`, and `chk_acc_ledger_profile` DB CHECK constraints were dropped (migration
`20260623100000_remove_acc_group_check_constraints_to_app_layer`). See
[types/account-group-enum.ts](types/account-group-enum.ts).

- `AccGroupMasterType` — `BALANCESHEET` · `PROFITANDLOSS`
- `AccGroupMasterNature` — `Assets` · `Liabilities` · `Income` · `Expenses`
- `AccLedgerProfile` — `General` · `Tax` · `Bank` · `Party` · `SalesPurchase` · `Cash`
