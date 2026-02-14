# Item Section Master CRUD API Plan

## 1. Goal
Implement `Item Section Master` APIs (company-scoped hierarchical sections) with:
- company-scoped uniqueness,
- parent-child hierarchy handling,
- soft delete only (`sec_is_deleted = true`),
- consistent response envelope across all endpoints.

## 2. Scope
- Module: `src/modules/items-section-master` (to be created/aligned)
- DB table: `public.item_section_master`
- API base: `/api/v1/item-sections`
- CRUD operations:
  - Save (create/update): `POST ` (use `sec_id` in request body for update)
  - List/Search: `GET /list`
  - Get by ID: `GET /get/:sec_id`
  - Delete (soft): `DELETE /delete/:sec_id`

## 3. Database Contract (Target)
### 3.1 Required rules
- `sec_name` is required.
- `sec_company_id` is required.
- Unique per company: `(sec_company_id, sec_name)`.
- `sec_parent_id` cannot equal `sec_id` (self-parent check).
- Parent section (when provided) must exist and should belong to the same company.
- No physical delete; use soft delete only.
- Default list/search behavior must exclude deleted rows (`sec_is_deleted = false`).

### 3.2 Core columns
| Column | Type | Notes |
|---|---|---|
| `sec_id` | UUID | PK, `uuidv7()` |
| `sec_name` | VARCHAR(150) | Required |
| `sec_alias` | VARCHAR(100) | Optional |
| `sec_short` | VARCHAR(50) | Optional |
| `sec_description` | VARCHAR(250) | Optional |
| `sec_company_id` | UUID | Required company scope |
| `sec_parent_id` | UUID | Parent section, nullable |
| `sec_sort` | INTEGER | Optional |
| `sec_level` | INTEGER | Optional hierarchy level |
| `sec_path_ids` | UUID[] | Optional hierarchy path cache |
| `sec_position` | INTEGER | Optional display position |
| `sec_color_code` | VARCHAR(20) | Optional color value |
| `sec_icon` | VARCHAR(100) | Optional icon identifier |
| `sec_photo` | BYTEA | Optional image blob |
| `sec_photo_url` | TEXT | Optional image URL |
| `sec_sync_date` | TIMESTAMPTZ | Sync timestamp |
| `sec_is_active` | BOOLEAN | Default `true` |
| `sec_is_deleted` | BOOLEAN | Default `false` |
| `sec_created_on` | TIMESTAMPTZ | Default `now()` |
| `sec_created_by` | VARCHAR(100) | Audit |
| `sec_modified_on` | TIMESTAMPTZ | Default `now()` |
| `sec_modified_by` | VARCHAR(100) | Audit |

## 4. API Contract
### 4.1 Common conventions
- Prefix: `/api/v1`
- Content-Type: `application/json` (and optional `multipart/form-data` for photo upload)
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
1. `POST /api/v1/item-sections`
   - Create when `sec_id` is not provided in request body.
   - Update when `sec_id` is provided in request body.
   - Validate required fields, company-scoped uniqueness, and hierarchy constraints.
2. `GET /api/v1/item-sections/list`
   - Optional filters: `sec_company_id`, `sec_parent_id`, `sec_is_active`, `search`, `page`, `limit`.
   - Exclude soft-deleted rows by default.
3. `GET /api/v1/item-sections/get/:sec_id`
   - Get a single section by ID.
   - Return `404` if not found or soft-deleted.
4. `DELETE /api/v1/item-sections/delete/:sec_id`
   - Soft delete only (`sec_is_deleted = true`, update modified audit fields).

## 5. Implementation Plan
### Phase 1: Schema alignment (Prisma + migration)
- [ ] Confirm Prisma model and migration are aligned for all section columns/defaults.
- [ ] Keep unique constraint: `(sec_company_id, sec_name)`.
- [ ] Add DB/app self-parent guard (`sec_parent_id <> sec_id`).
- [ ] Confirm self-reference foreign key behavior (`ON DELETE RESTRICT`, `ON UPDATE CASCADE`).
- [ ] Generate/apply migration if any schema updates are needed.

### Phase 2: DTOs and validation
- [ ] Build `SaveItemSectionDto`, `ListItemSectionQueryDto`.
- [ ] Add validators for:
  - `sec_id` optional in save body (present means update),
  - required `sec_name` and `sec_company_id`,
  - UUID/number/boolean types,
  - pagination bounds.
- [ ] Add optional color format validation for `sec_color_code` if used (for example, hex).
- [ ] Handle base64 image mapping for `sec_photo` if provided.

### Phase 3: Service layer
- [ ] Implement save logic with create/update branches based on `sec_id` presence.
- [ ] Enforce company-scoped duplicate handling and map to `409`.
- [ ] Validate parent existence, same-company parent, and self-parent rejection.
- [ ] Optionally compute and persist `sec_level`/`sec_path_ids` from hierarchy.
- [ ] Implement list/search with pagination and default soft-delete exclusion.
- [ ] Implement get-by-id with soft-delete awareness.
- [ ] Implement soft delete (`sec_is_deleted = true`) with audit updates.

### Phase 4: Controller and routing
- [ ] Create controller routes under `item-sections` with v1 versioning.
- [ ] Add DTO validation for body/query/params.
- [ ] Support `multipart/form-data` photo upload pattern if needed.
- [ ] Return standard success/error envelope.

### Phase 5: Error mapping and response standards
- [ ] Map validation errors to `400 Bad Request`.
- [ ] Map Prisma unique violation to `409 Conflict`.
- [ ] Map not found/soft-deleted cases to `404 Not Found`.
- [ ] Keep error payload shape consistent (`errors[]`).

### Phase 6: Testing
- [ ] Unit tests for service validation and hierarchy rules.
- [ ] Integration tests for save (create + update)/list/get-by-id/delete flows.
- [ ] Edge tests:
  - duplicate `sec_name` within same company,
  - same `sec_name` across different companies,
  - self-parent rejection,
  - parent from another company rejected,
  - get-by-id returns `404` for soft-deleted rows,
  - deleted rows excluded from list,
  - pagination/search behavior.

## 6. Acceptance Criteria
- CRUD endpoints are available under `/api/v1/item-sections/*`.
- Soft delete works and no physical deletion is used.
- Company-scoped uniqueness and hierarchy constraints are enforced.
- List endpoint excludes deleted rows by default.
- Standard success/error envelope is used across endpoints.
- Tests pass for core and edge scenarios.

## 7. Notes
- `item_section_master` exists in Prisma schema and migrations, but API module scaffolding for sections is not present yet.
- Current patterns in the repo (item brands/groups) use `POST ` for save (create/update), which this plan follows.
