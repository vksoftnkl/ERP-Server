# Mobile · Items

Items for the React Native (Expo) salesman app's order screen. **Read-only, no database change.**

- **Base route:** `mobile/items` (API-versioned: `/api/v1/mobile/items/...`)
- **Swagger tag:** `Mobile · Items`. Own docs page `/api/docs/mobile-items`.
- **Auth:** optional (`@OptionalAuth`), as `/mobile/customers`. A token that is sent is still checked.
- **No cost price** leaves the server: salesmen's phones carry no margins. Price level 7 (Cost)
  is not offered either.

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/options` | `companies` {id, name, place}, `branches` {id, name, companyId, isDefault}, `itemGroups` / `brands` {id, name, position}, `priceLevels` {id, name} |
| `GET` | `/list?companyId=&deviceUid=&page=&pageSize=` | Paged items orderable for the company, with units, prices and stock |

## `GET /options`

Active, live rows only. `place` is `comp_city`; `position` is `itg_sort` / `brand_sort` (null
sorts last). Price levels: the active `item_price_levels` without 7 (Cost). Levels 1-4 price
from `priceA`-`priceD`, 5 (MRP) from `mrp`, 6 (minimum) from `minPrice`.

**`branches`** (since 2026-11-18): the branches VKSMAN's Switch company picks from, and what an
order's `soBranchId` takes. The phone syncs over plain HTTP, where only `/mobile/*` is served
(`src/common/phone-http/phone-http.ts`), so it cannot call
`/master-lookups/branches/by-company/{companyId}`; this list carries the same rows in the same order.

- Which: `branch_master` rows with `br_is_active = true` and `br_is_deleted = false`, of exactly
  the companies in `companies`. A company with no branch adds no row.
- Order: per company in the order of `companies` (`comp_name`, then `comp_id`), then `br_name`,
  then `br_id`.
- Keys: `id` (`br_id`), `name` (`br_name`), `companyId` (`br_comp_id`), `isDefault`
  (`br_is_default`, the company's default branch).

**Caching:** none on the server. The route has no `@CacheTTL`, so `HttpCacheInterceptor` never
stores it in Redis (every answer is `X-Cache: MISS`). Express adds its default weak `ETag`, and
answers 304 only when a client sends `If-None-Match` with the same tag. A changed body (such as
the added `branches`) has a new tag, so no client is kept on an old body.

## `GET /list`

`companyId` is required. `pageSize` is 1-500 (default 200), and `page` starts at 1. `deviceUid` is
optional.

- **Which items:** live, active, `item_allow_so`, and shared (`item_company_id` NULL) or the
  company's own. A branch-owned item (`item_branch_id`) shows only for its branch. Sorted by
  `lower(item_name_en)`, then `item_id`.
- **Branch** (`data.branchId`) is the one the prices are read for. It is the phone's own branch
  when `deviceUid` names a registered phone of that company, and otherwise the company's default
  branch (or its only branch). It is the same branch the phone's orders are saved in. An unknown,
  blocked or switched-off `deviceUid` is a 403 (`MOBILE_DEVICE_*`). If no branch can be chosen,
  `branchId` is null and rows of every branch are read, as `/master-lookups/item-price` does
  with no `branch_id`.
- **Per item:** code, English and Tamil names, group and brand (id and name), the loading,
  freight and promo flags, plus `inclTax`, `hsnCode`, `taxId` and `taxPerc` (0 when the company
  is not GST applicable, as the lookup does).
- **`categoryId` / `sectionId`** (since 2026-11-19): `item_category_id` / `item_section_id`, a
  uuid or null. The phone's offer engine matches `ITEM_CATEGORY` / `ITEM_SECTION` rows of
  `GET /mobile/schemes/active` by them (group and brand already come as `itemGroupId` /
  `itemBrandId`). Additive keys: an older phone ignores them.
- **Per unit** (`item_unit_conversion`, live and active, in `iuc_unit_slno` order):
  - `iucId`, which is what `soiItemUnitId` takes;
  - the unit name, `factor` (`iuc_to_base_factor`), `isDefaultUnit`, `isBaseUnit` and `weight`;
  - `priceA`-`priceD`, `mrp` (`ipm_max_price`), `minPrice`, `loadingCharge` and `freightCharge`
    (money as text, two decimals);
  - `priceSource` / `priceScope`, and `availableQty`.
  - `priced: false` means that no live price row prices the unit today, and every price is null.
- **The price row is picked as `/master-lookups/item-price` picks it** for a line with no MRP,
  sale price or lot ([`unitPriceAnswer`](mobile-item.service.ts)):
  - It reads the live rows in force today at the caller's scope or wider (company = ? or NULL,
    branch = ? or NULL).
  - It takes the unit's headline row: a branch row before a chain row, and a company row before a
    shared one (`resolveEffectivePrice`).
  - If there is no headline row, it takes the lookup's provisional bucket (notes 71 B2): the
    dearest MRP, then the dearest sale price.
  - Customer rates and quantity slabs are not applied. Those are per customer and per quantity,
    and the lookup applies them when the line is priced.
- **Stock** comes from `stock.stock_balance`, the engine's balance. `inventory.item_stock_balance`
  is retired and empty.
  - It is `SUM(sbl_available_qty)` (on hand − reserved), SALEABLE bucket only, over every
    branch and godown of the company, in the base unit.
  - `availableBaseQty` is that sum. Each unit's `availableQty` = base ÷ factor, to 3 decimals.
- A page past the end has `items: []` with the true `total`. `hasMore` = another page exists.
- No `@CacheTTL`: the HTTP cache key holds neither the company nor the branch.

## Tests

- Unit: [`mobile-item.service.spec.ts`](mobile-item.service.spec.ts) covers the price pick, the
  formats, and the `branches` of `/options` (keys, filter, order, only listed companies).
- HTTP, live dev DB: `test/mobile-items-orders-visits-http.e2e-spec.ts`. It compares a priced
  unit's level-1 price, MRP and minimum against `/master-lookups/item-price`, and the stock
  against an independent sum.
