# Godown Master CRUD API Plan (Query-Param Style, No PUT)

## Summary
Build `Godowns Master` APIs for `public.godowns` with create/update via `POST`, list/get via `GET`, and soft delete via `DELETE`. No `PUT` endpoint.

## Endpoint Contract
| Method | Endpoint | Behavior |
|---|---|---|
| `POST` | `/api/v1/godowns` | Create when `godown_id` is absent in body; update when `godown_id` is present in body |
| `GET` | `/api/v1/godowns` | If `godown_id` query param is present: get single record; otherwise return paginated list |
| `DELETE` | `/api/v1/godowns?godown_id={uuid}` | Soft delete by setting `godown_is_deleted = true` |

## Request DTOs
1. `SaveGodownDto`
- `godown_id?: uuid`
- `godown_name?: string` (required on create)
- `godown_short?: string | null`
- `godown_is_del_sheet?: boolean`
- `godown_split_stock?: boolean`
- `godown_default_godown?: boolean`
- `godown_volume?: number | null`
- `godown_sort?: number | null`
- `godown_active?: 'Y' | 'N'`
- `godown_is_active?: boolean`
- `godown_negative_stock?: boolean`
- `godown_group?: number | null`

2. `ListOrGetGodownQueryDto`
- `godown_id?: uuid`
- `page?: number`
- `limit?: number`
- `search?: string`
- `godown_is_active?: boolean`

3. `DeleteGodownQueryDto`
- `godown_id: uuid`

## Response Contract
Success envelope:
```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {}
}
```

Error envelope:
```json
{
  "success": false,
  "message": "string",
  "errors": [
    { "field": "field_name", "message": "error message" }
  ]
}
```

## Status Codes
- `POST` create: `201`
- `POST` update: `200`
- `GET` list/get: `200`
- `DELETE` soft delete: `200`
- Validation failure: `400`
- Duplicate/business conflict: `409`
- Not found or already deleted: `404`

## Data Model
Prisma model added in `prisma/master/items/godownMaster.prisma`:
- model: `Godown`
- table: `public.godowns`
- primary key: `godown_id` with `uuidv7()`
- index: `idx_godown_id`

## Migration
Migration adds:
1. `CREATE TABLE public.godowns (...)`
2. `CREATE INDEX idx_godown_id ON public.godowns(godown_id)`

## App Wiring
- New module: `src/modules/godowns-master`
- Registered in `src/app.module.ts`
- Added Swagger docs registration in `src/main.ts`

## Service Rules
- `save()` routes to create/update by `godown_id` presence.
- `godown_name` required for create.
- `godown_active` normalized to uppercase and validated to `Y/N`.
- List always excludes soft-deleted rows.
- Soft delete sets `godown_is_deleted = true` only.
- Audit log entries:
  - create: `New`
  - update: `update`
  - delete: `cancel`

## Testing
Implemented specs for:
- service behavior (`godowns-master.service.spec.ts`)
- controller behavior (`godowns-master.controller.spec.ts`)
- exception filter behavior (`godown-exception.filter.spec.ts`)
