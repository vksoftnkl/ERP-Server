# Item Price Lookup

Read-only **sale-lookup API** for a single item. It ports the legacy PL/pgSQL `getItemForSale`
cursor onto the current UUID schema, resolving one item + one unit rate into a single flat row:
the effective price for the requested price level, the tax block, stock, reorder level,
negative-stock rule and the quantity-wise rate list.

- **Base route:** `item-price-lookup` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Item Price Lookup`
- **Auth:** Bearer `access-token` (required)
- **Caching:** controller-level `@CacheTTL(60)` (60s)
- **Access:** read-only — no create/update/delete, no audit logging
- **Primary table:** `item_price_master` (the pricing hub) — PK `ipm_id`, keyed by
  `ipm_item_id` + `ipm_branch_id`, ordered by `ipm_unit_slno`
- **Also reads:** `item_master` (`item_id`), `item_unit_master` (`unit_id`),
  `item_tax_master` (`tax_id`), `company` (`comp_id`), `cust_item_rates` (`csr_unit_rate_id`),
  `item_qtywise_rates` (`iqr_unit_rate_id`), `item_reorders` (`ir_item_id` + `ir_unit_id`),
  `godown_locations` (`gdl_id`), `item_stock_balance` (aggregated `isb_closing_qty`)

## Files

| File | Purpose |
| --- | --- |
| [item-price-lookup.module.ts](item-price-lookup.module.ts) | Module wiring — declares the controller, service and exception filter |
| [item-price-lookup.controller.ts](item-price-lookup.controller.ts) | HTTP route + Swagger docs; validates the query DTO before delegating |
| [item-price-lookup.service.ts](item-price-lookup.service.ts) | Lookup/resolution logic — the legacy `getItemForSale` port |
| [item-price-lookup-exception.filter.ts](item-price-lookup-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches the query field names) |
| [dto/get-item-price-lookup-query.dto.ts](dto/get-item-price-lookup-query.dto.ts) | Query-parameter DTO + validation |
| [dto/item-price-lookup-response.dto.ts](dto/item-price-lookup-response.dto.ts) | Swagger response models |
| [types/item-price-lookup-api.types.ts](types/item-price-lookup-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Resolve one item into a single sale-lookup row for the requested price level. |

### Query parameters

| Param | Required | Purpose |
| --- | --- | --- |
| `item_id` (uuid) | yes | The item to resolve. |
| `company_id` (uuid) | yes | Scopes the company (GST flag, negative-stock rule) and stock aggregation. |
| `branch_id` (uuid) | yes | Scopes the item and its price rows. |
| `price_level` (int 1–7) | yes | Price column to use: 1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost. |
| `unit_id` (uuid) | no | Selects the unit rate. When omitted, the unit-slno rule applies (see below). |
| `customer_id` (uuid) | no | Applies the customer rate discount to price levels 1–4 (A/B/C/D) only. |
| `godown_id` (uuid) | no | Sale godown override — resolves the godown row and scopes stock to this godown instead of the rate's own godown. |
| `acccyear` (string ≤9) | no | Accounting year (e.g. `2024-2025`) that scopes the stock aggregation; when absent, `stock`/`reorder_qty` are null. |
| `enable_loading` (bool) | no | Loading mode — when true, stock is summed across ALL godowns; otherwise scoped to the resolved godown. |
| `regional` (bool) | no | When true, `item_name` returns the regional name (`item_name_ta`), else the English name. |

## Lookup / resolution logic

The service (`getByParams`) reproduces the legacy `getItemForSale` cursor. It first loads the
item (`item_master`, active only) and the candidate price rows (`item_price_master`, active,
ordered by `ipm_unit_slno`) in parallel; a missing item or no matching price row raises a
not-found error.

- **Unit-rate pick (`selectUnitRate`):** an explicit `unit_id` wins (matches `ipm_unit_id`).
  Otherwise the unit-slno rule applies — a **retail item** takes the row with the **highest
  `ipm_unit_slno`** (largest pack), a **non-retail item** takes the **base row (slno 0)**.
- **Godown override:** an explicit `godown_id` overrides the rate's own `ipm_godown_id`, both
  for the resolved godown row and for the stock scope.
- **Price level (`priceForLevel`):** the chosen rate's 1–7 columns map to
  A / B / C / D / max / min / cost. This is the `base_price`.
- **Customer rate:** when `customer_id` is supplied, the matching active `cust_item_rates` row
  (by `csr_unit_rate_id = ipm_id`) contributes `csr_disc_qty`, subtracted from the base price —
  but **only for price levels 1–4**, never from max/min/cost (5/6/7). Result is `sales_price`.
- **Stock:** aggregated `SUM(isb_closing_qty)` from `item_stock_balance` for the item/unit/
  company/branch and accounting year; scoped to the resolved godown unless `enable_loading` sums
  across all godowns. Requires `acccyear`, otherwise `stock` is null. `reorder_qty` =
  `ir_min_level − stock` (null when no reorder row).
- **Tax block:** loaded from `item_tax_master` via the item's `item_default_tax_id`; every GST /
  cess percentage is **zeroed when the company has GST disabled** (`comp_gst_applicable = false`).
- **Negative-stock rule:** service items always allow it; otherwise it is blocked only when the
  godown, company and item all disallow it.
- **Name:** `regional=true` returns `item_name_ta` (falling back to the English name when unset),
  else the English name.
- **Quantity-wise rates (`buildQtyWiseRates`, `json_qws`):** the base rate's seven price levels
  (1..7 → a/b/c/d/max/min/cost) are unioned with the configured `item_qtywise_rates` slabs and
  ordered by price level, then start quantity. The caller resolves the applicable slab for a
  given order quantity from this list.

### Schema divergences from the legacy query

- Customer rates and qty-wise rates now hang off the pricing hub `item_price_master` (`ipm_id`)
  instead of `(item_id, unit_id)`.
- The item-group price-level scheme discount has no column in the current schema, so
  `sch_discount` is always null.
