# Item Group Path Cache Automation Plan

## Summary
- Implement server-managed `itg_path_ids_cache` so clients never send this field.
- On create, new item group stores its own `itg_id` in `itg_path_ids_cache`.
- When creating a child with `itg_parent_id`, the child `itg_id` is added to parent and all ancestors.
- On reparent, move subtree ids from old ancestor chain to new ancestor chain.
- On soft delete, remove deleted node subtree ids from ancestor caches.
- Keep current cycle policy (only self-parent is blocked).

## Public API / Interface Changes
- `src/modules/items-group-master/dto/save-item-group.dto.ts`
- Remove input property `itg_path_ids_cache`.
- Because global `ValidationPipe` uses `whitelist: true` and `forbidNonWhitelisted: true`, requests containing `itg_path_ids_cache` return `400`.
- `src/modules/items-group-master/types/item-group-api.types.ts`
- Keep response field `itg_path_ids_cache` unchanged.
- `src/modules/items-group-master/dto/item-group-response.dto.ts`
- Keep output schema unchanged (still returns cache).

## Implementation Design

### 1) Files to Update
- `docs/item-group-path-cache-plan.md` (new plan doc).
- `src/modules/items-group-master/dto/save-item-group.dto.ts`.
- `src/modules/items-group-master/items-group-master.service.ts`.
- `src/modules/items-group-master/items-group-master.service.spec.ts`.
- `src/modules/items-group-master/dto/save-item-group.dto.spec.ts`.

### 2) Service-level Rules
- Treat `itg_path_ids_cache` as server-owned.
- Cache semantics: self + descendants.
- Cache is set-like (no duplicate UUIDs); order is not contractually guaranteed.
- Only active/non-deleted ancestor rows are updated.
- No additional indirect-cycle validation beyond existing self-parent check.

### 3) Create Flow (`createItemGroup`)
- Run inside a Prisma transaction.
- Validate parent exists when `itg_parent_id` is present.
- Create row without taking any path cache from request.
- Immediately set created row cache to `[created.itgId]`.
- If parent exists, resolve ancestor chain starting at parent.
- Append `[created.itgId]` into each ancestor cache with dedupe.
- Return final created payload.

### 4) Update Flow (`updateItemGroup`)
- Run inside a Prisma transaction.
- Keep existing checks: target exists, self-parent rejected, parent exists when provided.
- Determine parent change by comparing existing `itgParentId` vs effective new parent.
- Always keep target row cache containing at least its own `itgId`.
- If parent changed:
- Build active subtree ids rooted at current node (includes self).
- Resolve old ancestor chain and remove subtree ids from old ancestors.
- Resolve new ancestor chain and append subtree ids to new ancestors.
- Return updated payload.

### 5) Soft Delete Flow (`softDelete`)
- Run inside a Prisma transaction.
- Load target row (active).
- Build active subtree ids rooted at target before delete update.
- Resolve ancestor chain from target's current parent.
- Soft delete target (existing behavior remains).
- Remove subtree ids from ancestor caches.
- Return `{ itg_id, deleted: true }`.

### 6) Helper Methods to Add in Service
- `getAncestorIds(tx, startParentId): Promise<string[]>` with visited-set guard.
- `getActiveSubtreeIds(tx, rootId): Promise<string[]>` (BFS/iterative with visited-set guard).
- `appendPathIds(tx, targetIds, idsToAdd): Promise<void>` using dedupe merge semantics.
- `removePathIds(tx, targetIds, idsToRemove): Promise<void>` using filter semantics.
- `ensureSelfInPath(tx, itgId): Promise<void>`.

### 7) Data/Compatibility
- No Prisma schema migration required.
- No historical backfill included in this feature; behavior applies to new create/update/delete actions after release.

## Test Cases and Scenarios

### `save-item-group.dto.spec.ts`
- Sending `itg_path_ids_cache` fails validation under whitelist+forbidNonWhitelisted settings.

### `items-group-master.service.spec.ts`
- Create root group sets cache to `[selfId]`.
- Create child adds child id to parent cache.
- Create grandchild adds grandchild id to parent and grandparent caches.
- Update with parent change moves subtree ids from old ancestor chain to new chain.
- Update with `itg_parent_id: null` removes subtree ids from former ancestors.
- Soft delete leaf removes leaf id from ancestors.
- Soft delete node with descendants removes subtree ids from ancestors.
- Duplicate ids are not introduced in caches after repeated operations.
- Existing self-parent rejection behavior remains intact.

## Acceptance Criteria
- API rejects `itg_path_ids_cache` in save payload with `400`.
- Newly created item group stores its own `itg_id` in `itg_path_ids_cache`.
- Creating child with parent id updates parent/ancestor caches automatically in DB.
- Reparent and soft delete keep ancestor caches consistent with subtree membership.
- All updated unit tests pass for item-group module.

## Assumptions and Defaults Chosen
- Cache semantics are self + descendants.
- Client input for cache is forbidden (validation error), not ignored.
- Feature includes create, reparent, and soft-delete cache maintenance.
- Indirect cycle prevention is intentionally not added in this iteration (current behavior kept).
- Cache array order is treated as non-contractual; uniqueness is enforced.
