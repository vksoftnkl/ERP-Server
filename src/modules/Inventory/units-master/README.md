# Units Master

CRUD API for **units of measure** — the inventory units (kg, litre, piece, box, etc.) items are
counted and priced in, including each unit's decimal precision, weight/handling charges, and an
optional base-unit conversion.

- **Base route:** `units` (API-versioned via `API_VERSION` on every route with `@Version`)
- **Swagger tag:** `Units`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_unit_master` (`inventory` schema) — PK `unit_id` (UUID v7)
- **Self relation:** `unit_base_unit_id → unit_id` (a unit's base unit, exposed as `unit_base_unit_name`)
- **FK:** `unit_code → item_gst_units.item_gst_unit_code` (GST unit, exposed as `unit_code_name`)

## Files

| File | Purpose |
| --- | --- |
| [units-master.module.ts](units-master.module.ts) | Module wiring — imports `AuditLogModule` |
| [units-master.controller.ts](units-master.controller.ts) | HTTP routes + Swagger docs (`@CacheTTL(1)`) |
| [units-master.service.ts](units-master.service.ts) | Business logic, persistence, audit logging |
| [unit-exception.filter.ts](unit-exception.filter.ts) | Extends `InventoryExceptionFilter`; maps DB/domain errors to the module's error shape (matches `unit_*` field names) |
| [dto/save-unit.dto.ts](dto/save-unit.dto.ts) | Single create/update payload |
| [dto/unit-response.dto.ts](dto/unit-response.dto.ts) | Swagger response models |
| [types/unit-api.types.ts](types/unit-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a unit, chosen by `unit_id` presence in the body. |
| `GET` | `/get` | Fetch one active unit by `unit_id` (query param, validated as UUID v7). |
| `DELETE` | `/delete` | Soft-delete **or** restore a unit by `unit_id` — toggles `unit_is_deleted`. |

### Create / update semantics

- **Omit `unit_id` → create; include `unit_id` → update** the existing unit (`save` dispatches on
  `unit_id`).
- Update targets only **active (non-deleted)** rows — an unknown or deleted `unit_id` returns
  **404 Not Found**.
- Both create and update run inside a `$transaction` alongside their audit-log write.
- `unit_name` is **trimmed** before persisting.
- Optional fields are applied **only when present in the payload** (`hasOwnProperty` / `applyOptionalFields`),
  so update is a partial patch — omitted fields keep their stored value.
- On create, `unit_created_by` (and `unit_modified_by` on update) is resolved from the DTO value,
  falling back to the request-context user (`resolveActor`).

### Conversion / base-unit rules

- When `unit_base_unit_id` is set, `unit_conversion` is **required** and must be **greater than 0**
  (`validateConversionRules`) — enforced in the DTO (`@ValidateIf` + `@IsPositive`) and again in the
  service. Otherwise a **400 Validation error** is returned.
- On update, `unit_base_unit_id` **cannot equal the unit's own `unit_id`** (self-reference), returning
  a **400 Validation error**.

## Business rules

- **Unit name uniqueness** — `unit_name` is `@unique` at the DB level; a duplicate is caught in
  `handleWriteError` and surfaced as a **409 Conflict** (`Unit name already exists`).
- **Soft delete / restore** — `DELETE /delete` flips `unit_is_deleted` via a guarded `updateMany`
  (only acts if the row's state hasn't changed since the read); rows are never hard-deleted. The
  response `deleted` flag is `true` when soft-deleted, `false` when restored.
- **Audit logging** — every mutation is recorded via `AuditLogService.logEntityChange`
  (`New` on create, `update` on update/restore, `cancel` on soft-delete), capturing original vs.
  modified records against table `item_unit_master`, screen `Units Master` (type `master`). The acting
  user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- **GET response** embeds `unit_base_unit_name` (from the base unit's `unit_name`) and `unit_code_name`
  (from the linked GST unit's name), and **omits** the soft-delete / sync / audit columns
  (`unit_is_deleted`, `unit_sync_date`, `unit_created_*`, `unit_modified_*`) — see `UnitDetailPayload`.
