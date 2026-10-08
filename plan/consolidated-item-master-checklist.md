# Consolidated Item Master Implementation Checklist

> Implementation guide for creating a single-payload endpoint that saves item master + unit conversions + EAN codes + reorders + prices in one API call (non-atomic; item saved first, then children).

## Phase 1: Create DTOs & Types
- [ ] **Create** `src/modules/Inventory/items-master/dto/save-item-composite.dto.ts`
  - Nested `item: SaveItemDto`
  - Optional arrays: `unit_conversions[]`, `ean_codes[]`, `reorders[]`, `prices[]`
  - Use `@Type()`, `@ValidateNested()`, `@IsArray()` decorators
  
- [ ] **Create** `src/modules/Inventory/items-master/types/item-composite-api.types.ts`
  - `ItemCompositePayload` interface (item + 4 child arrays)
  - `ItemCompositeSuccessResponse<T>` type alias
  
- [ ] **Create** `src/modules/Inventory/items-master/dto/item-composite-response.dto.ts`
  - `ItemCompositeSuccessSingleDto` class with swagger decorators
  - `ItemCompositeResponse` type alias

## Phase 2: Parent Service Method
- [ ] **items-master.service.ts** — Add `saveComposite(dto: SaveItemCompositeDto)` method after existing `save()` method
  - Step 1: `await this.save(dto.item)` → get `itemPayload` and extract `itemId`
  - Step 2: Loop children in order (unit-conversions → prices → EAN codes → reorders)
    - Inject `itemId` via `.map(d => ({...d, iuc_item_id: itemId}))` pattern
    - Call existing child service `.save()` method with injected DTOs
  - Step 3: Assemble composite response with all results
  - Error handling: call `this.handleWriteError(error)` for child failures

## Phase 3: Controller Endpoint
- [ ] **items-master.controller.ts** — Add `@Post('save-composite')` route
  - Accept `SaveItemCompositeDto` body
  - Call `this.itemsMasterService.saveComposite(dto)`
  - Return composite response with success message
  - Add Swagger decorators: `@ApiCreatedResponse`, `@ApiBadRequestResponse`, etc.
  - Import new DTO and response classes

## Phase 4: Testing
- [ ] **Unit test** — `items-master.service.spec.ts`:
  - Happy path: create composite with all child arrays → verify response includes all 5 records
  - Update composite: item_id present → verify update flow works
  - Orphan scenario: child save fails → verify item was already persisted, child save error thrown to client
  - ItemId injection: verify each child array row gets correct injected `*_item_id` matching parent `item_id`

- [ ] **Integration test** — Call `POST /items/save-composite`:
  - Create full item + all children in one call
  - Verify HTTP 201 with composite payload
  - Verify all 5 audit log rows created (one per entity type)
  - Verify all child records linked to correct parent item

- [ ] **Error scenario**:
  - Invalid price DTO (missing required field) → verify error thrown, item already persisted (orphaned)
  - Verify 400 response with child service error details

- [ ] **Swagger docs** — Open `http://localhost:3000/api/docs`, verify composite endpoint listed with correct DTOs

## Known Gotchas
- ⚠️ **NOT atomic**: Item saved first, children after. If child fails, item already persists orphaned. This is intentional for simplicity.
- ⚠️ **ItemId injection**: Composite service spreads DTOs: `{ ...dto, iuc_item_id: itemId }`. This OVERWRITES any client-supplied item ID, which is correct behavior.
- ⚠️ **Order matters**: Unit-conversions → Prices → EAN codes → Reorders. Prices need unit-conversion rows to already exist.
- ⚠️ **No auto-delete**: Rows absent from payload are NOT deleted. Client calls `DELETE items-prices?ipm_id=...` separately.

## Post-Implementation Improvements (Out of Scope for v1)
- [ ] **Code deduplication:** `normalizeItemUnitConversionFactors` logic exists in both `item-unit-conversion.service.ts` and `items-price-master.service.ts`. Extract to shared utility.
- [ ] **Actor column harmonization:** Standardize UUID vs. VarChar(100) actor columns across all modules.
- [ ] **Sparse response fields:** Allow optional `?fields=item.item_id,prices.ipm_id` query param to reduce composite response payload.
- [ ] **Bulk import:** Support array of composite payloads in single endpoint (batch save N items + all their children).

---

**Status:** Ready to implement  
**Estimated effort:** 2–3 hours (very modular: 3 files create, 2 files modify, reuses all existing child service methods)  
**Complexity:** Low (no transaction refactoring, no service-layer changes to children, direct method reuse)  
**Risk:** Low (reuses existing patterns, child services completely unchanged)  
**Owner:** [Assign developer]  
**Start date:** [Fill in]  
**Target completion:** [Fill in]
