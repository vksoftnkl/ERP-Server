# Item Brand Path Cache Automation Plan

## Summary
Apply the same path-cache automation used for item groups and sections to `item-brand-master`:

- Make `brand_path_ids` server-managed (client cannot send it in save API).
- On create, store self `brand_id` in `brand_path_ids`.
- On child create, append child `brand_id` to parent + all ancestors.
- On reparent, move subtree ids from old ancestor chain to new ancestor chain.
- On soft delete, remove deleted subtree ids from ancestor caches.
- Keep current cycle policy unchanged (only self-parent check).

## Public API / Interface Changes
- `src/modules/items-brand-master/dto/save-item-brand.dto.ts`
- Remove input field `brand_path_ids`.
- With global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`), request bodies containing `brand_path_ids` will return `400`.
- `src/modules/items-brand-master/types/item-brand-api.types.ts`
- Keep output `brand_path_ids` as-is.
- `src/modules/items-brand-master/dto/item-brand-response.dto.ts`
- Keep output contract unchanged (still returns `brand_path_ids`).

## Important Files to Change
- `docs/item-brand-path-cache-plan.md` (new).
- `src/modules/items-brand-master/dto/save-item-brand.dto.ts`.
- `src/modules/items-brand-master/items-brand-master.service.ts`.
- `src/modules/items-brand-master/items-brand-master.service.spec.ts`.
- `src/modules/items-brand-master/dto/save-item-brand.dto.spec.ts` (new).

## Service Design (Decision Complete)

### 1) Ownership Rules
- `brand_path_ids` is always computed by backend.
- Semantics: `self + descendants`.
- Stored as set-like array (dedupe enforced; ordering non-contractual).
- Only active/non-deleted ancestor rows are updated.
- No extra indirect-cycle validation in this scope.

### 2) Transaction Client Setup
- Add internal alias:
- `type ItemBrandWriteClient = Prisma.TransactionClient | PrismaService`
- All hierarchy write operations run under `this.prisma.$transaction(...)`.

### 3) Create Flow (`createItemBrand`)
- If `brand_parent_id` provided, validate parent exists (non-deleted) using transaction client.
- Build create payload without `brand_path_ids`.
- Create brand row.
- Ensure self path (`[created.brand_id]`) on created row.
- If parent exists:
- Resolve ancestor chain from `brand_parent_id`.
- Append `created.brand_id` into each ancestor cache with dedupe.
- Return refreshed created row payload.

### 4) Update Flow (`updateItemBrand`)
- Load existing row (non-deleted), fail `404` if missing.
- Keep current self-parent rejection.
- If provided parent id is non-null, validate parent exists.
- Determine effective parent:
- If `brand_parent_id` key exists in DTO, use provided value (including `null`).
- Otherwise use existing `brand_parent_id`.
- Detect parent-change only when key present and value differs.
- Run normal update fields (excluding `brand_path_ids`).
- Ensure self id remains in target `brand_path_ids`.
- If parent changed:
- Compute active subtree ids rooted at current brand (self + descendants).
- Resolve old ancestors from previous parent.
- Resolve new ancestors from new parent.
- Remove subtree ids from old ancestor caches.
- Append subtree ids to new ancestor caches.
- Return refreshed updated payload.

### 5) Soft Delete Flow (`softDelete`)
- Start transaction.
- Load target row (non-deleted), fail `404` if missing.
- Compute active subtree ids rooted at target.
- Resolve ancestor chain from target’s current parent.
- Execute existing soft-delete update (`brand_is_deleted = true`, modified audit fields).
- Remove subtree ids from ancestor caches.
- Return `{ brand_id, deleted: true }`.

### 6) Helper Methods to Add
- `getAncestorIds(tx, startParentId): Promise<string[]>`
- Traverse parent chain with visited-set guard.
- `getActiveSubtreeIds(tx, rootId): Promise<string[]>`
- BFS over active/non-deleted rows with visited-set guard.
- `appendPathIds(tx, targetIds, idsToAdd): Promise<void>`
- Read current caches, merge with dedupe, update only when changed.
- `removePathIds(tx, targetIds, idsToRemove): Promise<void>`
- Filter ids, update only when changed.
- `ensureSelfInPath(tx, brandId): Promise<void>`
- `toUniqueIds`, `mergePathIds`, `excludePathIds`, `areSameIds` utilities.

### 7) Optional Field Mapping Update
- In `applyOptionalFields`, remove `brand_path_ids` mapping block so client payload never writes cache directly.

## Test Cases and Scenarios

### DTO Validation (`save-item-brand.dto.spec.ts` new)
- Accept valid payload shapes for `brand_photo`.
- Reject body containing `brand_path_ids` using `ValidationPipe` with whitelist+forbidNonWhitelisted.

### Service Unit Tests (`items-brand-master.service.spec.ts`)
- Add `$transaction` mock wiring (callback executes against prisma mock).
- Create root brand sets `brand_path_ids` to `[selfId]`.
- Create child updates parent cache.
- Create grandchild updates parent + grandparent caches.
- Reparent moves subtree ids from old ancestors to new ancestors.
- Reparent to `null` removes subtree ids from former ancestors.
- Soft delete leaf removes id from ancestors.
- Soft delete node with descendants removes subtree ids from ancestors.
- Duplicate ids are not re-added when already present.
- Existing self-parent rejection still passes.
- Existing photo/base64 tests still pass after transactional flow changes.

## Data / Migration / Compatibility
- No Prisma schema migration required (`brand_path_ids` already exists with UUID[] default).
- No historical backfill included.
- Behavior applies to create/update/delete operations after deployment.

## Acceptance Criteria
- Save API rejects `brand_path_ids` input with `400`.
- Newly created brand always stores own `brand_id` in `brand_path_ids`.
- Creating child with parent auto-updates parent/ancestor caches in DB.
- Reparent and soft delete keep ancestor caches consistent with subtree membership.
- Item-brand module tests pass with new hierarchy cache scenarios.

## Assumptions and Defaults
- Scope matches implemented item-group/item-section semantics.
- Cycle policy remains unchanged (no indirect cycle validation in this task).
- Cache order is not treated as API contract; uniqueness is guaranteed.
- Existing response schema for `brand_path_ids` remains unchanged.
