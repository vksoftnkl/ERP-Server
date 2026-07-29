# Master Lookup

Read-only lookup API that returns `{ id, name }` **option lists** for the ERP's account and
master tables, so front-end dropdowns can be populated from a single module. One module key
selects which master to look up; every master can optionally be overridden by a user-configured
dropdown SQL query.

- **Base route:** `master-lookups` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Master Lookup`
- **Auth:** Bearer `access-token` (required)
- **Response caching:** controller-level `@CacheTTL(1)`
- **Sources:**
  - **Prisma** ([PrismaService](../../database/prisma/prisma.service.ts)) — reads ~33 master
    tables (see the [dispatch table](#lookup-dispatch)), plus `branch_master`, `fiscal_years`,
    and `dropdown_details` / `dropdown_details_columns` for configured dropdowns.
  - **Read-only Postgres pool** ([PgService.queryReadOnly](../../database/pg/pg.service.ts)) —
    runs user-configured dropdown SQL, which is untrusted.

## Files

| File | Purpose |
| --- | --- |
| [master-lookup.module.ts](master-lookup.module.ts) | Module wiring — registers the controller and service (no exports) |
| [master-lookup.controller.ts](master-lookup.controller.ts) | HTTP routes + Swagger docs |
| [master-lookup.service.ts](master-lookup.service.ts) | Fetcher registry, configured-dropdown resolution, row mapping, customer / freight / barcode / item-price resolution |
| [dto/master-lookup-query.dto.ts](dto/master-lookup-query.dto.ts) | Optional `module` / `id` query params + alias-to-canonical-key resolution |
| [dto/customer-detail-query.dto.ts](dto/customer-detail-query.dto.ts) | Query DTO for the customer-detail lookup |
| [dto/freight-charge-query.dto.ts](dto/freight-charge-query.dto.ts) | Query DTO for the freight-charge lookup |
| [dto/barcode-lookup-query.dto.ts](dto/barcode-lookup-query.dto.ts) | Query DTO for the barcode lookup |
| [dto/item-price-lookup-query.dto.ts](dto/item-price-lookup-query.dto.ts) | Query DTO for the item-price sale lookup |
| [dto/master-lookup-response.dto.ts](dto/master-lookup-response.dto.ts) | Swagger response models |
| [types/master-lookup-api.types.ts](types/master-lookup-api.types.ts) | TS contracts, module-key constants, and dropdown-name aliases |

## Endpoints

All routes are `GET` and wrap their result in `{ success: true, message, data }`.

| Method | Path | Selects which master via | Description |
| --- | --- | --- | --- |
| `GET` | `/name-id/all-accounts-and-masters` | `?module=` query param (optional), `?id=` to narrow | With no `module`: returns id-name lists for **all** modules, grouped `{ accounts, masters }`. With `module`: returns just that module's list as `{ scope, module, items }`. |
| `GET` | `/name-id/all-masters` | `?module=` query param (optional), `?id=` to narrow | Master-scope id-name lists as a single flat `NameIdOption[]`. |
| `GET` | `/branches/by-company/:companyId` | Fixed to branches, scoped by company | Active branches for the given company UUID. |
| `GET` | `/fiscal-years/by-company/:companyId` | Fixed to fiscal years, scoped by company | Non-deleted fiscal years for the given company UUID (current-first). |
| `GET` | `/customer-detail` | `?cus_id=&company_id=&branch_id=&regional=` | Resolve one customer into a flat detail row (legacy `iflag=7`). |
| `GET` | `/freight-charges/charge` | `?distance=` | Freight-charge slabs whose km range covers the distance (legacy `iflag=9`). |
| `GET` | `/item-by-barcode` | `?barcode=` | Resolve a scanned EAN code to its item + selling unit (legacy `iflag=10`). |
| `GET` | `/item-price` | `?item_id=&price_level=` (+ optional `company_id`, `branch_id`, `unit_id`, `customer_id`, `godown_id`, `acccyear`, `regional`, `loading_type`, `freight_type`) | Resolve one item into a single sale-lookup row — effective price, tax block, stock, reorder, resolved loading and freight charges (legacy `getItemForSale`). `@CacheTTL(60)`. |
| `GET` | `/dropdown/:dropdownId` | Numeric configured-dropdown id | Runs one configured dropdown's stored SQL directly and returns its rows as options. |

### Item-price sale lookup (`GET /item-price`)

Ports the legacy PL/pgSQL `getItemForSale` cursor onto the current UUID schema, resolving one
item + one unit rate (`item_price_master`, PK `ipm_id`) into a single flat row: the effective
price for the requested price level, the tax block, stock, reorder level and negative-stock rule.

- **Unit-rate pick:** an explicit `unit_id` wins; otherwise the unit-slno rule applies — a retail
  item takes the highest `iuc_unit_slno` (largest pack) on the price row's conversion, a
  non-retail item takes the lowest (the base unit). The legacy cursor hard-coded slno 0 for the
  base unit; `item_unit_conversion` numbers an item's units from 1, so the rule is lowest-slno,
  not `= 0`.
- **Godown override:** an explicit `godown_id` overrides the rate's own `ipm_godown_id`, both for
  the resolved godown row and the stock scope.
- **Price level (1–7):** maps to A / B / C / D / max / min / cost. A `customer_id` subtracts the
  matching `cust_item_rates.csr_disc_qty` — but only for levels 1–4 (never max/min/cost).
- **Stock:** `SUM(isb_closing_qty)` for the item/unit/company/branch and `acccyear`; scoped to the
  resolved godown (a godown-less price row sums across all godowns). `stock` is null without `acccyear`.
- **Company / branch are optional:** without `branch_id` the item and its price rows resolve across
  all branches; without `company_id` there is no company scope, so GST stays applicable and the
  company leg of the negative-stock rule drops out. A missing one also widens the stock sum.
- **NULL-branch rates:** a price row (or item) with `ipm_branch_id` / `item_branch_id` NULL applies
  to every branch, so a `branch_id` lookup picks those up too. When both a branch row and a
  branch-less one price the same unit, the branch-specific rate wins; the branch-less one only
  stands in for units the branch does not price itself.
- **Loading / freight charge:** both resolved server-side, from `loading_type` and `freight_type` —
  see below.
- **Tax:** loaded from `item_tax_master` via the item's `item_default_tax_id`; GST/cess percentages
  are zeroed when the company has GST disabled. `item_incl_tax` is the exception — it comes straight
  off `item_master` and tells the caller whether the returned prices already carry tax, so the GST
  toggle does not change it.
- **Name:** `regional=true` returns `item_name_ta` (falling back to English), else the English name.

#### Loading charge resolution (`loading_type`)

The charge the voucher line should carry is resolved here rather than on the client. All three
modes return the same two keys, so a screen reads one shape:

| Key | Meaning |
| --- | --- |
| `loading_charge` | The charge, or `null` when nothing was resolved. **Never 0-as-unknown.** |
| `resolved_weight` | Weight the slab was matched on (`auto` only, else `null`) |

- **`manual`** (also what an omitted `loading_type` resolves as) — nothing is looked up, no query
  runs against `sale_loading_charges`. Returns `null`, so the user types the charge in.
- **`item_basis`** — `item_price_master.ipm_loading_charge` off the price row already selected, as
  stored. No weight, no qty, no slab. Read-only on the screen. The column is `NOT NULL DEFAULT 0`,
  so a stored `0` is indistinguishable from "never configured" and is reported as `null`.
- **`auto`** — matches a weight slab in `sale_loading_charges`. Requires `company_id` **and**
  `branch_id` (400 without them: an unscoped slab match would be a cross-tenant read). The charge
  is **flat per slab** — `ilc_load_chrg` applies whole, unmultiplied by the weight, since the
  master carries no charge-mode column.
  - **Weight:** always the resolved unit's own `iuc_uom_weight` on the conversion the selected rate
    hangs off — `item_master` has no weight column of its own, and the lookup takes no weight or
    quantity from the caller. A conversion without a UOM weight → **400**. The value stays a
    `Prisma.Decimal`, so a 3-decimal weight reaches the slab comparison without a float tail.
  - **Slab match:** half-open — `from_weight <= weight < to_weight` — so a weight sitting exactly
    on a boundary belongs to the slab it opens, never to the one it closes. `ilc_is_deleted = false`
    and `ilc_is_active = true` are part of the query, not a post-fetch filter.
  - **Scope precedence:** both scope columns are nullable (NULL company = a global default, NULL
    branch = every branch of the company), so up to four scopes can match one weight. They rank
    company before branch: `company + branch` > `company, any branch` > `branch only` > `global`.
  - **No slab:** `null` — the charge is unknown, not zero.
  - Overlapping slabs within one scope are prevented in the DB by the GiST exclusion constraint
    `excl_ilc_slab_overlap` (migration `20260728120000`); the lookup's own oldest-PK tie-break is
    only a fallback for data predating it.

An unknown `loading_type` is a 400 that names the allowed values. `item_allow_loading` does **not**
gate this block, and the unit master's own per-unit rate (`unit_loading`) is no longer returned by
this lookup — the resolved charge above is the only loading value in the payload.

#### Freight charge resolution (`freight_type`)

The same shape as loading, one mode short. `freight_charge` is in the payload in both modes; only
the value differs, and `null` always means "nothing resolved", never a real 0.

- **`manual`** (also what an omitted `freight_type` resolves as) — nothing is looked up. Returns
  `null`, so the user types the charge in.
- **`item_basis`** — `item_price_master.ipm_freight_charge` off the price row already selected, as
  stored. The column is `NOT NULL DEFAULT 0`, so a stored `0` is indistinguishable from "never
  configured" and is reported as `null`.

There is **no `auto`**: `sale_freight_charges` slabs are matched on distance, which this lookup is
never given — [`GET /freight-charges/charge?distance=`](#endpoints) resolves those. An unknown
`freight_type` is a 400 naming the allowed values; `auto` is rejected there like any other unknown.
`item_allow_freight` does **not** gate the resolution — it rides along as `add_freight` for the
screen to act on.

### Selecting a master (`module` query param)

The `module` value on `/name-id/all-accounts-and-masters` is resolved in
[master-lookup-query.dto.ts](dto/master-lookup-query.dto.ts):

- A canonical key from [`LOOKUP_MODULE_KEYS`](#supported-lookup-keys) (case-insensitive) is
  accepted as-is.
- Otherwise the value is normalized and matched against `LOOKUP_MODULE_ALIASES` — so route/display
  aliases like `item-group-master`, `tax-master`, `gsp-service-master`, `statecode`,
  `pricelevel`, `hsncode`, `acc_ledger_master`, etc. resolve to their canonical key.
- Unresolvable values fail `@IsIn(LOOKUP_MODULE_KEYS)` validation (400).
- Omitting `module` returns the full grouped payload.

### Reading one row (`id` query param)

Both `/name-id/...` routes accept an optional `id`, which narrows the result to the single row
carrying it — so `?module=companyGroups&id=<cog_group_id>` is a by-id read of that master:

```
GET /api/v1/master-lookups/name-id/all-masters?module=companyGroups&id=019cad4b-84db-7a76-a67f-41e7e6adb9ce
→ { "success": true, "message": "Data fetched successfully",
    "data": [{ "id": "019cad4b-84db-7a76-a67f-41e7e6adb9ce", "name": "Retail Group" }] }
```

- **Which id.** The one the module's own table keys the option by — a UUID for most masters, but
  the state code for `stateCodes`, the HSN code for `hsnCodes`, and a number for `priceLevels` /
  `tenderTypes`. It is always the `id` a previous call to the same endpoint handed back.
- **Matched on the option id, not pushed into the query.** A module's option id is not always its
  table PK, and a [configured dropdown](#configured-dropdown-sql)'s id column is whatever its
  stored SQL selects — so the filter is applied to the produced option in
  [`fetchModuleItems`](master-lookup.service.ts), which keeps the by-id read consistent with the
  list it came from on both the Prisma and configured-SQL paths. The trade-off is that the
  module's list is still read in full before it is narrowed.
- **Exact string match**, after the DTO trims the value. A blank `id` is treated as absent.
- **Without `module`**, every module in scope is searched — `/all-masters` scans the master
  modules, `/all-accounts-and-masters` scans all of them and returns the grouped payload with the
  owning module's list holding the row and the rest empty.
- **Nothing matching is an empty list**, not a 404: `id` is a filter on a list endpoint, not a
  single-resource route.

## Lookup dispatch

For every requested module, [`fetchModuleItems`](master-lookup.service.ts) first tries a matching
**user-configured dropdown**; if none matches or it fails, it falls back to the module's **built-in
Prisma fetcher**.

1. **Configured-dropdown override.** [`loadLookupDropdownConfigs`](master-lookup.service.ts) reads
   all `dropdown_details` rows (with visible columns) and matches one to each module by name —
   exact match, then normalized-token match, against the union of the module key,
   `MODULE_DROPDOWN_NAME_ALIASES`, and `LOOKUP_MODULE_ALIASES`. Token normalization strips the
   noise words `master`, `lookup`, `dropdown` and splits camelCase/punctuation.
2. **Built-in fetcher fallback.** Each module maps to a hard-coded Prisma query in the
   `moduleFetchers` registry below.

### Built-in fetchers (key → source)

Unless noted, each fetcher filters `…IsDeleted = false` **and** `…IsActive = true`, selects the id
and name columns, and orders by `name asc, id asc`. `id` is coerced to a string; a blank name
falls back to the id.

**`accounts` scope** — from [`ACCOUNT_LOOKUP_MODULE_KEYS`](types/master-lookup-api.types.ts):

| Module key | Prisma model | Option `name` |
| --- | --- | --- |
| `companies` | `company` | `compName` |
| `companyGroups` | `companyGroupMaster` | `cogGroupName` |
| `branches` | `branchMaster` | `brName` |
| `accountGroups` | `accountGroup` | `accGroupName` |
| `accountLedgers` | `accLedgerMaster` | `ledName` |
| `ledgerBankAccounts` | `accLedgerBankAccount` | `accountHolder (accountNo) - ledgerName`; ordered by holder |
| `ledgerShippingAddresses` | `accShipAddr` | `saaTradeName` → `saaContactName` → ledger name; ordered by `saaSort` |
| `employeeDepartments` | `employeeDepartment` | `edptName` |
| `employeeDesignations` | `employeeDesignation` | `edName` |
| `employees` | `employeeMaster` | `empName` |
| `tenderTypes` | `accountTenderTypes` | `accttTypeName` |
| `tenders` | `accountTenderMaster` | `acctndName` |
| `gspProviders` | `gspProviderMaster` | `gspProviderName` |
| `gspCompanyServices` | `gspCompanyService` | `csgServiceType - companyName`; ordered by service type |

**`masters` scope** — from [`MASTER_LOOKUP_MODULE_KEYS`](types/master-lookup-api.types.ts):

| Module key | Prisma model | Option `name` |
| --- | --- | --- |
| `itemGroups` | `itemGroupMaster` | `itgName` |
| `itemCategories` | `categoryMaster` | `categoryName` |
| `itemSections` | `itemSectionMaster` | `secName` |
| `itemBrands` | `itemBrandMaster` | `brand_name` |
| `units` | `unit` | `unit_name` |
| `itemTaxes` | `itemTaxMaster` | `taxName` |
| `priceLevels` | `priceLevel` | `priceLvlName` → `priceLvlShort` |
| `hsnCodes` | `hsnMaster` | `hsnCode` (both id and name); filters **`hsnIsActive` only** |
| `items` | `itemMaster` | `itemNameEn` |
| `godownLocations` | `godownLocation` | `gdlName` |
| `stateCodes` | `stateCode` | `stateName`; id is `stateCode`, filters `isDeleted`/`isActive` |
| `states` | `stateMaster` | `stmName` |
| `cities` | `cityMaster` | `ctmName` |
| `areas` | `areaMaster` | `armName` |
| `customerGroups` | `custGroup` | `cgrName` → `cgrAlias` |
| `customers` | `customer` | `cusName` |
| `supplierGroups` | `supplierGroup` | `spgName` |
| `suppliers` | `supplier` | `supName` |
| `userMasters` | `userMaster` | `usrDisplayName` |

### Configured dropdown SQL

When a dropdown config matches (or via `GET /dropdown/:dropdownId`),
[`tryFetchConfiguredModuleItems`](master-lookup.service.ts) runs its stored SQL:

- **Candidates & order.** Tries `dropdownSqlRegional` first, then `dropdownSql`. On query error it
  moves to the next candidate; if all fail it returns `null` and the caller falls back to the
  built-in fetcher (`GET /dropdown/:dropdownId` returns `[]` on failure or unknown id).
- **Sanitization** (`normalizeConfiguredSql`): trims and strips trailing `;`, requires the statement
  to start with `SELECT`/`WITH`, rejects any statement containing an inner `;` (no multi-statement),
  removes trailing commas before clauses, and rejects dangling-dot patterns (e.g. `t. FROM`).
- **Table remapping** (`CONFIGURED_SQL_TABLE_REPLACEMENTS`): rewrites stale references —
  `inventory.units` → `inventory.item_unit_master`, `accounts.companys` → `public.companys`,
  `accounts.branch_master` → `public.branch_master`.
- **Execution:** runs on the read-only pool via `pg.queryReadOnly`.
- **Row → option mapping** (`mapConfiguredRowToOption`): picks the id column by likely-id tokens
  (`id` / `uuid` / `value`, else the first column) and the name column by likely-name tokens
  (`name` / `label` / `title` / `alias` / `short` / `description`); rows without an id value are
  dropped. Each option also spreads the full serialized row (bigint→string, Date→ISO), so configured
  results can carry extra columns beyond `id`/`name`.
- **Ordering:** by `dropdownSortColumn` / `dropdownSortOrder` (`DESC` reverses) when present,
  otherwise by option `name`; ties break on `id`, all via locale-aware numeric compare.

## Response shapes

Grounded in [types/master-lookup-api.types.ts](types/master-lookup-api.types.ts) and
[dto/master-lookup-response.dto.ts](dto/master-lookup-response.dto.ts):

- **`NameIdOption`** — `{ id: string; name: string; [key: string]: unknown }`. Configured-SQL
  options may include additional row columns.
- **Grouped payload** (`/name-id/...` with no `module`) — `{ accounts: {...}, masters: {...} }`,
  each group keyed by its module keys with `NameIdOption[]` values.
- **Single-module payload** (`/name-id/...?module=`) — `{ scope: 'accounts' | 'masters', module,
  items: NameIdOption[] }`; `scope` is derived from whether the key is in
  `ACCOUNT_LOOKUP_MODULE_KEYS`.
- **`FiscalYearOption`** (`/fiscal-years/...`) — `{ id, name, beginDate, endDate, status,
  isCurrent }`; dates are emitted as `YYYY-MM-DD` (or `null`).
- **Branches / dropdown** — `NameIdOption[]`.

## Supported lookup keys

[types/master-lookup-api.types.ts](types/master-lookup-api.types.ts) defines the accepted module
keys as `as const` string-literal arrays (used as the Swagger `enum` and validated by the query
DTO) rather than TypeScript `enum`s:

- **`ACCOUNT_LOOKUP_MODULE_KEYS`** (`accounts` scope): `companies`, `companyGroups`, `branches`,
  `accountGroups`, `accountLedgers`, `ledgerBankAccounts`, `ledgerShippingAddresses`,
  `employeeDepartments`, `employeeDesignations`, `employees`, `tenderTypes`, `tenders`,
  `gspProviders`, `gspCompanyServices`.
- **`MASTER_LOOKUP_MODULE_KEYS`** (`masters` scope): `itemGroups`, `itemCategories`, `itemSections`,
  `itemBrands`, `units`, `itemTaxes`, `priceLevels`, `hsnCodes`, `items`, `godownLocations`,
  `stateCodes`, `states`, `cities`, `areas`, `customerGroups`, `customers`, `supplierGroups`,
  `suppliers`, `userMasters`.
- **`LOOKUP_MODULE_KEYS`** — the concatenation of both, and the full set accepted by `?module=`.
- **`LOOKUP_MODULE_ALIASES`** — per-key alias lists (route/display/table names) used to resolve the
  `module` param and to match configured dropdowns to a module.
