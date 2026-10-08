import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import {
  PriceBucketService,
  toBucketSource,
  type PriceBucketSource,
} from '../items-price-master/price-bucket.service';
import type { BucketKey } from '../items-price-master/price-resolver';
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
import { throwInventoryBadRequest } from 'src/common/utils/module-service.utils';
import type { InventoryErrorDetail } from 'src/common/utils/module-service.utils';

export type ItemChildrenSyncResult = Omit<ItemCompositePayload, 'item'>;

/**
 * item_ean_codes.ean_unit_id, item_reorders.ir_unit_id and
 * item_price_master.ipm_uc_unit_id are FKs to item_unit_conversion(iuc_id):
 * they hold an iuc_id, NOT a raw unit_id (see migrations
 * 20260711141604_retarget_ean_ir_unit_to_iuc and
 * 20260718055209_changed_the_unit_id_in_price_master_table). Clients address
 * those rows by unit, so all three collections are translated through an index
 * of the item's live conversion rows before they are matched, compared and
 * saved.
 */
type UnitConversionIndex = {
  /** iuc_unit_id -> iuc_id, over the item's non-deleted conversion rows. */
  iucIdByUnitId: Map<string, string>;
  /** Those rows' iuc_ids, so an already-resolved id passes through untouched. */
  iucIds: Set<string>;
};

/*
 * Natural keys used to match payload rows against the item's existing rows:
 *   ean_codes        → ean_code                      (unique per item)
 *   unit_conversions → iuc_unit_id                   (one conversion row per unit)
 *   prices           → ipm_company_id + ipm_branch_id + ipm_uc_unit_id +
 *                      ipm_bucket_mrp + ipm_bucket_sp — ex_ipm_overlap's own
 *                      key, NULLs matching NULLs. The two bucket columns are
 *                      DERIVED here from the item's stock track policy
 *                      (PriceBucketService), never read from the payload, so
 *                      an MRP-tracked item holds one row per unit × MRP and an
 *                      untracked one a single row per unit, whatever MRPs the
 *                      grid typed (plan-nestjs-one-price-table.md §4).
 *                      ipm_godown_id is NOT part of it: it is an attribute of
 *                      the row. The key used to be unit + godown, so a NEW row
 *                      for branch Y with branch X's unit and godown took X's
 *                      ipm_id and was saved over X's price (notes 67 B1).
 *   reorders         → ir_branch_id + ir_unit_id + ir_godown_id (nulls = the
 *                      global rule); the branch is in the key for the same
 *                      reason, since two branches' godown-less rules for one
 *                      unit are two rows.
 * An omitted company / branch / godown on a payload row reads as null — what a
 * create would store — and two payload rows with one key are refused.
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
    private readonly priceBucketService: PriceBucketService,
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
   * that table for the item.
   *
   * Unit conversions are synced FIRST, because EAN codes and reorders store an
   * iuc_id from that table in their unit column and are resolved against the
   * post-sync rows. Everything runs on the caller's transaction, so a payload
   * unit with no conversion row aborts the entire save (item included).
   *
   * All writes go through the existing child services, so their validation,
   * unique-constraint handling and audit logging apply unchanged.
   *
   * @param itemId Parent item id, injected into every child row.
   * @param dto    Composite payload whose child arrays drive the sync.
   * @param tx     The composite save's transaction; all reads and writes use it.
   * @returns The post-sync non-deleted rows of every provided collection.
   */
  async syncChildren(
    itemId: string,
    dto: SaveItemCompositeDto,
    tx: Prisma.TransactionClient,
  ): Promise<ItemChildrenSyncResult> {
    const unit_conversions = await this.syncUnitConversions(itemId, dto.unit_conversions, tx);
    const conversions = await this.indexUnitConversions(itemId, dto, unit_conversions, tx);
    const prices = await this.syncPrices(itemId, dto.prices, conversions, tx);
    const ean_codes = await this.syncEanCodes(itemId, dto.ean_codes, conversions, tx);
    const reorders = await this.syncReorders(itemId, dto.reorders, conversions, tx);
    return { unit_conversions, prices, ean_codes, reorders };
  }

  /**
   * Indexes the item's conversion rows AFTER the conversion sync, so rows created
   * in this transaction are included and soft-deleted ones are excluded. Costs one
   * query per save — and none at all when the sync above already re-fetched the
   * very same rows, or when neither collection needs the index.
   */
  private async indexUnitConversions(
    itemId: string,
    dto: SaveItemCompositeDto,
    syncedUnitConversions: ItemUnitConversionPayload[],
    tx: Prisma.TransactionClient,
  ): Promise<UnitConversionIndex> {
    const needed =
      dto.prices !== undefined || dto.ean_codes !== undefined || dto.reorders !== undefined;
    const rows = !needed
      ? []
      : dto.unit_conversions !== undefined
        ? syncedUnitConversions
        : await this.itemUnitConversionService.findByItemId(itemId, tx);
    return {
      iucIdByUnitId: new Map(rows.map((row) => [row.iuc_unit_id, row.iuc_id])),
      iucIds: new Set(rows.map((row) => row.iuc_id)),
    };
  }

  /**
   * Maps a payload row's unit to this item's conversion row id. A value that is
   * already one of the item's iuc_ids passes through unchanged, so a getComposite
   * response can be echoed straight back on update; a unit_id and an iuc_id are
   * drawn from different tables, so no value can be mistaken for the other.
   */
  private resolveUnitConversionId(
    unitId: string,
    field: string,
    conversions: UnitConversionIndex,
  ): string {
    const iucId = conversions.iucIdByUnitId.get(unitId);
    if (iucId) {
      return iucId;
    }
    if (conversions.iucIds.has(unitId)) {
      return unitId;
    }
    throwInventoryBadRequest<InventoryErrorDetail>(
      'Unit not found in unit conversion for this item',
      [{ field, message: `Unit ${unitId} has no unit conversion row for this item` }],
    );
  }

  /** Sync item_unit_conversion rows; natural key: iuc_unit_id. */
  private async syncUnitConversions(
    itemId: string,
    children: CompositeItemUnitConversionDto[] | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionPayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemUnitConversionService.findByItemId(itemId, tx);
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
    const staleIds = existing.filter((row) => !claimedIds.has(row.iuc_id)).map((row) => row.iuc_id);
    if (staleIds.length > 0) {
      await this.itemUnitConversionService.toggleDelete(staleIds, tx);
    }
    if (toSave.length > 0) {
      await this.itemUnitConversionService.save(toSave, tx);
    }
    return this.itemUnitConversionService.findByItemId(itemId, tx);
  }

  /**
   * Sync item_price_master rows; natural key: (ipm_company_id, ipm_branch_id,
   * ipm_uc_unit_id, ipm_bucket_mrp, ipm_bucket_sp) — ex_ipm_overlap's.
   * ipm_uc_unit_id stores an iuc_id, but the composite payload may name either
   * that or the unit behind it, so each row is resolved before it is matched,
   * compared and saved — exactly like the EAN and reorder collections below.
   *
   * THE BUCKET IS DERIVED, ON BOTH SIDES, UNDER THE POLICY IN FORCE NOW. The
   * payload rows' keys come from what each row will hold; the stored rows'
   * keys are re-derived rather than read, because this save may be the one
   * that changed the item's preset or group — a stored row keyed under the old
   * policy must still be matched by the row the grid sent for it. Two payload
   * rows with one key are refused, naming both: under an untracked policy two
   * MRPs for one unit are one price, and which of them survives is the
   * operator's choice, not this service's. Stored rows the payload no longer
   * claims are soft-deleted as before, and ItemsMasterService.saveComposite
   * re-keys whatever is left (PriceBucketService.rekeyItem).
   */
  private async syncPrices(
    itemId: string,
    children: CompositeItemPriceDto[] | undefined,
    conversions: UnitConversionIndex,
    tx: Prisma.TransactionClient,
  ): Promise<ItemPricePayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemsPriceMasterService.findByItemId(itemId, tx);
    const existingById = new Map(existing.map((row) => [row.ipm_id, row]));

    const resolvedRows = children.map((child) => ({
      ...child,
      ipm_uc_unit_id: this.resolveUnitConversionId(
        child.ipm_uc_unit_id,
        'ipm_uc_unit_id',
        conversions,
      ),
    }));
    const [payloadKeys, existingKeys] = await Promise.all([
      this.priceBucketService.deriveBuckets(
        tx,
        itemId,
        resolvedRows.map((row) =>
          this.payloadBucketSource(row, row.ipm_id ? existingById.get(row.ipm_id) : undefined),
        ),
      ),
      this.priceBucketService.deriveBuckets(
        tx,
        itemId,
        existing.map((row) => this.payloadBucketSource(row, undefined)),
      ),
    ]);
    const priceKey = (
      row: {
        ipm_company_id?: string | null;
        ipm_branch_id?: string | null;
        ipm_uc_unit_id: string;
      },
      bucket: BucketKey,
    ) =>
      this.naturalKey(
        row.ipm_company_id,
        row.ipm_branch_id,
        row.ipm_uc_unit_id,
        bucket.mrp === null ? null : String(bucket.mrp),
        bucket.salePrice === null ? null : String(bucket.salePrice),
      );
    // First stored row per key wins the match; any other row that now shares
    // its key is unclaimed and soft-deleted below, which is what the grid
    // asked for when it sent one row where there used to be two.
    const existingByKey = new Map<string, ItemPricePayload>();
    existing.forEach((row, index) => {
      const key = priceKey(row, existingKeys[index]);
      if (!existingByKey.has(key)) {
        existingByKey.set(key, row);
      }
    });

    this.refuseDuplicateKeys(
      resolvedRows.map((row, index) => priceKey(row, payloadKeys[index])),
      'prices',
      'one price: the same company, branch, unit and MRP / sale-price bucket. ' +
        'An item that does not track MRP holds one price per unit, whatever MRP each row shows ' +
        '(ipm_godown_id is an attribute, not part of the key)',
    );
    const toSave: SaveItemPriceDto[] = [];
    const claimedIds = new Set<string>();
    resolvedRows.forEach((resolved, index) => {
      const match = resolved.ipm_id
        ? existing.find((row) => row.ipm_id === resolved.ipm_id)
        : existingByKey.get(priceKey(resolved, payloadKeys[index]));
      if (match) {
        claimedIds.add(match.ipm_id);
        if (!this.rowChanged(resolved, match, IPM_IGNORED_FIELDS)) {
          return;
        }
      }
      toSave.push({ ...resolved, ipm_item_id: itemId, ipm_id: resolved.ipm_id ?? match?.ipm_id });
    });

    const staleIds = existing.filter((row) => !claimedIds.has(row.ipm_id)).map((row) => row.ipm_id);
    if (staleIds.length > 0) {
      await this.itemsPriceMasterService.toggleDelete(staleIds, tx);
    }
    if (toSave.length > 0) {
      await this.itemsPriceMasterService.save(toSave, tx);
    }
    return this.itemsPriceMasterService.findByItemId(itemId, tx);
  }

  /**
   * What a price row will hold, for its bucket: the payload's value where it
   * sent one, else the stored row's (an update by id), else what a create
   * stores — 0 and NULL.
   */
  private payloadBucketSource(
    row: Partial<SaveItemPriceDto> | ItemPricePayload,
    stored: ItemPricePayload | undefined,
  ): PriceBucketSource {
    const pick = (field: keyof ItemPricePayload & keyof SaveItemPriceDto): number => {
      const sent = (row as Record<string, unknown>)[field];
      if (typeof sent === 'number') return sent;
      const kept = stored?.[field];
      return typeof kept === 'number' ? kept : 0;
    };
    const scope = (field: 'ipm_company_id' | 'ipm_branch_id'): string | null => {
      const sent = (row as Record<string, unknown>)[field];
      if (sent !== undefined) return (sent as string | null) ?? null;
      return stored?.[field] ?? null;
    };
    return toBucketSource({
      ipmCompanyId: scope('ipm_company_id'),
      ipmBranchId: scope('ipm_branch_id'),
      ipmMaxPrice: pick('ipm_max_price'),
      ipmSalesPriceA: pick('ipm_sales_price_a'),
      ipmSalesPriceB: pick('ipm_sales_price_b'),
      ipmSalesPriceC: pick('ipm_sales_price_c'),
      ipmSalesPriceD: pick('ipm_sales_price_d'),
    });
  }

  /**
   * Sync item_ean_codes rows; natural key: ean_code. The payload's ean_unit_id
   * names a unit, the stored column holds an iuc_id, so each row is resolved
   * before it is matched, compared and saved.
   */
  private async syncEanCodes(
    itemId: string,
    children: CompositeItemEanCodeDto[] | undefined,
    conversions: UnitConversionIndex,
    tx: Prisma.TransactionClient,
  ): Promise<ItemEanCodePayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemsEanCodeMasterService.findByItemId(itemId, tx);
    const existingByKey = new Map(existing.map((row) => [row.ean_code, row]));

    const toSave: SaveItemEanCodeDto[] = [];
    const claimedIds = new Set<string>();
    for (const child of children) {
      const resolved = {
        ...child,
        ean_unit_id: this.resolveUnitConversionId(child.ean_unit_id, 'ean_unit_id', conversions),
      };
      const match = resolved.ean_id
        ? existing.find((row) => row.ean_id === resolved.ean_id)
        : existingByKey.get(resolved.ean_code);
      if (match) {
        claimedIds.add(match.ean_id);
        if (!this.rowChanged(resolved, match, EAN_IGNORED_FIELDS)) {
          continue;
        }
      }
      toSave.push({ ...resolved, ean_item_id: itemId, ean_id: resolved.ean_id ?? match?.ean_id });
    }

    // Soft-delete first: ean_code is globally unique and only one default
    // barcode is allowed per scope, so removed rows must release both first.
    const staleIds = existing.filter((row) => !claimedIds.has(row.ean_id)).map((row) => row.ean_id);
    if (staleIds.length > 0) {
      await this.itemsEanCodeMasterService.toggleDelete(staleIds, tx);
    }
    if (toSave.length > 0) {
      await this.itemsEanCodeMasterService.save(toSave, tx);
    }
    return this.itemsEanCodeMasterService.findByItemId(itemId, tx);
  }

  /**
   * Sync item_reorders rows; natural key: (ir_branch_id, ir_unit_id, ir_godown_id). A non-null
   * ir_unit_id is resolved to an iuc_id like the EAN rows above; null keeps its
   * meaning of "no unit scoping" and is left alone.
   */
  private async syncReorders(
    itemId: string,
    children: CompositeItemReorderDto[] | undefined,
    conversions: UnitConversionIndex,
    tx: Prisma.TransactionClient,
  ): Promise<ItemReorderPayload[]> {
    if (children === undefined) {
      return [];
    }
    const existing = await this.itemsReorderMasterService.findByItemId(itemId, tx);
    const reorderKey = (row: {
      ir_branch_id?: string | null;
      ir_unit_id?: string | null;
      ir_godown_id?: string | null;
    }) => this.naturalKey(row.ir_branch_id, row.ir_unit_id, row.ir_godown_id);
    const existingByKey = new Map(existing.map((row) => [reorderKey(row), row]));

    const resolvedRows = children.map((child) => ({
      ...child,
      ir_unit_id:
        child.ir_unit_id == null
          ? child.ir_unit_id
          : this.resolveUnitConversionId(child.ir_unit_id, 'ir_unit_id', conversions),
    }));
    this.refuseDuplicateKeys(
      resolvedRows.map(reorderKey),
      'reorders',
      'two reorder rows for the same branch, unit and godown',
    );
    const toSave: SaveItemReorderDto[] = [];
    const claimedIds = new Set<string>();
    for (const resolved of resolvedRows) {
      const match = resolved.ir_id
        ? existing.find((row) => row.ir_id === resolved.ir_id)
        : existingByKey.get(reorderKey(resolved));
      if (match) {
        claimedIds.add(match.ir_id);
        if (!this.rowChanged(resolved, match, IR_IGNORED_FIELDS)) {
          continue;
        }
      }
      toSave.push({ ...resolved, ir_item_id: itemId, ir_id: resolved.ir_id ?? match?.ir_id });
    }

    const staleIds = existing.filter((row) => !claimedIds.has(row.ir_id)).map((row) => row.ir_id);
    if (staleIds.length > 0) {
      await this.itemsReorderMasterService.toggleDelete(staleIds, tx);
    }
    if (toSave.length > 0) {
      await this.itemsReorderMasterService.save(toSave, tx);
    }
    return this.itemsReorderMasterService.findByItemId(itemId, tx);
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
   * Builds a composite map key for a multi-column natural key. UUIDs never
   * contain "::", so the delimiter cannot produce colliding keys; null and
   * undefined both collapse to '' — an omitted scope column is the null a
   * create would store.
   */
  private naturalKey(...parts: (string | null | undefined)[]): string {
    return parts.map((part) => part ?? '').join('::');
  }

  /**
   * Two payload rows with one natural key would both claim the same stored
   * row (the second silently overwriting the first) or, as creates, trip the
   * table's unique index. Refused up front, naming the rows.
   */
  private refuseDuplicateKeys(keys: string[], field: string, what: string): void {
    const firstAt = new Map<string, number>();
    keys.forEach((key, index) => {
      const first = firstAt.get(key);
      if (first !== undefined) {
        throwInventoryBadRequest<InventoryErrorDetail>('Duplicate rows in one save', [
          {
            field: `${field}.${index}`,
            message: `${field}[${first}] and ${field}[${index}] are ${what}.`,
          },
        ]);
      }
      firstAt.set(key, index);
    });
  }
}
