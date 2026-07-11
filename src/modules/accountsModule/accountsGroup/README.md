# Account Groups

CRUD API for **account groups** — the hierarchical chart-of-accounts nodes (e.g. Assets,
Liabilities, Sundry Debtors) that ledgers hang off of. Groups form a self-referencing tree, and
each group inherits its classification (type, ledger profile, nature) and company from its parent.

- **Base route:** `account-groups` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Account Groups`
- **Auth:** Bearer `access-token` (required)
- **Cache:** controller-level `@CacheTTL(1)`
- **Primary table:** `account_groups` (`accounts` schema) — PK `accGroupId` (`uuidv7()`)

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
  `accGroupDescription`, `accGroupParentId`, `accGroupSort` (applied via `applyOptionalFields`,
  respecting which keys are actually present in the payload).
- **Reserved groups** (`accGroupIsReserved`) cannot be edited or deleted.
- A group cannot be its own parent, and moving a group cannot introduce a **circular hierarchy**
  (the new parent may not be inside the group's own active subtree).

### Hierarchy maintenance (`accGroupChildIds`)

Each group carries a denormalized `accGroupChildIds` array holding its own id plus every
descendant id, kept in sync on every mutation:

- On create, the new id is appended to itself and to **all ancestor** groups (`getAncestorIds` →
  `appendChildIds`; `ensureSelfInChildIds`).
- On a **parent change**, the moved group's whole subtree (`getActiveSubtreeIds`) is removed from
  the old ancestors and appended to the new ancestors.
- On soft delete, the id is removed from all ancestor `accGroupChildIds`.

### Deletion rules

`DELETE /delete` runs in a `$transaction` and refuses when the group:

- does not exist / is already deleted (`404`),
- is **reserved** (`accGroupIsReserved`),
- has **active child groups**, or
- is referenced by **active ledgers** (`acc_ledger_master` where `ledGroupId = accGroupId`).

Delete is **soft only** — it sets `accGroupIsDeleted = true` / `accGroupIsActive = false` (rows are
never hard-deleted) and prunes the id from ancestor child-id arrays.

## Business rules

- **Group name uniqueness** is per company, case-insensitive (`ensureNameIsUnique`); a duplicate
  raises a conflict. DB-level unique/foreign-key violations are also mapped
  (`throwOnUniqueConstraintError`, `isForeignKeyConstraintError`).
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

- `AccountGroupType` — `BALANCESHEET` · `PROFITANDLOSS`
- `AccountGroupNature` — `Assets` · `Liabilities` · `Income` · `Expenses`
- `AccLedgerProfile` — `General` · `Tax` · `Bank` · `Party` · `SalesPurchase` · `Cash`
