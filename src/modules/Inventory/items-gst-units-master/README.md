# Item GST Units

Read-only lookup API for **GST unit-of-measure codes** — the standard GST Unit Quantity Codes
(UQC), e.g. `NOS` / `Numbers` — that inventory items and units reference for GST reporting.

- **Base route:** `item-gst-units` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Item GST Units`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_gst_units` (`inventory` schema) — PK `item_gst_unit_id`
- **Uniqueness:** `item_gst_unit_code` is a unique column
- **Related:** `item_unit_master.unit_code` FKs to `item_gst_units.item_gst_unit_code`
  (Prisma back-relation `units Unit[]`)

## Files

| File | Purpose |
| --- | --- |
| [items-gst-units-master.module.ts](items-gst-units-master.module.ts) | Module wiring — registers the controller, service, and exception filter |
| [items-gst-units-master.controller.ts](items-gst-units-master.controller.ts) | HTTP route + Swagger docs |
| [items-gst-units-master.service.ts](items-gst-units-master.service.ts) | Query logic and payload mapping |
| [item-gst-unit-exception.filter.ts](item-gst-unit-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `item_gst_unit_*` field names) |
| [dto/get-item-gst-unit-query.dto.ts](dto/get-item-gst-unit-query.dto.ts) | Query params for the list endpoint |
| [dto/item-gst-unit-response.dto.ts](dto/item-gst-unit-response.dto.ts) | Swagger response models |
| [types/item-gst-unit-api.types.ts](types/item-gst-unit-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | List item GST units, with an optional `search` filter. |

### List semantics

- **Read-only module** — the service exposes only `list`; there are no create, update, or
  delete routes.
- `search` (optional, trimmed, max 200 chars) does a **case-insensitive `contains`** match across
  **both** `item_gst_unit_code` and `item_gst_unit_name`; when omitted, all rows are returned.
- Results are ordered by `item_gst_unit_name` ascending, then `item_gst_unit_id` ascending.
- Each row is mapped to a snake_case payload (`toPayload`): `item_gst_unit_id`,
  `item_gst_unit_code`, `item_gst_unit_name`, plus audit/sync timestamps
  (`item_gst_unit_created_on` / `_by`, `item_gst_unit_modified_on` / `_by`,
  `item_gst_unit_sync_date`). Timestamps are serialized as ISO strings; `sync_date` is nullable.
- The success envelope is `{ success: true, message, data }`.

## Notes

- Responses are cached briefly — the controller sets `@CacheTTL(1)`.
- Errors are handled by [ItemGstUnitExceptionFilter](item-gst-unit-exception.filter.ts), which
  extends the shared `InventoryExceptionFilter` and rewrites DB error text mentioning
  `item_gst_unit_*` columns into the module's field-scoped error shape.
- The module does **not** export its service.
