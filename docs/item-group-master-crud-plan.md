# Item Group Master CRUD API Plan

## 1. Goal
Implement `Item Group Master` APIs (Tally Stock Group style hierarchy) with:
- company-scoped uniqueness,
- hierarchical parent-child structure,
- soft delete only (`itg_is_deleted = true`),
- consistent response envelope for all endpoints.

## 2. Scope
- Module: `src/modules/items-group-master`
- DB table: `public.item_group_master`
- API base: `/api/v1/item-groups`
- CRUD operations:
  - Save (create/update): `POST /create` (use `itg_id` in request body for update)
  - List/Search: `GET /list`
  - Get by ID: `GET /get/:itg_id`
  - Delete (soft): `DELETE /delete/:itg_id`

## 3. Database Contract (Target)
### 3.1 Required rules
- `itg_name` is required.
- Unique per company: `(itg_company_id, itg_name)`.
- `itg_parent_id` cannot equal `itg_id` (self-parent check).
- No physical delete; use soft delete.
- Default list/search behavior must exclude deleted rows (`itg_is_deleted = false`).

### 3.2 Core columns
| Column | Type | Notes |
|---|---|---|
| `itg_id` | UUID | PK, `uuidv7()` |
| `itg_name` | VARCHAR(150) | Required |
| `itg_alias` | VARCHAR(100) | Optional |
| `itg_short` | VARCHAR(50) | Optional |
| `itg_description` | VARCHAR(250) | Optional |
| `itg_parent_id` | UUID | Parent group, nullable |
| `itg_sort` | INTEGER | Optional |
| `itg_level` | INTEGER | Optional |
| `itg_path_ids_cache` | UUID[] | Optional |
| `itg_tax_claim` | BOOLEAN | Optional |
| `itg_default_tax_id` | UUID | Optional |
| `itg_default_hsn` | VARCHAR(20) | Optional |
| `itg_default_uom_id` | UUID | Optional |
| `itg_photo` | BYTEA | Optional |
| `itg_photo_url` | TEXT | Optional |
| `itg_sync_date` | TIMESTAMPTZ | Sync timestamp only |
| `itg_is_active` | BOOLEAN | Default `true` |
| `itg_is_deleted` | BOOLEAN | Default `false` |
| `itg_created_on` | TIMESTAMPTZ | Default `now()` |
| `itg_created_by` | VARCHAR(100) | Audit |
| `itg_modified_on` | TIMESTAMPTZ | Default `now()` |
| `itg_modified_by` | VARCHAR(100) | Audit |

## 4. API Contract
### 4.1 Common conventions
- Prefix: `/api/v1`
- Content-Type: `application/json`
- Response wrapper:

```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {}
}
```

- Error wrapper:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "field_name", "message": "Error message" }
  ]
}
```

### 4.2 Endpoints
1. `POST /api/v1/item-groups/create`
   - Create when `itg_id` is not provided in request body.
   - Update when `itg_id` is provided in request body.
   - Validate required fields, uniqueness, and hierarchy constraints.
2. `GET /api/v1/item-groups/list`
   - Optional filters: `itg_parent_id`, `itg_is_active`, `search`, `page`, `limit`.
   - Exclude soft-deleted rows by default.
3. `GET /api/v1/item-groups/get/:itg_id`
   - Get a single item group by ID.
   - Return `404` if not found or soft-deleted.
4. `DELETE /api/v1/item-groups/delete/:itg_id`
   - Soft delete only (`itg_is_deleted = true`, update modified audit fields).

## 5. Implementation Plan
### Phase 1: Schema alignment (Prisma + migration)

- [ ] Ensure `itg_path_ids_cache` optional/default behavior matches API contract.
- [ ] Add unique constraint: `(itg_name)`.
- [ ] Add check constraint for self-parent.
- [ ] Generate and apply migration.

### Phase 2: DTOs and validation
- [ ] Build `SaveItemGroupDto`, `ListItemGroupQueryDto`.
- [ ] Add validators for:
  - `itg_id` optional in save body (present means update),
  - required `itg_name`,
  - UUID/number/boolean types,
  - pagination bounds,
  - numeric fields (`discount`, `margin`).
- [ ] Handle base64 image input mapping for `itg_photo` if provided.

### Phase 3: Service layer
- [ ] Implement save logic with:
  - create branch when `itg_id` is absent,
  - update branch when `itg_id` is present,
  - parent existence check,
  - self-parent prevention,
  - duplicate handling (`409`).
- [ ] Implement list with:
  - mandatory company scope,
  - search across name/alias/description,
  - pagination metadata.
- [ ] Implement get-by-id with soft-delete aware lookup.
- [ ] Implement soft delete (`itg_is_deleted = true`).
- [ ] Consistently set `itg_modified_on` and `itg_modified_by`.

### Phase 4: Controller and routing
- [ ] Replace scaffold routes with contract routes under `item-groups`.
- [ ] Map query/body/params DTOs.
- [ ] Return standard success/error envelope.

### Phase 5: Error mapping and response standards
- [ ] Map Prisma unique violation to `409 Conflict`.
- [ ] Map validation failures to `400 Bad Request`.
- [ ] Map not found cases to `404 Not Found`.
- [ ] Keep error payload shape consistent (`errors[]`).

### Phase 6: Testing
- [ ] Unit tests for service validation and soft-delete behavior.
- [ ] Integration tests for save (create + update)/list/get-by-id/delete flows.
- [ ] Edge tests:
  - duplicate name in same company,
  - same name in different companies,
  - self-parent rejection,
  - get-by-id returns 404 for soft-deleted rows,
  - deleted rows excluded from list,
  - pagination/search correctness.

## 6. Acceptance Criteria
- CRUD endpoints are live under `/api/v1/item-groups/*`.
- Soft delete works and no physical deletion is used.
- List endpoints exclude deleted rows by default.
- Unique and hierarchy constraints are enforced.
- Standard response/error wrapper is used across all endpoints.
- Tests pass for critical and edge scenarios.

## 7. Notes
- Current module files are scaffold-only and need full implementation:
  - `src/modules/items-group-master/items-group-master.controller.ts`
  - `src/modules/items-group-master/items-group-master.service.ts`
  - `src/modules/items-group-master/dto/*`
- Current Prisma model requires field/constraint alignment with this contract before API build-out.
