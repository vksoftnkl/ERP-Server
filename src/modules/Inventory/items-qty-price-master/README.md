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

- `POST /item-qty-prices/create` — create or update by `iqp_id` presence. Accepts a
  single object or an array (the whole batch runs in one transaction).
- `GET /item-qty-prices/get` — with `iqp_id` returns a single row; otherwise returns a
  filtered, paginated list. Filters: `iqp_item_id`, `iqp_item_unit_id`, `iqp_company_id`,
  `iqp_branch_id`, `iqp_party_id`, `iqp_price_level`, `iqp_is_active`, plus
  `search`/`page`/`limit`. Uses an admin-configured grid when one exists, else a Prisma
  fallback ordered by item → unit → lower bound.
- `DELETE /item-qty-prices/delete` — toggles soft delete/restore by `iqp_id` (query param
  or body), single or array.

## Notes

- Soft delete via `iqp_is_deleted`; all reads scope to `iqp_is_deleted = false`.
- `iqp_created_by` / `iqp_modified_by` resolve from the request body, then the
  request-context user id, then the nil-UUID sentinel.
- Every mutation is audit-logged inside its write transaction.
- The DB-level `CHECK` constraints and the `EXCLUDE`/no-overlap and partial-lookup
  indexes on this table are enforced by the database, not by this module.
