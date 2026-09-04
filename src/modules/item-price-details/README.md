# Item Price Details

Read-only lookup API that returns a single item together with its unit-wise price rows and its
default tax record, assembled into one nested payload keyed by `item_id`.

- **Base route:** `item-price-details` (endpoint API-versioned via `API_VERSION`)
- **Swagger tag:** `Item Price Details`
- **Auth:** Bearer `access-token` (required)
- **Cache:** `@CacheTTL(60)` — responses cacheable for 60s
- **Reads (all in the `inventory` schema):**
  - `item_master` (model `ItemMaster`) — matched on PK `itemId`, filtered `itemIsDeleted = false`
  - `item_price_master` (model `ItemPriceMaster`) — filtered `ipmItemId = itemId` and
    `ipmIsDeleted = false`, ordered by `ipmUnitSlno`, then `ipmId`
  - `item_tax_master` (model `ItemTaxMaster`) — matched on PK `taxId = item.itemDefaultTaxId`,
    filtered `taxIsDeleted = false`; skipped when the item has no default tax

## Files

| File | Purpose |
| --- | --- |
| [item-price-details.controller.ts](item-price-details.controller.ts) | Single HTTP route + Swagger docs |
| [item-price-details.service.ts](item-price-details.service.ts) | Read-only fetch and record-to-payload mapping |

> This folder has **no** `.module.ts`, DTOs, types, or exception filter of its own. The controller
> and service reuse those artifacts from the sibling Inventory module
> (`src/modules/Inventory/item-price-details/…`): the query DTO
> [GetItemPriceDetailQueryDto](../Inventory/item-price-details/dto/get-item-price-detail-query.dto.ts),
> the response/error DTOs and types, and
> [ItemPriceDetailExceptionFilter](../Inventory/item-price-details/item-price-detail-exception.filter.ts).

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Fetch one item plus its price rows and default tax by `item_id` (UUID query param). |

## Behavior

- The query string is validated explicitly with `validateDto(query, GetItemPriceDetailQueryDto)`
  (`type: 'query'`) inside the controller before the service is called.
- `getByItemId(itemId)`:
  1. Loads the active item (`itemIsDeleted = false`). If none exists it throws a
     `NotFoundException` shaped as `{ success: false, message: 'Item not found', errors: [...] }`
     with the offending `item_id`.
  2. In parallel (`Promise.all`) fetches all active price rows for the item and — only when
     `itemDefaultTaxId` is set — the matching active tax row (otherwise `null`).
  3. Returns `{ item, item_prices: [...], item_tax: <tax | null> }`.
- Mapping helpers convert DB records to snake_case payloads: `Prisma.Decimal`/number fields go
  through `toNumber` (non-finite values coerced to `0`), `Date` fields are emitted as ISO strings,
  and `item_photo` bytes are base64-encoded.
- The service only issues `findFirst` / `findMany` reads — there are **no writes**, so the module
  is fully **read-only**.

## Status

There is **no local `.module.ts`**, so this folder does not self-register with Nest; the controller
and service must be wired into a module declared elsewhere to be reachable. It depends entirely on
the sibling `Inventory/item-price-details` module for its DTOs, types, and exception filter. Given
the missing module wiring and the exclusively borrowed artifacts, this top-level folder looks like a
partial / work-in-progress (or relocated) copy of that Inventory feature.
