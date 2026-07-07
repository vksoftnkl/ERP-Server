import { Injectable } from '@nestjs/common';
import {
  CompositeItemEanCodeDto,
  CompositeItemPriceDto,
  CompositeItemReorderDto,
  CompositeItemUnitConversionDto,
  SaveItemCompositeDto,
} from './dto/save-item-composite.dto';
import { ItemCompositePayload } from './types/item-composite-api.types';
import { ItemUnitConversionService } from '../item-unit-conversion/item-unit-conversion.service';
import { ItemsPriceMasterService } from '../items-price-master/items-price-master.service';
import { ItemsEanCodeMasterService } from '../items-ean-code-master/items-ean-code-master.service';
import { ItemsReorderMasterService } from '../items-reorder-master/items-reorder-master.service';
import { SaveItemUnitConversionDto } from '../item-unit-conversion/dto/save-item-unit-conversion.dto';
import { SaveItemPriceDto } from '../items-price-master/dto/save-item-price.dto';
import { SaveItemEanCodeDto } from '../items-ean-code-master/dto/save-item-ean-code.dto';
import { SaveItemReorderDto } from '../items-reorder-master/dto/save-item-reorder.dto';
import { ItemUnitConversionPayload } from '../item-unit-conversion/types/item-unit-conversion-api.types';
import { ItemPricePayload } from '../items-price-master/types/item-price-api.types';
import { ItemEanCodePayload } from '../items-ean-code-master/types/item-ean-code-api.types';
import { ItemReorderPayload } from '../items-reorder-master/types/item-reorder-api.types';

export type ItemChildrenSyncResult = Omit<ItemCompositePayload, 'item'>;

/*
 * Natural keys used to match payload rows against the item's existing rows:
 *   ean_codes        → ean_code                      (unique per item)
 *   unit_conversions → iuc_unit_id                   (one conversion row per unit)
 *   prices           → ipm_unit_id + ipm_godown_id
 *   reorders         → ir_unit_id + ir_godown_id     (nulls = the global rule)
 *
 * Fields never compared when deciding whether a matched row changed: the row's
 * own PK, the parent item id, and actor columns (created/modified/updated by) —
 * differences there alone are not data changes worth a write.
 */
const EAN_IGNORED_FIELDS = new Set(['ean_id', 'ean_item_id', 'ean_created_by', 'ean_modified_by']);
const IUC_IGNORED_FIELDS = new Set([
  'iuc_id',
  'iuc_item_id',
  'iuc_created_by',
  'iuc_updated_by',
  // Stray legacy field on SaveItemUnitConversionDto with no matching column.
  'iul_unit_factor',
]);
const IPM_IGNORED_FIELDS = new Set(['ipm_id', 'ipm_item_id', 'ipm_created_by', 'ipm_updated_by']);
const IR_IGNORED_FIELDS = new Set(['ir_id', 'ir_item_id', 'ir_created_by', 'ir_modified_by']);

@Injectable()
export class ItemMasterUpdateService {
  constructor(
    private readonly itemUnitConversionService: ItemUnitConversionService,
    private readonly itemsPriceMasterService: ItemsPriceMasterService,
    private readonly itemsEanCodeMasterService: ItemsEanCodeMasterService,
    private readonly itemsReorderMasterService: ItemsReorderMasterService,
  ) {}

  /**
   * Diff-syncs the item's four child collections (unit conversions, prices,
   * EAN codes, reorders) against the composite payload, in dependency order.
   *
   * Per provided collection:
   * 1. The item's existing non-deleted rows are fetched and matched to payload
   *    rows by natural key (or by an explicitly supplied row id).
   * 2. Payload rows with no match are created.
   * 3. Matched rows are updated — only when a supplied field actually differs.
   * 4. Existing rows not claimed by any payload row are soft-deleted.
   *
   * An OMITTED (undefined) collection is left completely untouched and comes
   * back as an empty array; an EMPTY array soft-deletes every remaining row of
   * that table for the item. Like the rest of the composite save, this is
   * NON-ATOMIC: each child service call runs in its own transaction.
   *
   * All writes go through the existing child services, so their validation,
   * unique-constraint handling and audit logging apply unchanged.
   *
   * @param itemId Parent item id, injected into every child row.
   * @param dto    Composite payload whose child arrays drive the sync.
   * @returns The post-sync non-deleted rows of every provided collection.
   */
  async syncChildren(
    itemId: string,
    dto: SaveItemCompositeDto,
  ): Promise<ItemChildrenSyncResult> {
    const unit_conversions = await this.syncUnitConversions(itemId, dto.unit_conversions);
    const prices = await this.syncPrices(itemId, dto.prices);
    const ean_codes = await this.syncEanCodes(itemId, dto.ean_codes);
    const reorders = await this.syncReorders(itemId, dto.reorders);
    return { unit_conversions, prices, ean_codes, reorders };
  }

  /** Sync item_unit_conversion rows; natural key: iuc_unit_id. */
  private async syncUnitConversions(
    itemId: string,
    children: CompositeItemUnitConversionDto[] | undefined,
  ): Promise<ItemUnitConversionPayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemUnitConversionService.findByItemId(itemId);
    const existingByKey = new Map(existing.map((row) => [row.iuc_unit_id, row]));

    const toSave: SaveItemUnitConversionDto[] = [];
    const claimedIds = new Set<string>();
    for (const child of children) {
      const match = child.iuc_id
        ? existing.find((row) => row.iuc_id === child.iuc_id)
        : existingByKey.get(child.iuc_unit_id);
      if (match) {
        claimedIds.add(match.iuc_id);
        if (!this.rowChanged(child, match, IUC_IGNORED_FIELDS)) {
          continue;
        }
      }
      toSave.push({ ...child, iuc_item_id: itemId, iuc_id: child.iuc_id ?? match?.iuc_id });
    }

    // Soft-delete first: releasing removed rows (e.g. an old base unit) before
    // saving avoids clashes on the table's partial unique indexes.
    const staleIds = existing
      .filter((row) => !claimedIds.has(row.iuc_id))
      .map((row) => row.iuc_id);
    if (staleIds.length > 0) {
      await this.itemUnitConversionService.toggleDelete(staleIds);
    }
    if (toSave.length > 0) {
      await this.itemUnitConversionService.save(toSave);
    }
    return this.itemUnitConversionService.findByItemId(itemId);
  }

  /** Sync item_price_master rows; natural key: (ipm_unit_id, ipm_godown_id). */
  private async syncPrices(
    itemId: string,
    children: CompositeItemPriceDto[] | undefined,
  ): Promise<ItemPricePayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemsPriceMasterService.findByItemId(itemId);
    const existingByKey = new Map(
      existing.map((row) => [this.pairKey(row.ipm_unit_id, row.ipm_godown_id), row]),
    );

    const toSave: SaveItemPriceDto[] = [];
    const claimedIds = new Set<string>();
    for (const child of children) {
      const match = child.ipm_id
        ? existing.find((row) => row.ipm_id === child.ipm_id)
        : existingByKey.get(this.pairKey(child.ipm_unit_id, child.ipm_godown_id));
      if (match) {
        claimedIds.add(match.ipm_id);
        if (!this.rowChanged(child, match, IPM_IGNORED_FIELDS)) {
          continue;
        }
      }
      toSave.push({ ...child, ipm_item_id: itemId, ipm_id: child.ipm_id ?? match?.ipm_id });
    }

    const staleIds = existing
      .filter((row) => !claimedIds.has(row.ipm_id))
      .map((row) => row.ipm_id);
    if (staleIds.length > 0) {
      await this.itemsPriceMasterService.toggleDelete(staleIds);
    }
    if (toSave.length > 0) {
      await this.itemsPriceMasterService.save(toSave);
    }
    return this.itemsPriceMasterService.findByItemId(itemId);
  }

  /** Sync item_ean_codes rows; natural key: ean_code. */
  private async syncEanCodes(
    itemId: string,
    children: CompositeItemEanCodeDto[] | undefined,
  ): Promise<ItemEanCodePayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemsEanCodeMasterService.findByItemId(itemId);
    const existingByKey = new Map(existing.map((row) => [row.ean_code, row]));

    const toSave: SaveItemEanCodeDto[] = [];
    const claimedIds = new Set<string>();
    for (const child of children) {
      const match = child.ean_id
        ? existing.find((row) => row.ean_id === child.ean_id)
        : existingByKey.get(child.ean_code);
      if (match) {
        claimedIds.add(match.ean_id);
        if (!this.rowChanged(child, match, EAN_IGNORED_FIELDS)) {
          continue;
        }
      }
      toSave.push({ ...child, ean_item_id: itemId, ean_id: child.ean_id ?? match?.ean_id });
    }

    // Soft-delete first: ean_code is globally unique and only one default
    // barcode is allowed per scope, so removed rows must release both first.
    const staleIds = existing
      .filter((row) => !claimedIds.has(row.ean_id))
      .map((row) => row.ean_id);
    if (staleIds.length > 0) {
      await this.itemsEanCodeMasterService.toggleDelete(staleIds);
    }
    if (toSave.length > 0) {
      await this.itemsEanCodeMasterService.save(toSave);
    }
    return this.itemsEanCodeMasterService.findByItemId(itemId);
  }

  /** Sync item_reorders rows; natural key: (ir_unit_id, ir_godown_id). */
  private async syncReorders(
    itemId: string,
    children: CompositeItemReorderDto[] | undefined,
  ): Promise<ItemReorderPayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemsReorderMasterService.findByItemId(itemId);
    const existingByKey = new Map(
      existing.map((row) => [this.pairKey(row.ir_unit_id, row.ir_godown_id), row]),
    );

    const toSave: SaveItemReorderDto[] = [];
    const claimedIds = new Set<string>();
    for (const child of children) {
      const match = child.ir_id
        ? existing.find((row) => row.ir_id === child.ir_id)
        : existingByKey.get(this.pairKey(child.ir_unit_id ?? null, child.ir_godown_id ?? null));
      if (match) {
        claimedIds.add(match.ir_id);
        if (!this.rowChanged(child, match, IR_IGNORED_FIELDS)) {
          continue;
        }
      }
      toSave.push({ ...child, ir_item_id: itemId, ir_id: child.ir_id ?? match?.ir_id });
    }

    const staleIds = existing
      .filter((row) => !claimedIds.has(row.ir_id))
      .map((row) => row.ir_id);
    if (staleIds.length > 0) {
      await this.itemsReorderMasterService.toggleDelete(staleIds);
    }
    if (toSave.length > 0) {
      await this.itemsReorderMasterService.save(toSave);
    }
    return this.itemsReorderMasterService.findByItemId(itemId);
  }

  /**
   * Returns true when any field the client actually supplied differs from the
   * stored row. Undefined dto fields (not sent) and ignored fields are skipped;
   * a dto field the stored payload does not expose counts as changed, so the
   * row is saved rather than silently skipped.
   */
  private rowChanged(
    child: object,
    existingRow: object,
    ignoredFields: ReadonlySet<string>,
  ): boolean {
    const existingFields = existingRow as Record<string, unknown>;
    for (const [field, value] of Object.entries(child)) {
      if (value === undefined || ignoredFields.has(field)) {
        continue;
      }
      const current = existingFields[field];
      if (typeof value === 'number' && typeof current === 'number') {
        if (value !== current) {
          return true;
        }
      } else if (current !== value) {
        return true;
      }
    }
    return false;
  }

  /**
   * Builds a composite map key for two-column natural keys. UUIDs never contain
   * "::", so the delimiter cannot produce colliding keys; nulls collapse to ''.
   */
  private pairKey(left: string | null | undefined, right: string | null | undefined): string {
    return `${left ?? ''}::${right ?? ''}`;
  }
}
