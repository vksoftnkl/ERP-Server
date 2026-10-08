# Items Qty Price Master

CRUD for `inventory.item_qty_price` (`ItemQtyPrice`) — quantity/date price slabs per
item + unit, optionally scoped by company, branch, party and price level.

## Slab model

- `iqp_from_qty` is the **inclusive** lower bound; `iqp_to_qty` is the **exclusive**
  upper bound (`null` = "& above"). The service rejects `iqp_to_qty <= iqp_from_qty`.
- `iqp_price_mode` (`Char(1)`): `P` = discount by %, `R` = flat off by qty, `F` = fixed
  price. Defaults to `P`.
- `iqp_effective_from` (required) / `iqp_effective_to` (`null` = open-ended) date window.
  The service rejects `iqp_effective_to < iqp_effective_from`.

## Endpoints (versioned, bearer auth)

- `POST /item-qty-prices/create` — accepts an **array** of rows; each element is created,
  or updated when it carries an `iqp_id`. The whole batch runs in one transaction.
- `GET /item-qty-prices/get` — with `iqp_id` returns a single row; otherwise returns a
  filtered, paginated list. Filters: `iqp_item_id`, `iqp_item_unit_id`, `iqp_company_id`,
  `iqp_branch_id`, `iqp_party_id`, `iqp_price_level`, `iqp_is_active`, plus
  `search`/`page`/`limit`. Uses an admin-configured grid when one exists, else a Prisma
  fallback ordered by item → unit → lower bound.
- `DELETE /item-qty-prices/delete` — soft-deletes by `iqp_id` (query param or body), single or
  array, all-or-nothing. Not a toggle: 409 when a slab is already deleted (notes 70 C1).
- `POST /item-qty-prices/restore` — same payload; 409 when a slab is not deleted or a live slab now
  holds its key.
- One live slab per (item, unit, company, branch, party, level, from, to, effective-from) —
  `uq_iqp_slab`, NULLS NOT DISTINCT (notes 70 D7): a re-POST is a 409, not a second slab.

## Resolved names

The payload carries the display name for each foreign key alongside its id, resolved via
Prisma joins on the GET (`getById` + Prisma-fallback list) and save paths:
`iqp_item_name`, `iqp_unit_name`, `iqp_company_name`, `iqp_branch_name`,
`iqp_price_level_name`, `iqp_party_name`. `iqp_item_unit_id` stores an `iuc_id`, so
`iqp_unit_name` is the underlying `item_unit_master.unit_name` reached through
`item_unit_conversion`. Names are `null` when the relation is empty or when the list is
served from an admin-configured grid (whose columns come from its own SQL).

## Notes

- Soft delete via `iqp_is_deleted`; all reads scope to `iqp_is_deleted = false`.
- `iqp_created_by` / `iqp_modified_by` resolve from the request body, then the
  request-context user id, then the nil-UUID sentinel.
- Every mutation is audit-logged inside its write transaction.
- The DB-level `CHECK` constraints and the `EXCLUDE`/no-overlap and partial-lookup
  indexes on this table are enforced by the database, not by this module.
