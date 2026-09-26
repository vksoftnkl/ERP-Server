# Item Tax History

CRUD API for **item tax history** — effective-dated records that link an inventory item to the
GST/tax rate (`ItemTaxMaster`) that applied to it over a given date range, preserving the item's
historical tax rates.

- **Base route:** `item-tax-histories` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Item Tax History`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_tax_history` (`inventory` schema) — PK `ith_id` (uuidv7)
- **Foreign keys:** `ith_item_id → item_master.item_id`, `ith_tax_id → item_tax_master.tax_id` (both `onDelete: Restrict`)

## Files

| File | Purpose |
| --- | --- |
| [items-tax-history-master.module.ts](items-tax-history-master.module.ts) | Module wiring — imports `AuditLogModule`; registers controller, service, and exception filter |
| [items-tax-history-master.controller.ts](items-tax-history-master.controller.ts) | HTTP routes + Swagger docs |
| [items-tax-history-master.service.ts](items-tax-history-master.service.ts) | Business logic, persistence, audit logging |
| [item-tax-history-exception.filter.ts](item-tax-history-exception.filter.ts) | Extends `InventoryExceptionFilter`; maps DB/domain errors to the module's error shape (matches `ith_*` field names) |
| [dto/save-item-tax-history.dto.ts](dto/save-item-tax-history.dto.ts) | Single create/update payload |
| [dto/item-tax-history-response.dto.ts](dto/item-tax-history-response.dto.ts) | Swagger response models |
| [types/item-tax-history-api.types.ts](types/item-tax-history-api.types.ts) | Payload / response / error TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update one record, chosen by presence of `ith_id` in the body. |
| `GET` | `/get` | Fetch one record by `ith_id` (required UUIDv7 query param). |
| `DELETE` | `/delete` | Delete one record by `ith_id` (required UUIDv7 query param). |

Both `/get` and `/delete` validate `ith_id` with `ParseUUIDPipe({ version: '7' })`.

### Create / update semantics

- **Omit `ith_id` → create; include `ith_id` → update** the existing row (`save` dispatches on
  `ith_id` presence). Update throws not-found if no row matches `ith_id`.
- Each write runs inside a `$transaction` alongside its audit-log entry.
- On **create**, `ith_created_on` is set to `new Date()` and `ith_created_by` is resolved via
  `resolveActor(ith_created_by, RequestContextService.getUserId())`.
- **Optional fields are patch-style** (`applyOptionalFields`): `ith_effective_to` and `ith_reason`
  are only written when the key is present in the payload, so an update leaves an omitted field
  unchanged. On create, `ith_item_id`, `ith_tax_id`, and `ith_effective_from` are always set.

### Validation rules

- DTO validation (`SaveItemTaxHistoryDto`): `ith_item_id` and `ith_tax_id` are required UUIDs;
  `ith_effective_from` is a required date string; `ith_effective_to` is a nullable date string;
  `ith_reason` is nullable, max 250 chars; `ith_created_by` is nullable, max 100 chars.
- Service-level: `ith_effective_from` must parse to a valid date (`parseRequiredDate`); if
  `ith_effective_to` is supplied it must parse and be **≥** `ith_effective_from`
  (`validateDateRange`), otherwise a 400 is thrown.

### Delete semantics

- **Hard delete** — `delete` removes the row via `tx.itemTaxHistory.delete` (there is no
  soft-delete flag on this table). Throws not-found if the row does not exist.
- A foreign-key violation on delete is mapped to a 400 ("Item tax history is referenced by
  related records").

### Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` inside the same transaction,
with screen name `Item Tax History` (`screenType: 'master'`) and a display name of
`itemId:taxId:effectiveFrom`:

- Create → action `New` (original `null`, modified = new payload).
- Update → action `update` (original vs. modified payload).
- Delete → action `cancel` (original payload, modified `null`).

The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

### Error mapping

`handleWriteError` translates Prisma failures on create/update: a unique-constraint violation
becomes a 409 conflict ("Item tax history already exists"), and a foreign-key violation becomes a
400 ("Referenced item or tax does not exist"). All errors are rendered by
`ItemTaxHistoryExceptionFilter` into the shared inventory error shape.
