# Notes 70 — item-related masters: what the server side did (2026-09-30)

Answer to notes 70 (client + backend + live audit of menu 34's masters). Migration
`20260930170000_item_masters_notes_70` (applied to 192.168.0.106), the services under
`src/modules/Inventory`, and `test/item-masters-notes-70.e2e-spec.ts` (one rolled-back
transaction). That round is in commit 0626a3c7.

**2026-10-01 — D2–D5 decided and built** (migration `20261001100000_item_masters_notes_70_d2_d5`,
applied to 192.168.0.106; five more e2e cases, 19 in all; not committed yet). See the D table.

## For the client

| Route / key | Change |
|---|---|
| `DELETE /{item-groups,item-brands,item-sections,item-categories,units,godowns,item-qty-prices}/delete` | Deletes only. An already deleted row is **409** (was: restored it). |
| `POST /…/restore` on the same seven | **New.** Same id parameter as the DELETE (qty-price: query or body, single or array). 409 when the row is not deleted, or when its parent / base unit is. |
| grid 45 / 50 / 67 `grid_param` | `iunit_is_deleted` / `isec_is_deleted` / `iitem_is_deleted` — now bound and filtering. |
| dropdowns 17 / 19 / 20 / 26 `dropdown_param` | Optional **`iexclude_id`** = the row being edited: it and its whole subtree drop out of the parent picker. Optional **`ibranch_id`** on 26: that branch's godowns only. Absent = exactly the old list. |
| `*_level` on the five tree masters | Accepted and ignored — the server sets it (depth, root = 1). |
| dropdown 18 `dropdown_param` (2026-10-01) | Optional **`iexclude_id`** on the parent-BRAND picker too: brands are a tree (D4). |
| `category_tax_claim / _default_tax_id / _default_hsn / _default_uom_id` (2026-10-01) | **Stored now** and returned by GET (were accepted and dropped). `""` HSN is stored as null. |
| `/items/create` (2026-10-01) | A blank `item_default_tax_id` / `item_hsn_code` / `item_base_unit_id` is **filled from the group, else the category** (D3). Send a value to override. Not on update. |
| `sec_sort` / `sec_position` (2026-10-01) | One fact: sending either sets both (`sec_sort` wins if both differ). Grid 50 and dropdown 19 list by `sec_sort`, then name. |
| `/tax-rates/delete`, `/units/delete` (2026-10-01) | Also **409** while a live group or category names the rate / unit as its default. |
| `tax_name` on `/tax-rates/create` with a `tax_id` | May be omitted. |

## A — list grids (done)

A1 / A2 / A3: grid SQL fixed by the migration (bare-token convention of grid 55) and grid 67 in
`prisma/seed/Grid_Details.sql` (the seed already had 45 / 50 right — the dev DB had drifted, and
the seed's `ON CONFLICT DO NOTHING` never repairs a drifted row). Verified over HTTP: 45 → 21 live /
3 deleted, 50 → 36 / 9, 67 → 10,242 / 13.

## B — hierarchy (done)

One helper, `Inventory/utils/master-tree.helper.ts`, used by group, brand, section, category and
godown:

- **B1 / B2** — `relevelSubtree`: level = depth, set on every create / update, cascaded to the
  subtree. The migration backfilled every row of the five tables (dev had null, 0, 2, 7, 45, 784).
- **B3** — `assertNotUnderOwnSubtree`: a re-parent under the node itself or a descendant is 400.
- **B4** — `assertNoLiveChildren` + `assertNoLiveReferences`: DELETE is 409 while live children
  exist, and for group / brand / section / category while live items reference it.
- **B5** — the root cause is general: the build targets ES2022, so every declared DTO field is an
  own property (`undefined`) even when unsent, and `hasOwnProperty(dto, k) ? dto.k ?? null : stored`
  cleared an omitted key. Godown now uses `!== undefined` for `gdl_parent_id` and `gdl_name`
  (`null` / `""` still clear). The same pattern was fixed in the other four masters' parent logic
  (an omitted parent read as "moved to root" and shuffled the path caches), in units
  (`unit_base_unit_id` / `unit_conversion`) and in tax rates (`tax_supersedes_id`).
- **B6** — `gdl_type` `@IsIn` WAREHOUSE / ZONE / AISLE / RACK / SHELF / BIN (400) plus
  `ck_gdl_type` (NOT VALID: new writes only, no legacy row can fail the migration).
- Also fixed on the way: brand, section, category and godown read the subtree **before** un-deleting
  a row on restore, got nothing, and never put the ids back into the ancestors' path caches. Group
  already had this right.

## C — delete (done)

- **C1** — seven masters split into DELETE + RESTORE (table above).
- **C2** — unit: 409 while a live pack unit is built on it, an item unit conversion uses it (as unit
  or base), or an item has it as base unit. Restoring a pack unit whose base is deleted is 409.
- **C3** — tax rate: 409 while a live item defaults to it, a live item has an open tax-history
  window on it, or a live ledger / charge points at it. Sale document lines do NOT block (a used
  rate would be undeletable for ever); its own ledger lines are deleted with it.
- **C4** — decision taken: an item with stock on hand or in transit anywhere is 409. Past
  transactions do not block (a soft delete keeps them readable). Say if transactions should block.
- **C5** — godown: 409 while child locations, stock on hand there, or a branch's
  `br_default_godown_id` point at it.
- **Notes 71 B3** — deleting a group now retires its derived GROUP-scope stock track policy
  (`StockTrackPolicyService.retireForGroup`), and restoring it derives the policy again from its
  preset. Migration `20260930180000_retire_deleted_group_policies` retired the five left behind on
  dev under already-deleted groups. Hand-authored GROUP rows are never touched.

## D — contract gaps

| # | Status |
|---|---|
| D1 | **Done — `unit_code` is the source.** `unit_uqc` is written from it on every unit save (three capital letters, else NULL) and backfilled by the migration (21 units). Nothing in this repo reads `unit_uqc`; the e-invoice / GSTR-1 / Tally readers named in the analysis now see the same value either way. |
| D2 | **Done 2026-10-01 — stored like the group's.** The React category form sends all four on every save, so they became columns (same types as `itg_*`, no FKs, like the group's) instead of leaving the DTO. |
| D3 | **Done 2026-10-01 — the server fills on create.** `ItemsMasterService.inheritClassDefaults`: for each of tax, HSN and base unit the payload leaves blank (omitted, null, `""`), the group's default, else the category's. Skipped: a default naming an inactive / deleted tax or unit, an HSN longer than `item_hsn_code` (10), and the base unit whenever the payload carries `unit_conversions`. Updates never inherit. Because the defaults now matter, tax-rate and unit DELETE also count live groups / categories that name them. `itg_alias` / `itg_tax_claim` are still read by nothing. On dev 30 of 74 live groups carry a default. |
| D4 | **Done 2026-10-01 — brands are a tree.** Dropdown 18 "ITEM BRANDS" is the React client's parent-brand picker (the notes' "no dropdown" was the Qt side) and one live brand already has a parent. Dropdown 18 got the D10 `iexclude_id`. |
| D5 | **Done 2026-10-01 — position = `sec_sort`.** Grid 50 and dropdown 19 order by `sec_sort NULLS LAST, sec_name`; `sec_position` is backfilled from `sec_sort` and written with it. The master-lookup path still sorts dropdown 19 by its `dropdown_sort_column` (`sec_name`); `/dropdown-details/run`, which both clients' pickers use, keeps the SQL order. POPUP grid 93 still lists by name. |
| D6 | **Done.** `uq_sec_name` (live rows). The migration renamed the one live duplicate on dev: "Baby Care" → "Baby Care (2)". |
| D7 | **Done.** `uq_iqp_slab` on the eight key columns **plus `iqp_effective_from`**, NULLS NOT DISTINCT, live rows — so a future-dated replacement slab can still be scheduled while a re-POST is 409. Existing duplicates are soft-deleted first (none on dev). |
| D8 | Nothing (client maps Q → R). |
| D9 | **Done.** `tax_name` optional on update; an omitted `tax_supersedes_id` no longer clears the chain. |
| D10 | **Done** — see the dropdown row in the client table. |
| D11 | Nothing (done client-side). |
| D12 | **Done.** Menu 249 → "Tracking Presets" (migration; the row came from a migration, not a seed). |

## Found on the way

- **Tax rate "GST 0%" could never be saved again.** The name / code uniqueness checks used Prisma's
  case-insensitive `equals`, which compiles to `ILIKE`: `%` and `_` are wildcards, so "GST 0%"
  "clashed" with "GST 0.25%" (and a code like "GST_18" would clash with "GST-18"). Both checks now
  compare `lower() = lower()`, exactly what `ux_tax_name` / `ux_tax_code` enforce.

## E / F

No action, as the notes say.

## Seen on the box 2026-10-01 — grid 67 regressed

A Grid Master save from 192.168.0.103 (login VKPOS) at 10:35:58 re-registered grid 67's columns
and sent back a stale `grid_sql` with **no WHERE**, undoing A3 (audit row: `grid details` / 67,
changed `columns` + `grid_sql`). The item list's "Show Only Deleted" is inert again and A1–A3 in the
e2e fails on 67. The screen that saves a grid should not resend the SQL it loaded long ago; re-apply
`WHERE item_is_deleted = iitem_is_deleted` once that editor is done.
