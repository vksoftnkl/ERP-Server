# Item Section Path Cache Automation Plan

## Summary
Apply the same path-cache automation used for item groups to `item-section-master`:

- Make `sec_path_ids` server-managed (client cannot send it in save API).
- On create, store self `sec_id` in `sec_path_ids`.
- On child create, append child `sec_id` to parent + all ancestors.
- On reparent, move subtree ids from old ancestor chain to new ancestor chain.
- On soft delete, remove deleted subtree ids from ancestor caches.
- Keep current cycle policy unchanged (only self-parent check).

## Public API / Interface Changes
- `src/modules/items-section-master/dto/save-item-section.dto.ts`
- Remove input field `sec_path_ids`.
- With global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`), request bodies containing `sec_path_ids` will return `400`.
- `src/modules/items-section-master/types/item-section-api.types.ts`
- Keep output `sec_path_ids` as-is.
- `src/modules/items-section-master/dto/item-section-response.dto.ts`
- Keep output contract unchanged (still returns `sec_path_ids`).

## Important Files to Change
- `docs/item-section-path-cache-plan.md` (new).
- `src/modules/items-section-master/dto/save-item-section.dto.ts`.
- `src/modules/items-section-master/items-section-master.service.ts`.
- `src/modules/items-section-master/items-section-master.service.spec.ts`.
- `src/modules/items-section-master/dto/save-item-section.dto.spec.ts` (new, mirrors item-group DTO validation pattern).

## Service Design (Decision Complete)

### 1) Ownership Rules
- `sec_path_ids` is always computed by backend.
- Semantics: `self + descendants`.
- Stored as set-like array (dedupe enforced; ordering non-contractual).
- Only active/non-deleted ancestor rows are updated.
- No extra indirect-cycle validation in this scope.

### 2) Transaction Client Setup
- Add internal alias:
- `type ItemSectionWriteClient = Prisma.TransactionClient | PrismaService`
- All hierarchy write operations run under `this.prisma.$transaction(...)`.

### 3) Create Flow (`createItemSection`)
- If `sec_parent_id` provided, validate parent exists (non-deleted) using transaction client.
- Build create payload without `sec_path_ids`.
- Create section row.
- Ensure self path (`[created.secId]`) on created row.
- If parent exists:
- Resolve ancestor chain from `sec_parent_id`.
- Append `created.secId` into each ancestor cache with dedupe.
- Return refreshed created row payload.

### 4) Update Flow (`updateItemSection`)
- Load existing row (non-deleted), fail `404` if missing.
- Keep current self-parent rejection.
- If provided parent id is non-null, validate parent exists.
- Determine effective parent:
- If `sec_parent_id` key exists in DTO, use provided value (including `null`).
- Otherwise use existing `secParentId`.
- Detect parent-change only when key present and value differs.
- Run normal update fields (excluding `sec_path_ids`).
- Ensure self id remains in target `sec_path_ids`.
- If parent changed:
- Compute active subtree ids rooted at current section (self + descendants).
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
- Execute existing soft-delete update (`secIsDeleted = true`, modified audit fields).
- Remove subtree ids from ancestor caches.
- Return `{ sec_id, deleted: true }`.

### 6) Helper Methods to Add
- `getAncestorIds(tx, startParentId): Promise<string[]>`
- Traverse parent chain with visited-set guard.
- `getActiveSubtreeIds(tx, rootId): Promise<string[]>`
- BFS over active/non-deleted rows with visited-set guard.
- `appendPathIds(tx, targetIds, idsToAdd): Promise<void>`
- Read current caches, merge with dedupe, update only when changed.
- `removePathIds(tx, targetIds, idsToRemove): Promise<void>`
- Filter ids, update only when changed.
- `ensureSelfInPath(tx, secId): Promise<void>`
- `toUniqueIds`, `mergePathIds`, `excludePathIds`, `areSameIds` utilities.

### 7) Optional Field Mapping Update
- In `applyOptionalFields`, remove `sec_path_ids` mapping block so client payload never writes cache directly.

## Test Cases and Scenarios

### DTO Validation (`save-item-section.dto.spec.ts` new)
- Accept existing valid payload shapes for `sec_photo`.
- Reject body containing `sec_path_ids` using `ValidationPipe` with whitelist+forbidNonWhitelisted.

### Service Unit Tests (`items-section-master.service.spec.ts`)
- Add `$transaction` mock wiring (callback executes against prisma mock).
- Create root section sets `sec_path_ids` to `[selfId]`.
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
- No Prisma schema migration required (`sec_path_ids` already exists with UUID[] default).
- No historical backfill included.
- Behavior applies to create/update/delete operations after deployment.

## Acceptance Criteria
- Save API rejects `sec_path_ids` input with `400`.
- Newly created section always stores own `sec_id` in `sec_path_ids`.
- Creating child with parent auto-updates parent/ancestor caches in DB.
- Reparent and soft delete keep ancestor caches consistent with subtree membership.
- Item-section module tests pass with new hierarchy cache scenarios.

## Assumptions and Defaults
- “Do the same thing” means same semantics as item-group implementation.
- Cycle policy remains unchanged (no indirect cycle validation in this task).
- Cache order is not treated as API contract; uniqueness is guaranteed.
- Existing response schema for `sec_path_ids` remains unchanged.
