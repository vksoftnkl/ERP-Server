# Units Master CRUD API Plan

## 1. Goal
Implement `Units Master` APIs for units of measurement with packing/conversion support (for example, `1 BOX = 10 PCS`) and soft-delete behavior.

## 2. Scope
- Module: `src/modules/units-master` (to be created/aligned)
- DB table: `public.units`
- API base: `/api/v1/units`
- CRUD operations:
  - Save (create/update): `POST /api/v1/units` (`unit_id` in request body means update)
  - List/Search: `GET /api/v1/units/list`
  - Get by ID: `GET /api/v1/units/get/:unit_id`
  - Delete (soft): `DELETE /api/v1/units/delete/:unit_id`

## 3. Database Contract (Target)
### 3.1 Required rules
- `unit_name` is required and unique.
- If `unit_base_unit_id` is set, `unit_conversion` is required and must be greater than `0`.
- `unit_base_unit_id` references the base unit row (`self` relation).
- Soft delete only: set `unit_is_deleted = true`; no physical delete.
- List/search endpoints exclude deleted rows by default (`unit_is_deleted = false`).
- `unit_decimal_count` controls quantity precision (`0` for whole numbers, `2` for decimals).

### 3.2 Core columns
| Column | Type | Notes |
|---|---|---|
| `unit_id` | UUID | Primary key, auto-generated |
| `unit_name` | VARCHAR(50) | Required; unique |
| `unit_alias` | VARCHAR(50) | Optional |
| `unit_code` | VARCHAR(30) | Optional internal code |
| `unit_description` | VARCHAR(100) | Optional |
| `unit_decimal_count` | INTEGER | Decimal precision, default `0` |
| `unit_weight` | NUMERIC | Optional |
| `unit_loading` | NUMERIC | Optional |
| `unit_unloading` | NUMERIC | Optional |
| `unit_attach_charge` | NUMERIC | Optional |
| `unit_is_pack_unit` | BOOLEAN | `true` for packing units |
| `unit_base_unit_id` | UUID | Self-reference to base unit |
| `unit_conversion` | NUMERIC | Conversion factor |
| `unit_is_active` | BOOLEAN | Default `true` |
| `unit_is_deleted` | BOOLEAN | Default `false`; soft delete flag |
| `unit_sync_date` | TIMESTAMPTZ | Sync timestamp |
| `unit_created_on` | TIMESTAMPTZ | Default `now()` |
| `unit_created_by` | VARCHAR(100) | Audit |
| `unit_modified_on` | TIMESTAMPTZ | Default `now()` |
| `unit_modified_by` | VARCHAR(100) | Audit |

### 3.3 Alignment note
- Current Prisma model in this repo uses `Int` autoincrement for `unit_id`.
- This plan targets `UUID`.
- Confirm ID strategy, then align schema + migrations before API implementation.

## 4. API Conventions
- Prefix: `/api/v1`
- Content-Type: `application/json`
- Default filter: exclude soft-deleted records.

### 4.1 Success envelope
```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {}
}
```

### 4.2 Error envelope
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "field_name", "message": "Error message" }
  ]
}
```

## 5. Endpoint Contract
### 5.1 Save unit (create/update)
- Endpoint: `POST /api/v1/units`
- Behavior:
  - Create when `unit_id` is not present in request body.
  - Update when `unit_id` is present in request body.
  - Supports base units (for example `PCS`) and optional pack units (for example `BOX`).
  - Validate conversion rule when `unit_base_unit_id` is provided.
  - Return `201` for create and `200` for update.
- Error mapping:
  - `400` for validation failures.
  - `409` for duplicate `unit_name`.
  - `404` when `unit_id` is provided but record is not found (or soft-deleted).

### 5.2 Remaining CRUD
- `GET /list`: paginated list/search with soft-delete filter.
- `GET /get/:unit_id`: fetch one active/non-deleted unit.
- `DELETE /delete/:unit_id`: soft delete only.

## 6. Implementation Plan
### Phase 1: Schema and migration
- [ ] Finalize `unit_id` type decision (`UUID` vs existing `Int`).
- [ ] Add/confirm unique constraint for `unit_name`.
- [ ] Add/confirm self-reference foreign key for `unit_base_unit_id`.
- [ ] Add DB/app validation for `unit_conversion > 0` when `unit_base_unit_id` is set.
- [ ] Generate/apply migration(s).

### Phase 2: DTOs and validation
- [ ] Create DTOs for save (single create/update payload), list query, and ID params.
- [ ] Add validators for required fields, UUID format, numeric fields, booleans, and pagination.
- [ ] Implement conditional validation for conversion rule.

### Phase 3: Service layer
- [ ] Implement save with create/update branches based on `unit_id` presence.
- [ ] Enforce uniqueness and conversion checks in both branches.
- [ ] Implement list/search with pagination and default soft-delete exclusion.
- [ ] Implement get-by-id with soft-delete awareness.
- [ ] On update branch, maintain audit tracking (`unit_modified_on`, `unit_modified_by`).
- [ ] Implement soft delete (`unit_is_deleted = true`).

### Phase 4: Controller and routes
- [ ] Expose endpoints under `/api/v1/units/*`.
- [ ] Wire DTOs for body/query/params validation.
- [ ] Return standard response envelopes.

### Phase 5: Error mapping and consistency
- [ ] Map validation errors to `400`.
- [ ] Map unique violation to `409`.
- [ ] Map not found/soft-deleted lookups to `404`.
- [ ] Keep `errors[]` response shape consistent.

### Phase 6: Tests
- [ ] Unit tests for validation and business rules.
- [ ] Integration tests for save (create+update)/list/get/delete flows.
- [ ] Edge tests:
  - duplicate `unit_name`,
  - conversion missing when `unit_base_unit_id` exists,
  - conversion `<= 0`,
  - soft-deleted rows excluded from list,
  - update via save with non-existing `unit_id`,
  - get/delete on non-existing rows.

## 7. Acceptance Criteria
- Units APIs are available under `/api/v1/units/*` with POST-based save for create/update.
- Soft delete is implemented and no physical delete is used.
- Conversion and hierarchy rules are enforced.
- Standard success/error envelopes are used across endpoints.
- Tests cover core flows and critical edge cases.
