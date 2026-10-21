import { Injectable } from '@nestjs/common';
import { ItemMaster, Prisma } from '@prisma/client';
import { SaveItemDto } from './dto/save-item.dto';
import { SaveItemCompositeDto } from './dto/save-item-composite.dto';
import { BulkLoadItemPayload, ItemErrorDetail, ItemPayload } from './types/item-api.types';
import { ItemErrorCode } from './types/item-error-codes';
import { ItemCompositeDeleteResult, ItemCompositePayload } from './types/item-composite-api.types';
import { ItemUnitConversionService } from '../item-unit-conversion/item-unit-conversion.service';
import { ItemsPriceMasterService } from '../items-price-master/items-price-master.service';
import { ItemsEanCodeMasterService } from '../items-ean-code-master/items-ean-code-master.service';
import { ItemsReorderMasterService } from '../items-reorder-master/items-reorder-master.service';
import { ItemMasterUpdateService } from './item-master-update.service';
import { StockTrackPolicyService } from 'src/modules/stocks/stock-track-policy/stock-track-policy.service';
import { assertNoLiveReferences, type LiveReference } from '../utils/master-tree.helper';
import { PriceBucketService } from '../items-price-master/price-bucket.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { toNumber } from 'src/common/utils/module-service.utils';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isExclusionConstraintError,
  isForeignKeyConstraintError,
  isUniqueConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryConflict,
  throwInventoryNotFound,
  violatedConstraintOf,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const ITEM_TABLE_NAME = 'item master';
const ITEM_AUDIT_SCREEN_NAME = 'Item Master';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
// item_hsn_code is varchar(10); a group / category default HSN may be up to 20.
const ITEM_HSN_MAX_LENGTH = 10;
// A composite save writes the item plus four child collections (each row an
// insert/update alongside its audit-log row) in one transaction, so it needs
// more headroom than Prisma's 5s interactive-transaction default.
const COMPOSITE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
// The payload echoes the preset's name next to item_track_preset_id, so every
// path that builds one pulls that single column over the relation.
const TRACK_PRESET_INCLUDE = {
  trackPreset: { select: { sptName: true } },
} satisfies Prisma.ItemMasterInclude;
/**
 * item_master's foreign keys, by constraint name, and the payload field each
 * one checks. A write that trips one is reported against THAT field: every
 * FK error used to be filed under item_group_id, so a bad tax id read as a
 * bad group (notes 50 #4).
 */
const ITEM_FOREIGN_KEYS: Readonly<
  Record<string, { field: string; what: string; code: ItemErrorCode }>
> = {
  item_master_item_group_id_fkey: {
    field: 'item_group_id',
    what: 'item group',
    code: ItemErrorCode.UNKNOWN_GROUP,
  },
  item_master_item_default_tax_id_fkey: {
    field: 'item_default_tax_id',
    what: 'tax rate (tax_rate_master)',
    code: ItemErrorCode.UNKNOWN_TAX_RATE,
  },
  item_master_item_base_unit_id_fkey: {
    field: 'item_base_unit_id',
    what: 'unit',
    code: ItemErrorCode.UNKNOWN_UNIT,
  },
  item_master_item_category_id_fkey: {
    field: 'item_category_id',
    what: 'item category',
    code: ItemErrorCode.UNKNOWN_CATEGORY,
  },
  item_master_item_company_id_fkey: {
    field: 'item_company_id',
    what: 'company',
    code: ItemErrorCode.UNKNOWN_COMPANY,
  },
  fk_item_track_preset: {
    field: 'item_track_preset_id',
    what: 'stock track preset',
    code: ItemErrorCode.UNKNOWN_TRACK_PRESET,
  },
};
/**
 * What keeps an item from being deleted: stock that still exists (notes 70
 * C4), and — notes 137 D3 — documents and schemes that are still going to use
 * it: an open sale order or quotation, a promotion or loyalty scheme that is
 * not closed. Past, finished documents do not block; a soft delete keeps them
 * readable. Another item's packing list is checked beside these (an array
 * column, see softDeleteComposite).
 */
const ITEM_DELETE_REFERENCES: readonly LiveReference[] = [
  {
    table: 'stock.stock_balance',
    column: 'sbl_item_id',
    live: 'sbl_is_deleted = false AND (sbl_on_hand_qty <> 0 OR sbl_transit_in_qty <> 0)',
    label: 'stock holdings with quantity on hand or in transit',
  },
  {
    table: 'sales.sale_order_item',
    column: 'soi_item_id',
    live:
      "soi_is_deleted = false AND soi_line_status IN ('PENDING', 'PARTIAL') AND EXISTS (" +
      'SELECT 1 FROM sales.sale_order o WHERE o.so_id = soi_order_id AND o.so_is_deleted = false ' +
      "AND o.so_status IN ('DRAFT', 'CONFIRMED', 'PARTIAL'))",
    label: 'open sale order lines',
  },
  {
    table: 'sales.sale_quotation_item',
    column: 'sqi_item_id',
    live:
      'sqi_is_deleted = false AND EXISTS (' +
      'SELECT 1 FROM sales.sale_quotation q WHERE q.sq_id = sqi_quote_id AND q.sq_is_deleted = false ' +
      "AND q.sq_status IN ('DRAFT', 'SENT', 'ACCEPTED'))",
    label: 'open quotation lines',
  },
  {
    table: 'sales.promotion_scheme_item',
    column: 'pri_item_id',
    live:
      'pri_is_deleted = false AND EXISTS (' +
      'SELECT 1 FROM sales.promotion_scheme p WHERE p.prm_id = pri_prm_id AND p.prm_is_deleted = false ' +
      "AND p.prm_status <> 'CLOSED')",
    label: 'promotion scheme items',
  },
  {
    table: 'sales.promotion_scheme_slab',
    column: 'prs_free_item_id',
    live:
      'prs_is_deleted = false AND EXISTS (' +
      'SELECT 1 FROM sales.promotion_scheme p WHERE p.prm_id = prs_prm_id AND p.prm_is_deleted = false ' +
      "AND p.prm_status <> 'CLOSED')",
    label: 'promotion free-item slabs',
  },
  {
    table: 'sales.loyalty_scheme_slab',
    column: 'lss_item_id',
    live:
      'lss_is_deleted = false AND EXISTS (' +
      'SELECT 1 FROM sales.loyalty_scheme l WHERE l.lsc_id = lss_lsc_id AND l.lsc_is_deleted = false ' +
      "AND l.lsc_status <> 'CLOSED')",
    label: 'loyalty scheme slabs',
  },
  {
    table: 'sales.loyalty_scheme_gift',
    column: 'lsg_item_id',
    live:
      'lsg_is_deleted = false AND EXISTS (' +
      'SELECT 1 FROM sales.loyalty_scheme l WHERE l.lsc_id = lsg_lsc_id AND l.lsc_is_deleted = false ' +
      "AND l.lsc_status <> 'CLOSED')",
    label: 'loyalty gifts',
  },
];
/** The item's unique keys (notes 137 B5 / B6), and the codes a clash answers with. */
type ItemUniqueField = 'item_name_en' | 'item_code' | 'item_sku' | 'item_default_barcode';
type ItemUniqueKeys = {
  companyId: string | null;
  name: string | null;
  code: string | null;
  sku: string | null;
  barcode: string | null;
};
const SAVE_CLASH_CODES: Readonly<Record<ItemUniqueField, ItemErrorCode>> = {
  item_name_en: ItemErrorCode.NAME_TAKEN,
  item_code: ItemErrorCode.CODE_TAKEN,
  item_sku: ItemErrorCode.SKU_TAKEN,
  item_default_barcode: ItemErrorCode.BARCODE_TAKEN,
};
const RESTORE_CLASH_CODES: Readonly<Record<ItemUniqueField, ItemErrorCode>> = {
  item_name_en: ItemErrorCode.RESTORE_NAME_TAKEN,
  item_code: ItemErrorCode.RESTORE_CODE_TAKEN,
  item_sku: ItemErrorCode.RESTORE_SKU_TAKEN,
  item_default_barcode: ItemErrorCode.BARCODE_TAKEN,
};
/** Namespace of the advisory locks the unique-key check takes (see assertUniqueKeys). */
const UNIQUE_LOCK_NAMESPACE = 'inventory.item_master.unique';
@Injectable()
export class ItemsMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly itemUnitConversionService: ItemUnitConversionService,
    private readonly itemsPriceMasterService: ItemsPriceMasterService,
    private readonly itemsEanCodeMasterService: ItemsEanCodeMasterService,
    private readonly itemsReorderMasterService: ItemsReorderMasterService,
    private readonly itemMasterUpdateService: ItemMasterUpdateService,
    private readonly stockTrackPolicyService: StockTrackPolicyService,
    private readonly priceBucketService: PriceBucketService,
  ) {}
  /**
   * @param tx When supplied, the write runs inside the caller's transaction
   * instead of opening its own (see saveComposite).
   */
  async save(saveItemDto: SaveItemDto, tx?: Prisma.TransactionClient): Promise<ItemPayload> {
    if (saveItemDto.item_id) {
      return (await this.updateItem(saveItemDto, tx)).payload;
    }
    return this.createItem(saveItemDto, tx);
  }
  /**
   * Saves an item together with its unit conversions, prices, EAN codes and
   * reorders in a single request. Each provided child collection is DIFF-SYNCED
   * against the item's existing rows by natural key: new rows are created,
   * matched rows are updated when a field differs, and existing rows absent
   * from the payload are soft-deleted (see ItemMasterUpdateService). Omitted
   * child arrays are left untouched. The parent item_id is always injected into
   * each child row.
   *
   * ATOMIC: the item and every child collection are written in ONE transaction,
   * in dependency order (unit-conversions -> prices -> EAN codes -> reorders).
   * Any failure — including an EAN/reorder row naming a unit the item has no
   * conversion row for — rolls the whole save back, item included.
   */
  async saveComposite(dto: SaveItemCompositeDto): Promise<ItemCompositePayload> {
    return this.prisma.$transaction(async (tx) => {
      const saved = dto.item_id
        ? await this.updateItem(dto, tx, { childrenFollow: true })
        : { payload: await this.createItem(dto, tx), before: null };
      const itemId = saved.payload.item_id;
      const children = await this.itemMasterUpdateService.syncChildren(itemId, dto, tx);
      // AFTER the price sync, not before: this save may both change the
      // tracking (preset, group) and remove the row that would otherwise
      // collide under it, and the payload is the final word on which rows
      // exist. Re-keying first would refuse a save whose end state is valid.
      if (await this.priceBucketService.rekeyItem(tx, itemId)) {
        children.prices = await this.itemsPriceMasterService.findByItemId(itemId, tx);
      }
      // Notes 137 C3, against the rows this save leaves: the payload may have
      // moved the price rows along with the item.
      if (saved.before) {
        await this.assertCompanyMove(tx, saved.before, saved.payload.item_company_id);
      }
      const item = await this.alignBaseUnit(tx, saved.payload, dto, children.unit_conversions);
      return { item, ...children };
    }, COMPOSITE_TRANSACTION_OPTIONS);
  }
  async getById(itemId: string): Promise<ItemPayload> {
    const record = await this.prisma.itemMaster.findFirst({
      where: {
        itemId,
        itemIsDeleted: false,
      },
      include: TRACK_PRESET_INCLUDE,
    });
    if (!record) {
      throwInventoryNotFound<ItemErrorDetail>(
        'Item not found',
        'item_id',
        `No active item found with id ${itemId}`,
        ItemErrorCode.NOT_FOUND,
      );
    }
    return this.toPayload(record);
  }
  /**
   * Fetches an item together with all of its non-deleted child collections
   * (unit conversions, prices, EAN codes and reorders) by item id. Throws
   * NotFound when the item does not exist or is deleted; child collections come
   * back as empty arrays when the item has none.
   */
  async getComposite(itemId: string): Promise<ItemCompositePayload> {
    const item = await this.getById(itemId);
    const [unit_conversions, prices, ean_codes, reorders] = await Promise.all([
      this.itemUnitConversionService.findByItemId(itemId),
      this.itemsPriceMasterService.findByItemId(itemId),
      this.itemsEanCodeMasterService.findByItemId(itemId),
      this.itemsReorderMasterService.findByItemId(itemId),
    ]);
    return this.resolveCompositeNames({ item, unit_conversions, prices, ean_codes, reorders });
  }
  /**
   * Enriches the composite payload with human-readable names for every
   * resolvable foreign-key id. Names are attached as flat sibling `*_name`
   * fields alongside the ids (matching the customer/supplier convention); the
   * ids are preserved. Reference tables are batch-loaded — one query per table
   * over the deduped id set — and resolved by id regardless of soft-delete, so a
   * name still shows even if the master was later deleted. Columns with no
   * master table (item_company_category_id, item_mfgr_id, item_barcode_sticker_id)
   * are not resolved. Every child row belongs to this item, so their
   * `*_item_name` echoes reuse the parent item name without an extra query.
   *
   * ipm_uc_unit_id, ean_unit_id and ir_unit_id store an iuc_id rather than a
   * unit_id, so each is resolved by hopping through the item's conversion rows
   * and the response rewrites the column to that underlying unit_id — callers
   * see a unit-master id, and update accepts either form back (see
   * ItemMasterUpdateService.resolveUnitConversionId). A row whose conversion
   * has since been soft-deleted cannot be resolved, so it keeps its stored
   * iuc_id and names to null.
   */
  private async resolveCompositeNames(
    composite: ItemCompositePayload,
  ): Promise<ItemCompositePayload> {
    const { item, unit_conversions, prices, ean_codes, reorders } = composite;
    const collect = (...ids: (string | null | undefined)[]): string[] =>
      Array.from(new Set(ids.filter((id): id is string => !!id)));
    const unitIdByConversionId = new Map(unit_conversions.map((r) => [r.iuc_id, r.iuc_unit_id]));
    const conversionUnitId = (iucId: string | null | undefined): string | null =>
      iucId ? (unitIdByConversionId.get(iucId) ?? null) : null;
    const companyIds = collect(item.item_company_id, ...prices.map((r) => r.ipm_company_id));
    const branchIds = collect(
      item.item_branch_id,
      ...prices.map((r) => r.ipm_branch_id),
      ...reorders.map((r) => r.ir_branch_id),
    );
    const unitIds = collect(
      item.item_base_unit_id,
      ...unit_conversions.flatMap((r) => [r.iuc_unit_id, r.iuc_base_unit_id]),
      ...prices.map((r) => conversionUnitId(r.ipm_uc_unit_id)),
      ...ean_codes.map((r) => conversionUnitId(r.ean_unit_id)),
      ...reorders.map((r) => conversionUnitId(r.ir_unit_id)),
    );
    const godownIds = collect(
      ...prices.map((r) => r.ipm_godown_id),
      ...reorders.map((r) => r.ir_godown_id),
    );
    const groupIds = collect(item.item_group_id);
    const categoryIds = collect(item.item_category_id);
    const brandIds = collect(item.item_brand_id);
    const sectionIds = collect(item.item_section_id);
    const supplierIds = collect(item.item_supplier_id);
    const custGroupIds = collect(item.item_cust_group);
    const taxIds = collect(item.item_default_tax_id);
    const [
      companies,
      branches,
      units,
      godowns,
      groups,
      categories,
      brands,
      sections,
      suppliers,
      custGroups,
      taxes,
    ] = await Promise.all([
      companyIds.length
        ? this.prisma.company.findMany({
            where: { compId: { in: companyIds } },
            select: { compId: true, compName: true },
          })
        : [],
      branchIds.length
        ? this.prisma.branchMaster.findMany({
            where: { brId: { in: branchIds } },
            select: { brId: true, brName: true },
          })
        : [],
      unitIds.length
        ? this.prisma.unit.findMany({
            where: { unit_id: { in: unitIds } },
            select: { unit_id: true, unit_name: true },
          })
        : [],
      godownIds.length
        ? this.prisma.godownLocation.findMany({
            where: { gdlId: { in: godownIds } },
            select: { gdlId: true, gdlName: true },
          })
        : [],
      groupIds.length
        ? this.prisma.itemGroupMaster.findMany({
            where: { itgId: { in: groupIds } },
            select: { itgId: true, itgName: true },
          })
        : [],
      categoryIds.length
        ? this.prisma.categoryMaster.findMany({
            where: { categoryId: { in: categoryIds } },
            select: { categoryId: true, categoryName: true },
          })
        : [],
      brandIds.length
        ? this.prisma.itemBrandMaster.findMany({
            where: { brand_id: { in: brandIds } },
            select: { brand_id: true, brand_name: true },
          })
        : [],
      sectionIds.length
        ? this.prisma.itemSectionMaster.findMany({
            where: { secId: { in: sectionIds } },
            select: { secId: true, secName: true },
          })
        : [],
      supplierIds.length
        ? this.prisma.supplier.findMany({
            where: { supId: { in: supplierIds } },
            select: { supId: true, supName: true },
          })
        : [],
      custGroupIds.length
        ? this.prisma.custGroup.findMany({
            where: { cgrId: { in: custGroupIds } },
            select: { cgrId: true, cgrName: true },
          })
        : [],
      // item_default_tax_id is a FK to tax_rate_master (20260912110000); the
      // retired item_tax_master holds none of these ids, which is why the name
      // always came back null (notes 67 B2).
      taxIds.length
        ? this.prisma.taxRateMaster.findMany({
            where: { taxId: { in: taxIds } },
            select: { taxId: true, taxName: true },
          })
        : [],
    ]);
    const companyName = new Map(companies.map((r) => [r.compId, r.compName]));
    const branchName = new Map(branches.map((r) => [r.brId, r.brName]));
    const unitName = new Map(units.map((r) => [r.unit_id, r.unit_name]));
    const godownName = new Map(godowns.map((r) => [r.gdlId, r.gdlName]));
    const groupName = new Map(groups.map((r) => [r.itgId, r.itgName]));
    const categoryName = new Map(categories.map((r) => [r.categoryId, r.categoryName]));
    const brandName = new Map(brands.map((r) => [r.brand_id, r.brand_name]));
    const sectionName = new Map(sections.map((r) => [r.secId, r.secName]));
    const supplierName = new Map(suppliers.map((r) => [r.supId, r.supName]));
    const custGroupName = new Map(custGroups.map((r) => [r.cgrId, r.cgrName]));
    const taxName = new Map(taxes.map((r) => [r.taxId, r.taxName]));
    const nameOf = <T>(map: Map<string, T>, id: string | null | undefined): T | null =>
      id ? (map.get(id) ?? null) : null;
    return {
      item: {
        ...item,
        item_company_name: nameOf(companyName, item.item_company_id),
        item_branch_name: nameOf(branchName, item.item_branch_id),
        item_group_name: nameOf(groupName, item.item_group_id),
        item_category_name: nameOf(categoryName, item.item_category_id),
        item_brand_name: nameOf(brandName, item.item_brand_id),
        item_section_name: nameOf(sectionName, item.item_section_id),
        item_supplier_name: nameOf(supplierName, item.item_supplier_id),
        item_cust_group_name: nameOf(custGroupName, item.item_cust_group),
        item_base_unit_name: nameOf(unitName, item.item_base_unit_id),
        item_default_tax_name: nameOf(taxName, item.item_default_tax_id),
      },
      unit_conversions: unit_conversions.map((r) => ({
        ...r,
        iuc_unit_name: nameOf(unitName, r.iuc_unit_id),
        iuc_base_unit_name: nameOf(unitName, r.iuc_base_unit_id),
      })),
      prices: prices.map((r) => {
        const unitId = conversionUnitId(r.ipm_uc_unit_id);
        return {
          ...r,
          ipm_company_name: nameOf(companyName, r.ipm_company_id),
          ipm_branch_name: nameOf(branchName, r.ipm_branch_id),
          ipm_uc_unit_id: unitId ?? r.ipm_uc_unit_id,
          ipm_unit_name: nameOf(unitName, unitId),
          ipm_godown_name: nameOf(godownName, r.ipm_godown_id),
        };
      }),
      ean_codes: ean_codes.map((r) => {
        const unitId = conversionUnitId(r.ean_unit_id);
        return {
          ...r,
          ean_unit_id: unitId ?? r.ean_unit_id,
          ean_unit_name: nameOf(unitName, unitId),
        };
      }),
      reorders: reorders.map((r) => {
        const unitId = conversionUnitId(r.ir_unit_id);
        return {
          ...r,
          ir_branch_name: nameOf(branchName, r.ir_branch_id),
          ir_unit_id: unitId ?? r.ir_unit_id,
          ir_unit_name: nameOf(unitName, unitId),
          ir_godown_name: nameOf(godownName, r.ir_godown_id),
        };
      }),
    };
  }
  async listForBulkLoad(params: {
    itemCompanyId?: string;
    itemBranchId?: string;
    godownId?: string;
    itemGroupId?: string;
    itemBrandId?: string;
    itemSectionId?: string;
    itemCategoryId?: string;
    limit?: number;
    uiTableId?: string;
    uiColumnId?: string;
  }): Promise<BulkLoadItemPayload[]> {
    // A blank company or branch on an item means SHARED (notes 73): a
    // company's load takes its own items plus the shared ones, a branch's its
    // own plus the company-wide ones — never another company's or branch's.
    // Until notes 73 both were strict, so a branch-scoped load left out every
    // company-wide item and a company-scoped one every shared item.
    const scope: Prisma.ItemMasterWhereInput[] = [];
    if (params.itemCompanyId) {
      scope.push({ OR: [{ itemCompanyId: params.itemCompanyId }, { itemCompanyId: null }] });
    }
    if (params.itemBranchId) {
      scope.push({ OR: [{ itemBranchId: params.itemBranchId }, { itemBranchId: null }] });
    }
    const where: Prisma.ItemMasterWhereInput = {
      itemIsDeleted: false,
      itemIsActive: true,
      ...(scope.length ? { AND: scope } : {}),
      ...(params.itemGroupId ? { itemGroupId: params.itemGroupId } : {}),
      ...(params.itemBrandId ? { itemBrandId: params.itemBrandId } : {}),
      ...(params.itemSectionId ? { itemSectionId: params.itemSectionId } : {}),
      ...(params.itemCategoryId ? { itemCategoryId: params.itemCategoryId } : {}),
    };
    const items = await this.prisma.itemMaster.findMany({
      where,
      include: {
        prices: {
          // Headline rows only: the bulk load shows one price per item, and
          // an MRP bucket row is not it (plan-nestjs-one-price-table.md).
          where: { ipmIsDeleted: false, ipmBucketMrp: null, ipmBucketSp: null },
          orderBy: [
            { itemUnitConversion: { iucIsDefaultUnit: 'desc' } },
            { ipmSlNo: 'asc' },
            { itemUnitConversion: { iucUnitSlno: 'asc' } },
            { ipmId: 'asc' },
          ],
          // ipm_uc_unit_id is a FK to item_unit_conversion, so the unit itself
          // and the default-unit flag are one hop further out.
          include: { itemUnitConversion: { include: { unit: true } }, godown: true },
        },
      },
      orderBy: { itemNameEn: 'asc' },
      take: params.limit ?? 500,
    });
    if (items.length === 0) return [];
    const taxIds = Array.from(
      new Set(items.map((i) => i.itemDefaultTaxId).filter((id): id is string => id !== null)),
    );
    // tax_rate_master, the table item_default_tax_id points at — see
    // resolveCompositeNames. One rate serves sale and purchase alike.
    const taxRecords =
      taxIds.length > 0
        ? await this.prisma.taxRateMaster.findMany({
            where: { taxId: { in: taxIds }, taxIsDeleted: false },
          })
        : [];
    const taxById = new Map(taxRecords.map((t) => [t.taxId, t]));
    return items.map((item): BulkLoadItemPayload => {
      const p =
        (params.godownId
          ? item.prices.find((r) => r.ipmGodownId === params.godownId)
          : undefined) ??
        item.prices.find((r) => r.itemUnitConversion.iucIsDefaultUnit) ??
        item.prices[0] ??
        null;
      const tax = item.itemDefaultTaxId ? (taxById.get(item.itemDefaultTaxId) ?? null) : null;
      // A hint read off the item's OWN flags, not the resolved stock track
      // policy: since notes 68 an item with no preset follows its group's
      // policy, and for such an item the two can disagree.
      const trackingType =
        item.itemBatchConfig === 1
          ? 'MRP'
          : item.itemBatchConfig === 2 || item.itemIsBatchBased || item.itemIsExpiryItem
            ? 'BATCH'
            : 'NONE';
      return {
        item_id: item.itemId,
        item_name: item.itemNameEn,
        item_code: item.itemCode,
        item_default_barcode: item.itemDefaultBarcode,
        item_base_unit_id: item.itemBaseUnitId,
        item_batch_config: item.itemBatchConfig,
        price_master_id: p?.ipmId ?? null,
        // Consumers key stock and lookups off a real unit_id, so publish the
        // unit behind the price row's conversion, not the iuc_id it stores.
        unit_id: p?.itemUnitConversion.iucUnitId ?? item.itemBaseUnitId ?? null,
        unit_name: p?.itemUnitConversion.unit.unit_name ?? null,
        base_unit_id: p?.itemUnitConversion.iucBaseUnitId ?? item.itemBaseUnitId ?? null,
        godown_id: p?.ipmGodownId ?? null,
        godown_name: p?.godown?.gdlName ?? null,
        to_base_factor: toNumber(p?.itemUnitConversion.iucToBaseFactor ?? 0) || 1,
        cost_price: toNumber(p?.ipmCostPrice ?? 0),
        cost_wot: toNumber(p?.ipmCostWot ?? 0),
        mrp: toNumber(p?.ipmMaxPrice ?? 0),
        min_price: toNumber(p?.ipmMinPrice ?? 0),
        sales_price_a: toNumber(p?.ipmSalesPriceA ?? 0),
        sales_price_b: toNumber(p?.ipmSalesPriceB ?? 0),
        sales_price_c: toNumber(p?.ipmSalesPriceC ?? 0),
        sales_price_d: toNumber(p?.ipmSalesPriceD ?? 0),
        price_a_wot: toNumber(p?.ipmPriceAWot ?? 0),
        price_b_wot: toNumber(p?.ipmPriceBWot ?? 0),
        price_c_wot: toNumber(p?.ipmPriceCWot ?? 0),
        price_d_wot: toNumber(p?.ipmPriceDWot ?? 0),
        price_a_markup: toNumber(p?.ipmPriceAMarkupPerc ?? 0),
        price_b_markup: toNumber(p?.ipmPriceBMarkupPerc ?? 0),
        price_c_markup: toNumber(p?.ipmPriceCMarkupPerc ?? 0),
        price_d_markup: toNumber(p?.ipmPriceDMarkupPerc ?? 0),
        profit_type: p?.ipmProfitType ?? null,
        round_off: toNumber(p?.ipmRoundOff ?? 0),
        tax_id: item.itemDefaultTaxId ?? null,
        tax_name: tax?.taxName ?? null,
        tax_perc: toNumber(tax?.taxRatePerc ?? 0),
        // tax_cess_basis: NONE | PERCENT | PER_UNIT | BOTH.
        cess_type: tax?.taxCessBasis ?? 'NONE',
        cess_perc: toNumber(tax?.taxCessPerc ?? 0),
        cess_per_unit: toNumber(tax?.taxCessPerUnit ?? 0),
        tracking_type: trackingType,
      };
    });
  }
  /**
   * Soft-deletes an item and, in the SAME transaction, every live child row
   * (unit conversions, prices, EAN codes, reorders) and its derived stock track
   * policy. An item that is already deleted is a 409, not a restore: this used
   * to be a toggle, so a second DELETE brought the item back (notes 50 #5).
   *
   * The item's itemModifiedOn becomes the deletion instant and every child is
   * stamped at or after it in this transaction — restoreComposite reads that
   * instant to tell the rows deleted WITH the item from rows an earlier save
   * had removed on purpose.
   */
  async softDeleteComposite(itemId: string): Promise<ItemCompositeDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findItemForDeleteState(tx, itemId);
      if (existing.itemIsDeleted) {
        throwInventoryConflict<ItemErrorDetail>('Item is already deleted', [
          {
            field: 'item_id',
            code: ItemErrorCode.ALREADY_DELETED,
            message: `${existing.itemNameEn} is already deleted. POST /items/restore brings it back.`,
          },
        ]);
      }
      // Notes 70 C4 — an item with stock on hand (or on its way to a branch)
      // is not deleted: it would vanish from every picker while the holding
      // stays valued and unsellable. Past transactions do not block — a soft
      // delete keeps them readable — only stock that still exists, and (notes
      // 137 D3) open documents, live schemes and other items' packing lists.
      await assertNoLiveReferences(tx, ITEM_DELETE_REFERENCES, itemId, {
        label: 'item',
        idField: 'item_id',
        inUseCode: ItemErrorCode.IN_USE,
      });
      const packers = await tx.itemMaster.findMany({
        where: { itemIsDeleted: false, itemPackingItemIds: { has: itemId } },
        select: { itemNameEn: true },
        take: 5,
      });
      if (packers.length) {
        throwInventoryConflict<ItemErrorDetail>('This item is still in use', [
          {
            field: 'item_id',
            code: ItemErrorCode.IN_USE,
            message:
              `Packed into ${packers.map((row) => row.itemNameEn).join(', ')}. ` +
              'Take it out of their packing lists first.',
          },
        ]);
      }
      const item = await this.setItemDeleted(tx, existing, true);
      const [unitConversionIds, priceIds, eanCodeIds, reorderIds] = await Promise.all([
        tx.itemUnitConversion
          .findMany({ where: { iucItemId: itemId, iucIsDeleted: false }, select: { iucId: true } })
          .then((rows) => rows.map((row) => row.iucId)),
        tx.itemPriceMaster
          .findMany({ where: { ipmItemId: itemId, ipmIsDeleted: false }, select: { ipmId: true } })
          .then((rows) => rows.map((row) => row.ipmId)),
        tx.itemEanCode
          .findMany({ where: { eanItemId: itemId, eanIsDeleted: false }, select: { eanId: true } })
          .then((rows) => rows.map((row) => row.eanId)),
        tx.itemReorder
          .findMany({ where: { irItemId: itemId, irIsDeleted: false }, select: { irId: true } })
          .then((rows) => rows.map((row) => row.irId)),
      ]);
      const children = await this.toggleChildren(tx, {
        unitConversionIds,
        priceIds,
        eanCodeIds,
        reorderIds,
      });
      await this.stockTrackPolicyService.retireForItem(itemId, tx);
      return { item, ...children };
    }, COMPOSITE_TRANSACTION_OPTIONS);
  }
  /**
   * Restores a soft-deleted item and ONLY the child rows deleted with it: those
   * soft-deleted at or after the item's deletion instant (its itemModifiedOn,
   * which nothing can move while the item is deleted). Rows an earlier save
   * removed — an old base unit, a replaced EAN — stay deleted; the old toggle
   * brought every one of them back (notes 67 B4). The derived stock track
   * policy is re-derived. One transaction: a restored name or EAN code that
   * another live item has taken since is a 409 and nothing is restored.
   */
  async restoreComposite(itemId: string): Promise<ItemCompositeDeleteResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.findItemForDeleteState(tx, itemId);
        if (!existing.itemIsDeleted) {
          throwInventoryConflict<ItemErrorDetail>('Item is not deleted', [
            {
              field: 'item_id',
              code: ItemErrorCode.NOT_DELETED,
              message: `${existing.itemNameEn} is not deleted; there is nothing to restore.`,
            },
          ]);
        }
        // Notes 137 B6 — the shared-vs-company half of the unique keys is not
        // in any index, so a restore checks it the way a save does.
        await this.assertUniqueKeys(
          tx,
          existing.itemId,
          {
            companyId: existing.itemCompanyId,
            name: existing.itemNameEn,
            code: existing.itemCode,
            sku: existing.itemSku,
            barcode: existing.itemDefaultBarcode,
          },
          RESTORE_CLASH_CODES,
        );
        const deletedOn = existing.itemModifiedOn;
        const [unitConversionIds, priceIds, eanCodeIds, reorderIds] = await Promise.all([
          tx.itemUnitConversion
            .findMany({
              where: { iucItemId: itemId, iucIsDeleted: true, iucUpdatedOn: { gte: deletedOn } },
              select: { iucId: true },
            })
            .then((rows) => rows.map((row) => row.iucId)),
          tx.itemPriceMaster
            .findMany({
              where: { ipmItemId: itemId, ipmIsDeleted: true, ipmUpdatedOn: { gte: deletedOn } },
              select: { ipmId: true },
            })
            .then((rows) => rows.map((row) => row.ipmId)),
          tx.itemEanCode
            .findMany({
              where: { eanItemId: itemId, eanIsDeleted: true, eanModifiedOn: { gte: deletedOn } },
              select: { eanId: true },
            })
            .then((rows) => rows.map((row) => row.eanId)),
          tx.itemReorder
            .findMany({
              where: { irItemId: itemId, irIsDeleted: true, irModifiedOn: { gte: deletedOn } },
              select: { irId: true },
            })
            .then((rows) => rows.map((row) => row.irId)),
        ]);
        const item = await this.setItemDeleted(tx, existing, false);
        const children = await this.toggleChildren(tx, {
          unitConversionIds,
          priceIds,
          eanCodeIds,
          reorderIds,
        });
        const restored = await tx.itemMaster.findFirstOrThrow({ where: { itemId } });
        await this.stockTrackPolicyService.syncFromItem(restored, tx);
        // The group's policy may have changed while the item was deleted, so
        // the restored prices are re-keyed under the policy in force now, as a
        // save would (notes 137 D2).
        await this.priceBucketService.rekeyItem(tx, itemId);
        return { item, ...children };
      }, COMPOSITE_TRANSACTION_OPTIONS);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        const constraint = violatedConstraintOf(error) ?? '';
        throwInventoryConflict<ItemErrorDetail>('Item cannot be restored', [
          /item_name/.test(constraint)
            ? {
                field: 'item_name_en',
                code: ItemErrorCode.RESTORE_NAME_TAKEN,
                message: 'Another live item now has this name. Rename one of them, then restore.',
              }
            : /item_code/.test(constraint)
              ? {
                  field: 'item_code',
                  code: ItemErrorCode.RESTORE_CODE_TAKEN,
                  message: 'Another live item now has this code. Change one of them, then restore.',
                }
              : /item_sku/.test(constraint)
                ? {
                    field: 'item_sku',
                    code: ItemErrorCode.RESTORE_SKU_TAKEN,
                    message:
                      'Another live item now has this SKU. Change one of them, then restore.',
                  }
                : /ean_code/.test(constraint)
                  ? {
                      field: 'ean_codes',
                      code: ItemErrorCode.RESTORE_EAN_TAKEN,
                      message:
                        'An EAN code of this item now belongs to another live item. Remove it there, then restore.',
                    }
                  : {
                      field: 'item_id',
                      code: ItemErrorCode.RESTORE_CLASH,
                      message: 'A row of this item now clashes with a live row elsewhere.',
                    },
        ]);
      }
      // ex_ipm_overlap: a restored price row overlaps one written since — a
      // 409, not the 500 it used to be (notes 137 D2).
      if (isExclusionConstraintError(error)) {
        throwInventoryConflict<ItemErrorDetail>('Item cannot be restored', [
          {
            field: 'prices',
            code: ItemErrorCode.RESTORE_CLASH,
            message:
              'A price row of this item overlaps a live price row of the same company, branch, unit and MRP. Delete one of them, then restore.',
          },
        ]);
      }
      throw error;
    }
  }
  private async findItemForDeleteState(
    tx: Prisma.TransactionClient,
    itemId: string,
  ): Promise<ItemMaster> {
    const existing = await tx.itemMaster.findFirst({ where: { itemId } });
    if (!existing) {
      throwInventoryNotFound<ItemErrorDetail>(
        'Item not found',
        'item_id',
        `No item found with id ${itemId}`,
        ItemErrorCode.NOT_FOUND,
      );
    }
    return existing;
  }
  /** Flips the item row (guarded against a concurrent flip) and writes its audit row. */
  private async setItemDeleted(
    tx: Prisma.TransactionClient,
    existing: ItemMaster,
    deleted: boolean,
  ): Promise<{ item_id: string; deleted: boolean }> {
    const modifiedOn = new Date();
    const modifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const result = await tx.itemMaster.updateMany({
      where: { itemId: existing.itemId, itemIsDeleted: !deleted },
      data: { itemIsDeleted: deleted, itemModifiedOn: modifiedOn, itemModifiedBy: modifiedBy },
    });
    if (result.count === 0) {
      throwInventoryConflict<ItemErrorDetail>('Item changed', [
        {
          field: 'item_id',
          code: ItemErrorCode.CHANGED_CONCURRENTLY,
          message: 'The item was deleted or restored by someone else just now. Reload it.',
        },
      ]);
    }
    await this.auditLogService.logEntityChange(
      {
        action: deleted ? 'cancel' : 'update',
        tableName: ITEM_TABLE_NAME,
        screenName: ITEM_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: existing.itemId,
        displayName: existing.itemNameEn,
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload({
          ...existing,
          itemIsDeleted: deleted,
          itemModifiedOn: modifiedOn,
          itemModifiedBy: modifiedBy,
        }),
        userId: modifiedBy,
        notes: deleted ? 'Item soft deleted' : 'Item restored',
      },
      tx,
    );
    return { item_id: existing.itemId, deleted };
  }
  /** Flips the named child rows through their own services, on the caller's transaction. */
  private async toggleChildren(
    tx: Prisma.TransactionClient,
    ids: {
      unitConversionIds: string[];
      priceIds: string[];
      eanCodeIds: string[];
      reorderIds: string[];
    },
  ): Promise<Omit<ItemCompositeDeleteResult, 'item'>> {
    // Sequential, not Promise.all: one transaction is one connection, and the
    // EAN service re-checks the single-default rule against the other rows.
    const unit_conversions = ids.unitConversionIds.length
      ? await this.itemUnitConversionService.toggleDelete(ids.unitConversionIds, tx)
      : [];
    const prices = ids.priceIds.length
      ? await this.itemsPriceMasterService.toggleDelete(ids.priceIds, tx)
      : [];
    const ean_codes = ids.eanCodeIds.length
      ? await this.itemsEanCodeMasterService.toggleDelete(ids.eanCodeIds, tx)
      : [];
    const reorders = ids.reorderIds.length
      ? await this.itemsReorderMasterService.toggleDelete(ids.reorderIds, tx)
      : [];
    return { unit_conversions, prices, ean_codes, reorders };
  }
  private async createItem(
    saveItemDto: SaveItemDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPayload> {
    const itemNameEn = saveItemDto.item_name_en?.trim();
    if (!itemNameEn) {
      throwInventoryBadRequest<ItemErrorDetail>('Validation failed', [
        {
          field: 'item_name_en',
          code: ItemErrorCode.NAME_REQUIRED,
          message: 'item_name_en is required',
        },
      ]);
    }
    const companyId = saveItemDto.item_company_id ?? null;
    const now = new Date();
    // The token's user, never the payload's item_created_by (notes 137 C2):
    // a body could name anyone.
    const createdBy = resolveActor(null, this.requestContextService.getUserId());
    const data: Prisma.ItemMasterUncheckedCreateInput = {
      itemCompanyId: companyId,
      itemNameEn,
      itemGroupId: saveItemDto.item_group_id,
      itemBaseUnitId: saveItemDto.item_base_unit_id ?? null,
      itemPackingItemIds: saveItemDto.item_packing_item_ids ?? [],
      itemCreatedOn: now,
      itemCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveItemDto);
    const create = async (client: Prisma.TransactionClient) => {
      await this.assertBranchOfCompany(client, companyId, saveItemDto.item_branch_id ?? null);
      await this.inheritClassDefaults(client, data, saveItemDto);
      await this.assertReferencesLive(client, saveItemDto, null);
      await this.assertUniqueKeys(
        client,
        null,
        {
          companyId,
          name: itemNameEn,
          code: saveItemDto.item_code ?? null,
          sku: saveItemDto.item_sku ?? null,
          barcode: saveItemDto.item_default_barcode ?? null,
        },
        SAVE_CLASH_CODES,
      );
      const created = await client.itemMaster.create({ data, include: TRACK_PRESET_INCLUDE });
      // Same transaction as the item: an item never exists without the policy
      // that says how its stock is keyed, and neither is written if the other
      // fails.
      await this.stockTrackPolicyService.syncFromItem(created, client);
      const payload = this.toPayload(created);
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: ITEM_TABLE_NAME,
          screenName: ITEM_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: payload.item_id,
          displayName: payload.item_name_en,
          originalRecord: null,
          modifiedRecord: payload,
          userId: createdBy,
          notes: 'Item created',
        },
        client,
      );
      return payload;
    };
    try {
      return tx ? await create(tx) : await this.prisma.$transaction(create);
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  /**
   * Notes 73 C — a branch belongs to exactly one company, so an item scoped to
   * a branch must name that branch's company. A blank company shares the item
   * with every company; "every company, but only this one company's branch"
   * means nothing. 400 on item_branch_id for a branch without a company, a
   * branch that does not exist, or another company's branch.
   */
  private async assertBranchOfCompany(
    client: Prisma.TransactionClient,
    companyId: string | null,
    branchId: string | null,
  ): Promise<void> {
    if (!branchId) {
      return;
    }
    const refuse = (code: ItemErrorCode, message: string): never =>
      throwInventoryBadRequest<ItemErrorDetail>('Validation failed', [
        { field: 'item_branch_id', code, message },
      ]);
    if (!companyId) {
      return refuse(
        ItemErrorCode.BRANCH_NEEDS_COMPANY,
        "An item with a branch must name that branch's company: set item_company_id, or clear " +
          'item_branch_id to share the item with every company',
      );
    }
    const branch = await client.branchMaster.findFirst({
      where: { brId: branchId },
      select: { brCompId: true, brName: true },
    });
    if (!branch) {
      return refuse(ItemErrorCode.UNKNOWN_BRANCH, `No branch found with id ${branchId}`);
    }
    if (branch.brCompId !== companyId) {
      return refuse(
        ItemErrorCode.BRANCH_OTHER_COMPANY,
        `${branch.brName} belongs to another company, not to item_company_id`,
      );
    }
  }
  /**
   * Notes 70 D3: a NEW item takes the default tax, HSN and base unit of its
   * group — or, where the group names none, of its category — for each of the
   * three its payload leaves blank (omitted, null or ""). An explicit value
   * always wins, and an update never inherits: a default is where an item
   * starts, not a rule it keeps following.
   *
   * A default that points at a deleted or inactive tax rate or unit is skipped,
   * not copied — it must never turn into a 400 against a field the caller did
   * not send — and so is an HSN longer than item_hsn_code holds. The base unit
   * is left alone when the payload carries unit conversions: those rows are the
   * item's own answer about its units, and a group unit beside them could
   * disagree with them.
   */
  private async inheritClassDefaults(
    client: Prisma.TransactionClient,
    data: Prisma.ItemMasterUncheckedCreateInput,
    dto: SaveItemDto,
  ): Promise<void> {
    const wantsTax = !data.itemDefaultTaxId;
    const wantsHsn = !data.itemHsnCode?.trim();
    const wantsUnit =
      !data.itemBaseUnitId && !(dto as SaveItemCompositeDto).unit_conversions?.length;
    if (!wantsTax && !wantsHsn && !wantsUnit) {
      return;
    }
    const group = await client.itemGroupMaster.findUnique({
      where: { itgId: data.itemGroupId },
      select: { itgDefaultTaxId: true, itgDefaultHsn: true, itgDefaultUomId: true },
    });
    const category = data.itemCategoryId
      ? await client.categoryMaster.findUnique({
          where: { categoryId: data.itemCategoryId },
          select: {
            categoryDefaultTaxId: true,
            categoryDefaultHsn: true,
            categoryDefaultUomId: true,
          },
        })
      : null;
    // Group first, then category, field by field.
    const taxIds = [group?.itgDefaultTaxId, category?.categoryDefaultTaxId].filter(
      (id): id is string => !!id,
    );
    const unitIds = [group?.itgDefaultUomId, category?.categoryDefaultUomId].filter(
      (id): id is string => !!id,
    );
    if (wantsTax && taxIds.length) {
      const live = await client.taxRateMaster.findMany({
        where: { taxId: { in: taxIds }, taxIsActive: true, taxIsDeleted: false },
        select: { taxId: true },
      });
      const liveIds = new Set(live.map((row) => row.taxId));
      const taxId = taxIds.find((id) => liveIds.has(id));
      if (taxId) data.itemDefaultTaxId = taxId;
    }
    if (wantsHsn) {
      const hsn = [group?.itgDefaultHsn, category?.categoryDefaultHsn]
        .map((code) => code?.trim())
        .find((code) => !!code && code.length <= ITEM_HSN_MAX_LENGTH);
      if (hsn) data.itemHsnCode = hsn;
    }
    if (wantsUnit && unitIds.length) {
      const live = await client.unit.findMany({
        where: { unit_id: { in: unitIds }, unit_is_active: true, unit_is_deleted: false },
        select: { unit_id: true },
      });
      const liveIds = new Set(live.map((row) => row.unit_id));
      const unitId = unitIds.find((id) => liveIds.has(id));
      if (unitId) data.itemBaseUnitId = unitId;
    }
  }
  /**
   * @param options.childrenFollow true when saveComposite syncs the child rows
   *   after this update: it then re-derives the price buckets under the policy
   *   this save leaves in force (plan-nestjs-one-price-table.md §4.3) and runs
   *   the company-move check (notes 137 C3) itself, against the rows the sync
   *   leaves. A plain update does both here.
   * @returns the saved item, and the row as it stood before the save.
   */
  private async updateItem(
    saveItemDto: SaveItemDto,
    tx?: Prisma.TransactionClient,
    options: { childrenFollow: boolean } = { childrenFollow: false },
  ): Promise<{ payload: ItemPayload; before: ItemMaster }> {
    const itemId = saveItemDto.item_id!;
    const itemNameEn = saveItemDto.item_name_en?.trim();
    if (!itemNameEn) {
      throwInventoryBadRequest<ItemErrorDetail>('Validation failed', [
        {
          field: 'item_name_en',
          code: ItemErrorCode.NAME_REQUIRED,
          message: 'item_name_en cannot be empty',
        },
      ]);
    }
    const update = async (client: Prisma.TransactionClient) => {
      const existing = await client.itemMaster.findFirst({
        where: {
          itemId,
          itemIsDeleted: false,
        },
      });
      if (!existing) {
        throwInventoryNotFound<ItemErrorDetail>(
          'Item not found',
          'item_id',
          `No active item found with id ${itemId}`,
          ItemErrorCode.NOT_FOUND,
        );
      }
      // AN UPDATE WRITES WHAT THE PAYLOAD STATES. An omitted key keeps the
      // stored value — undefined is "leave it" to Prisma — and only an explicit
      // null clears one. Company and base unit used to be written `?? null`
      // (and the packing list `?? []`, in applyOptionalFields), so any client
      // that did not echo them wiped them (notes 50 #1, re-found in notes 67).
      const data: Prisma.ItemMasterUncheckedUpdateInput = {
        itemNameEn,
        itemGroupId: saveItemDto.item_group_id,
        itemModifiedOn: new Date(),
        // The token's user, never the payload's item_modified_by (notes 137 C2).
        itemModifiedBy: resolveActor(null, this.requestContextService.getUserId()),
      };
      // null clears the company — the item is then SHARED by every company —
      // and omitted keeps it. item_company_id was an OptionalUuid, which reads
      // null as "not sent", so an item could never be made shared again
      // (notes 137 A2).
      if (saveItemDto.item_company_id !== undefined) {
        data.itemCompanyId = saveItemDto.item_company_id ?? null;
      }
      // Notes 73 C, against what the item will hold after this save. An update
      // that states neither key leaves an existing row as it is.
      if (saveItemDto.item_company_id !== undefined || saveItemDto.item_branch_id !== undefined) {
        await this.assertBranchOfCompany(
          client,
          saveItemDto.item_company_id !== undefined
            ? (saveItemDto.item_company_id ?? null)
            : existing.itemCompanyId,
          saveItemDto.item_branch_id !== undefined
            ? (saveItemDto.item_branch_id ?? null)
            : existing.itemBranchId,
        );
      }
      if (saveItemDto.item_base_unit_id !== undefined) {
        data.itemBaseUnitId = saveItemDto.item_base_unit_id ?? null;
      }
      this.applyOptionalFields(data, saveItemDto);
      await this.assertReferencesLive(client, saveItemDto, existing);
      const after = <T>(sent: T | undefined, stored: T): T => (sent !== undefined ? sent : stored);
      await this.assertUniqueKeys(
        client,
        itemId,
        this.changedUniqueKeys(existing, {
          companyId: after(saveItemDto.item_company_id, existing.itemCompanyId),
          name: itemNameEn,
          code: after(saveItemDto.item_code, existing.itemCode),
          sku: after(saveItemDto.item_sku, existing.itemSku),
          barcode: after(saveItemDto.item_default_barcode, existing.itemDefaultBarcode),
        }),
        SAVE_CLASH_CODES,
      );
      const updated = await client.itemMaster.update({
        where: {
          itemId,
        },
        data,
        include: TRACK_PRESET_INCLUDE,
      });
      // Refreshes the derived policy from the saved row — a no-op write when
      // nothing the policy cares about changed, and left alone entirely when an
      // admin has hand-authored the policy for this item.
      await this.stockTrackPolicyService.syncFromItem(updated, client);
      // A new preset or group can change which price dimensions are buckets.
      // Every live price row of the item is re-keyed in this transaction, and
      // two that would become one are refused with both named.
      if (!options.childrenFollow) {
        await this.priceBucketService.rekeyItem(client, itemId);
        await this.assertCompanyMove(client, existing, updated.itemCompanyId);
      }
      const payload = this.toPayload(updated);
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: ITEM_TABLE_NAME,
          screenName: ITEM_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: itemId,
          displayName: payload.item_name_en,
          originalRecord: this.toPayload(existing),
          modifiedRecord: payload,
          userId:
            payload.item_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Item updated',
        },
        client,
      );
      return { payload, before: existing };
    };
    try {
      return tx ? await update(tx) : await this.prisma.$transaction(update);
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  /**
   * The keys an update must re-check: those whose value — or whose company —
   * this save changes. A key nobody touches is left alone, so data stored
   * before notes 137 never blocks an unrelated edit; null skips a key.
   */
  private changedUniqueKeys(existing: ItemMaster, next: ItemUniqueKeys): ItemUniqueKeys {
    const same = (a: string | null, b: string | null) =>
      (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
    const companyMoved = next.companyId !== existing.itemCompanyId;
    const keep = (value: string | null, stored: string | null) =>
      companyMoved || !same(value, stored) ? value : null;
    return {
      companyId: next.companyId,
      name: keep(next.name, existing.itemNameEn),
      code: keep(next.code, existing.itemCode),
      sku: keep(next.sku, existing.itemSku),
      barcode: same(next.barcode, existing.itemDefaultBarcode) ? null : next.barcode,
    };
  }
  /**
   * Notes 137 B5 / B6 — the user's rule (2026-10-21): name, code and SKU are
   * unique among the LIVE items of one company, in any case, and a shared item
   * (no company) clashes with every company's items. The same-company half is
   * also held by uq_item_name_en_company_ci / uq_item_code_company_ci /
   * uq_item_sku_company_ci; the shared-vs-company half is in no index, so it
   * is checked here, after an advisory lock per value that serialises two
   * saves of the same name (lowered, company-free, so a shared and a company
   * item contend too). The header barcode must not be another live item's EAN
   * code or header barcode. A null key is not checked.
   */
  private async assertUniqueKeys(
    client: Prisma.TransactionClient,
    selfId: string | null,
    keys: ItemUniqueKeys,
    codes: Readonly<Record<ItemUniqueField, ItemErrorCode>>,
  ): Promise<void> {
    const norm = (value: string | null) => value?.trim().toLowerCase() || null;
    const name = norm(keys.name);
    const code = norm(keys.code);
    const sku = norm(keys.sku);
    const barcode = norm(keys.barcode);
    const lockKeys = [
      name && `name:${name}`,
      code && `code:${code}`,
      sku && `sku:${sku}`,
      barcode && `barcode:${barcode}`,
    ]
      .filter((key): key is string => !!key)
      .sort();
    if (!lockKeys.length) {
      return;
    }
    await client.$queryRaw<Array<{ locked: number }>>`
      SELECT count(pg_advisory_xact_lock(hashtext(${UNIQUE_LOCK_NAMESPACE}), hashtext(k)))::int AS locked
        FROM unnest(${lockKeys}::text[]) AS k
    `;
    const clashes = await client.$queryRaw<Array<{ field: ItemUniqueField; holder: string }>>`
      WITH peer AS (
        SELECT item_id, item_name_en, item_code, item_sku, item_default_barcode
          FROM inventory.item_master
         WHERE item_is_deleted = false
           AND item_id IS DISTINCT FROM ${selfId}::uuid
           AND (${keys.companyId}::uuid IS NULL OR item_company_id IS NULL
                OR item_company_id = ${keys.companyId}::uuid)
      )
      SELECT 'item_name_en' AS field, item_name_en AS holder FROM peer
       WHERE ${name}::text IS NOT NULL AND lower(item_name_en) = ${name}::text
      UNION ALL
      SELECT 'item_code', item_name_en FROM peer
       WHERE ${code}::text IS NOT NULL AND lower(item_code) = ${code}::text
      UNION ALL
      SELECT 'item_sku', item_name_en FROM peer
       WHERE ${sku}::text IS NOT NULL AND lower(item_sku) = ${sku}::text
      UNION ALL
      SELECT 'item_default_barcode', m.item_name_en
        FROM inventory.item_master m
       WHERE ${barcode}::text IS NOT NULL AND m.item_is_deleted = false
         AND m.item_id IS DISTINCT FROM ${selfId}::uuid
         AND (lower(m.item_default_barcode) = ${barcode}::text
              OR EXISTS (SELECT 1 FROM inventory.item_ean_codes e
                          WHERE e.ean_item_id = m.item_id AND e.ean_is_deleted = false
                            AND upper(e.ean_code) = upper(${barcode}::text)))
    `;
    if (!clashes.length) {
      return;
    }
    const what: Record<ItemUniqueField, string> = {
      item_name_en: 'name',
      item_code: 'code',
      item_sku: 'SKU',
      item_default_barcode: 'barcode',
    };
    throwInventoryConflict<ItemErrorDetail>(
      'Item already exists',
      clashes.map((clash) => ({
        field: clash.field,
        code: codes[clash.field],
        message:
          clash.field === 'item_default_barcode'
            ? `${clash.holder} already scans with this barcode.`
            : `${clash.holder} already has this ${what[clash.field]} (letters compared in any ` +
              'case). Names, codes and SKUs are unique within a company, and a shared item ' +
              "shares them with every company's items.",
      })),
    );
  }
  /**
   * Notes 137 B9 — every master the item names must be live and active when
   * this save CHOOSES it: brand, section, supplier and customer group have no
   * foreign key at all, and the ones that do (group, category, unit, tax,
   * preset) let a deleted or inactive row through. A value the save leaves as
   * it was is not re-checked, so a master retired since never blocks an edit.
   * item_mfgr_id, item_company_category_id and item_barcode_sticker_id have no
   * master table and are not checked.
   */
  private async assertReferencesLive(
    client: Prisma.TransactionClient,
    dto: SaveItemDto,
    existing: ItemMaster | null,
  ): Promise<void> {
    type State = { deleted: boolean; active: boolean } | null;
    const checks: Array<{
      field: string;
      value: string | null | undefined;
      stored: string | null | undefined;
      unknown: ItemErrorCode;
      what: string;
      load: (id: string) => Promise<State>;
    }> = [
      {
        field: 'item_group_id',
        value: dto.item_group_id,
        stored: existing?.itemGroupId,
        unknown: ItemErrorCode.UNKNOWN_GROUP,
        what: 'item group',
        load: async (id) => {
          const row = await client.itemGroupMaster.findUnique({
            where: { itgId: id },
            select: { itgIsDeleted: true, itgIsActive: true },
          });
          return row && { deleted: row.itgIsDeleted, active: row.itgIsActive };
        },
      },
      {
        field: 'item_category_id',
        value: dto.item_category_id,
        stored: existing?.itemCategoryId,
        unknown: ItemErrorCode.UNKNOWN_CATEGORY,
        what: 'item category',
        load: async (id) => {
          const row = await client.categoryMaster.findUnique({
            where: { categoryId: id },
            select: { categoryIsDeleted: true, categoryIsActive: true },
          });
          return row && { deleted: row.categoryIsDeleted, active: row.categoryIsActive };
        },
      },
      {
        field: 'item_base_unit_id',
        value: dto.item_base_unit_id,
        stored: existing?.itemBaseUnitId,
        unknown: ItemErrorCode.UNKNOWN_UNIT,
        what: 'unit',
        load: async (id) => {
          const row = await client.unit.findUnique({
            where: { unit_id: id },
            select: { unit_is_deleted: true, unit_is_active: true },
          });
          return row && { deleted: row.unit_is_deleted, active: row.unit_is_active };
        },
      },
      {
        field: 'item_default_tax_id',
        value: dto.item_default_tax_id,
        stored: existing?.itemDefaultTaxId,
        unknown: ItemErrorCode.UNKNOWN_TAX_RATE,
        what: 'tax rate',
        load: async (id) => {
          const row = await client.taxRateMaster.findUnique({
            where: { taxId: id },
            select: { taxIsDeleted: true, taxIsActive: true },
          });
          return row && { deleted: row.taxIsDeleted, active: row.taxIsActive };
        },
      },
      {
        field: 'item_track_preset_id',
        value: dto.item_track_preset_id,
        stored: existing?.itemTrackPresetId,
        unknown: ItemErrorCode.UNKNOWN_TRACK_PRESET,
        what: 'stock track preset',
        load: async (id) => {
          const row = await client.stockTrackPreset.findUnique({
            where: { sptId: id },
            select: { sptIsDeleted: true, sptIsActive: true },
          });
          return row && { deleted: row.sptIsDeleted, active: row.sptIsActive };
        },
      },
      {
        field: 'item_brand_id',
        value: dto.item_brand_id,
        stored: existing?.itemBrandId,
        unknown: ItemErrorCode.UNKNOWN_BRAND,
        what: 'item brand',
        load: async (id) => {
          const row = await client.itemBrandMaster.findUnique({
            where: { brand_id: id },
            select: { brand_is_deleted: true, brand_is_active: true },
          });
          return row && { deleted: row.brand_is_deleted, active: row.brand_is_active };
        },
      },
      {
        field: 'item_section_id',
        value: dto.item_section_id,
        stored: existing?.itemSectionId,
        unknown: ItemErrorCode.UNKNOWN_SECTION,
        what: 'item section',
        load: async (id) => {
          const row = await client.itemSectionMaster.findUnique({
            where: { secId: id },
            select: { secIsDeleted: true, secIsActive: true },
          });
          return row && { deleted: row.secIsDeleted, active: row.secIsActive };
        },
      },
      {
        field: 'item_supplier_id',
        value: dto.item_supplier_id,
        stored: existing?.itemSupplierId,
        unknown: ItemErrorCode.UNKNOWN_SUPPLIER,
        what: 'supplier',
        load: async (id) => {
          const row = await client.supplier.findUnique({
            where: { supId: id },
            select: { supIsDeleted: true, supIsActive: true },
          });
          return row && { deleted: row.supIsDeleted, active: row.supIsActive };
        },
      },
      {
        field: 'item_cust_group',
        value: dto.item_cust_group,
        stored: existing?.itemCustGroup,
        unknown: ItemErrorCode.UNKNOWN_CUST_GROUP,
        what: 'customer group',
        load: async (id) => {
          const row = await client.custGroup.findUnique({
            where: { cgrId: id },
            select: { cgrIsDeleted: true, cgrIsActive: true },
          });
          return row && { deleted: row.cgrIsDeleted, active: row.cgrIsActive };
        },
      },
    ];
    for (const check of checks) {
      const id = check.value;
      if (!id || id === check.stored) {
        continue;
      }
      const state = await check.load(id);
      if (!state) {
        throwInventoryBadRequest<ItemErrorDetail>('Invalid relation reference', [
          {
            field: check.field,
            code: check.unknown,
            message: `${check.field} does not name an existing ${check.what}`,
          },
        ]);
      }
      if (state.deleted || !state.active) {
        throwInventoryBadRequest<ItemErrorDetail>('Invalid relation reference', [
          {
            field: check.field,
            code: ItemErrorCode.REFERENCE_RETIRED,
            message: `The ${check.what} ${id} is ${state.deleted ? 'deleted' : 'inactive'}. Choose a live one.`,
          },
        ]);
      }
    }
  }
  /**
   * Notes 137 C3 — an item that moves INTO a company (from shared, or from
   * another company) must not leave stock or prices behind in a company that
   * can no longer see it. A move to shared only widens who sees the item and
   * is never refused; neither is a save that keeps the company.
   */
  private async assertCompanyMove(
    client: Prisma.TransactionClient,
    before: ItemMaster,
    companyId: string | null,
  ): Promise<void> {
    if (!companyId || companyId === before.itemCompanyId) {
      return;
    }
    const [row] = await client.$queryRaw<Array<{ stock_rows: number; price_rows: number }>>`
      SELECT
        (SELECT count(*)::int FROM stock.stock_balance b
          WHERE b.sbl_item_id = ${before.itemId}::uuid AND b.sbl_is_deleted = false
            AND (b.sbl_on_hand_qty <> 0 OR b.sbl_transit_in_qty <> 0)
            AND b.sbl_company_id <> ${companyId}::uuid) AS stock_rows,
        (SELECT count(*)::int FROM inventory.item_price_master p
           LEFT JOIN public.branch_master br ON br.br_id = p.ipm_branch_id
          WHERE p.ipm_item_id = ${before.itemId}::uuid AND p.ipm_is_deleted = false
            AND (p.ipm_company_id <> ${companyId}::uuid
                 OR br.br_comp_id <> ${companyId}::uuid)) AS price_rows
    `;
    const parts = [
      row?.stock_rows ? `${row.stock_rows} stock holding(s) with quantity` : null,
      row?.price_rows ? `${row.price_rows} price row(s)` : null,
    ].filter((part): part is string => part !== null);
    if (parts.length) {
      throwInventoryConflict<ItemErrorDetail>('The item cannot move to this company', [
        {
          field: 'item_company_id',
          code: ItemErrorCode.COMPANY_MOVE_BLOCKED,
          message:
            `Another company still holds ${parts.join(' and ')} of this item. ` +
            'Clear them there first, or keep the item shared.',
        },
      ]);
    }
  }
  /**
   * Notes 137 B7 — the header's base unit and the conversion row marked
   * iuc_is_base_unit are one fact stated twice. A save that names a header
   * unit other than the base row's is refused; a blank header (not sent, or
   * null — 322 items on the dev box carried one beside a base row) is filled
   * from the base row. Only checked when this save sends either.
   */
  private async alignBaseUnit(
    tx: Prisma.TransactionClient,
    item: ItemPayload,
    dto: SaveItemCompositeDto,
    syncedConversions: Array<{ iuc_unit_id: string; iuc_is_base_unit: boolean }>,
  ): Promise<ItemPayload> {
    if (dto.item_base_unit_id === undefined && dto.unit_conversions === undefined) {
      return item;
    }
    const conversions =
      dto.unit_conversions !== undefined
        ? syncedConversions
        : await this.itemUnitConversionService.findByItemId(item.item_id, tx);
    const base = conversions.find((row) => row.iuc_is_base_unit);
    if (!base || base.iuc_unit_id === item.item_base_unit_id) {
      return item;
    }
    if (dto.item_base_unit_id) {
      throwInventoryBadRequest<ItemErrorDetail>('Validation failed', [
        {
          field: 'item_base_unit_id',
          code: ItemErrorCode.BASE_UNIT_MISMATCH,
          message: `item_base_unit_id must be ${base.iuc_unit_id}, the unit of the item's base unit conversion row.`,
        },
      ]);
    }
    const updated = await tx.itemMaster.update({
      where: { itemId: item.item_id },
      data: { itemBaseUnitId: base.iuc_unit_id },
      include: TRACK_PRESET_INCLUDE,
    });
    return this.toPayload(updated);
  }
  /**
   * `hasOwnProperty` is true for EVERY field declared on a DTO instance, sent or
   * not (target ES2022 defines class fields), so it guards nothing on its own:
   * what keeps an omitted field untouched is that its value is undefined, which
   * Prisma skips. A field must therefore never be written as `value ?? x` here
   * — that turns "not sent" into x.
   */
  private applyOptionalFields(
    data: Prisma.ItemMasterUncheckedCreateInput | Prisma.ItemMasterUncheckedUpdateInput,
    saveItemDto: SaveItemDto,
  ): void {
    if (hasOwnProperty(saveItemDto, 'item_branch_id')) {
      data.itemBranchId = saveItemDto.item_branch_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_code')) {
      data.itemCode = saveItemDto.item_code;
    }
    if (hasOwnProperty(saveItemDto, 'item_sku')) {
      data.itemSku = saveItemDto.item_sku;
    }
    if (hasOwnProperty(saveItemDto, 'item_name_ta')) {
      data.itemNameTa = saveItemDto.item_name_ta;
    }
    if (hasOwnProperty(saveItemDto, 'item_alias')) {
      data.itemAlias = saveItemDto.item_alias;
    }
    if (hasOwnProperty(saveItemDto, 'item_stock_type')) {
      data.itemStockType = saveItemDto.item_stock_type;
    }
    if (hasOwnProperty(saveItemDto, 'item_default_barcode')) {
      data.itemDefaultBarcode = saveItemDto.item_default_barcode;
    }
    if (hasOwnProperty(saveItemDto, 'item_category_id')) {
      data.itemCategoryId = saveItemDto.item_category_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_brand_id')) {
      data.itemBrandId = saveItemDto.item_brand_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_section_id')) {
      data.itemSectionId = saveItemDto.item_section_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_company_category_id')) {
      data.itemCompanyCategoryId = saveItemDto.item_company_category_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_mfgr_id')) {
      data.itemMfgrId = saveItemDto.item_mfgr_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_supplier_id')) {
      data.itemSupplierId = saveItemDto.item_supplier_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_cust_group')) {
      data.itemCustGroup = saveItemDto.item_cust_group;
    }
    if (hasOwnProperty(saveItemDto, 'item_is_service')) {
      data.itemIsService = saveItemDto.item_is_service;
    }
    if (hasOwnProperty(saveItemDto, 'item_is_batch_based')) {
      data.itemIsBatchBased = saveItemDto.item_is_batch_based;
    }
    if (hasOwnProperty(saveItemDto, 'item_is_expiry_item')) {
      data.itemIsExpiryItem = saveItemDto.item_is_expiry_item;
    }
    if (hasOwnProperty(saveItemDto, 'item_expiry_days')) {
      data.itemExpiryDays = saveItemDto.item_expiry_days;
    }
    if (hasOwnProperty(saveItemDto, 'item_intimate_before_days')) {
      data.itemIntimateBeforeDays = saveItemDto.item_intimate_before_days;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_sales')) {
      data.itemAllowSales = saveItemDto.item_allow_sales;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_sales_return')) {
      data.itemAllowSalesReturn = saveItemDto.item_allow_sales_return;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_purchase')) {
      data.itemAllowPurchase = saveItemDto.item_allow_purchase;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_po')) {
      data.itemAllowPo = saveItemDto.item_allow_po;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_so')) {
      data.itemAllowSo = saveItemDto.item_allow_so;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_neg_stock')) {
      data.itemAllowNegStock = saveItemDto.item_allow_neg_stock;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_negative_so')) {
      data.itemAllowNegativeSo = saveItemDto.item_allow_negative_so;
    }
    if (hasOwnProperty(saveItemDto, 'item_price_list')) {
      data.itemPriceList = saveItemDto.item_price_list;
    }
    if (hasOwnProperty(saveItemDto, 'item_weigh_scale')) {
      data.itemWeighScale = saveItemDto.item_weigh_scale;
    }
    if (hasOwnProperty(saveItemDto, 'item_retail_item')) {
      data.itemRetailItem = saveItemDto.item_retail_item;
    }
    if (hasOwnProperty(saveItemDto, 'item_is_kit')) {
      data.itemIsKit = saveItemDto.item_is_kit;
    }
    if (hasOwnProperty(saveItemDto, 'item_auto_break')) {
      data.itemAutoBreak = saveItemDto.item_auto_break;
    }
    if (hasOwnProperty(saveItemDto, 'item_auto_make')) {
      data.itemAutoMake = saveItemDto.item_auto_make;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_loyalty')) {
      data.itemAllowLoyalty = saveItemDto.item_allow_loyalty;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_promo')) {
      data.itemAllowPromo = saveItemDto.item_allow_promo;
    }
    if (hasOwnProperty(saveItemDto, 'item_has_offer')) {
      data.itemHasOffer = saveItemDto.item_has_offer;
    }
    if (hasOwnProperty(saveItemDto, 'item_damagable_product')) {
      data.itemDamagableProduct = saveItemDto.item_damagable_product;
    }
    if (hasOwnProperty(saveItemDto, 'item_is_demand')) {
      data.itemIsDemand = saveItemDto.item_is_demand;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_loading')) {
      data.itemAllowLoading = saveItemDto.item_allow_loading;
    }
    if (hasOwnProperty(saveItemDto, 'item_allow_freight')) {
      data.itemAllowFreight = saveItemDto.item_allow_freight;
    }
    if (hasOwnProperty(saveItemDto, 'item_random_stock')) {
      data.itemRandomStock = saveItemDto.item_random_stock;
    }
    if (hasOwnProperty(saveItemDto, 'item_barcode_sticker')) {
      data.itemBarcodeSticker = saveItemDto.item_barcode_sticker;
    }
    if (hasOwnProperty(saveItemDto, 'item_barcode_sticker_id')) {
      data.itemBarcodeStickerId = saveItemDto.item_barcode_sticker_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_default_tax_id')) {
      data.itemDefaultTaxId = saveItemDto.item_default_tax_id;
    }
    if (hasOwnProperty(saveItemDto, 'item_hsn_code')) {
      data.itemHsnCode = saveItemDto.item_hsn_code;
    }
    if (hasOwnProperty(saveItemDto, 'item_batch_config')) {
      data.itemBatchConfig = saveItemDto.item_batch_config;
    }
    if (hasOwnProperty(saveItemDto, 'item_track_preset_id')) {
      data.itemTrackPresetId = saveItemDto.item_track_preset_id;
    }

    if (hasOwnProperty(saveItemDto, 'item_sort_order')) {
      data.itemSortOrder = saveItemDto.item_sort_order;
    }
    if (hasOwnProperty(saveItemDto, 'item_photo')) {
      data.itemPhoto = this.decodePhoto(saveItemDto.item_photo);
    }
    if (hasOwnProperty(saveItemDto, 'item_image_url')) {
      data.itemImageUrl = saveItemDto.item_image_url;
    }
    if (hasOwnProperty(saveItemDto, 'item_notes')) {
      data.itemNotes = saveItemDto.item_notes;
    }
    if (hasOwnProperty(saveItemDto, 'item_storage_location')) {
      data.itemStorageLocation = saveItemDto.item_storage_location;
    }
    // null clears the list; absent leaves it (create seeds [] itself).
    if (saveItemDto.item_packing_item_ids !== undefined) {
      data.itemPackingItemIds = saveItemDto.item_packing_item_ids ?? [];
    }
    if (hasOwnProperty(saveItemDto, 'item_incl_tax')) {
      data.itemInclTax = saveItemDto.item_incl_tax;
    }
    if (hasOwnProperty(saveItemDto, 'item_is_active')) {
      data.itemIsActive = saveItemDto.item_is_active;
    }
  }
  private decodePhoto(
    value: string | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const normalized = value.replace(/\s+/g, '');
    if (!normalized) {
      return null;
    }
    if (normalized.length % 4 !== 0 || !BASE64_PATTERN.test(normalized)) {
      throwInventoryBadRequest<ItemErrorDetail>('Validation failed', [
        {
          field: 'item_photo',
          code: ItemErrorCode.PHOTO_INVALID,
          message: 'item_photo must be a valid base64 string',
        },
      ]);
    }
    const bytes = Uint8Array.from(Buffer.from(normalized, 'base64'));
    return bytes;
  }
  private toPayload(
    record: ItemMaster & { trackPreset?: { sptName: string } | null },
  ): ItemPayload {
    return {
      item_id: record.itemId,
      item_company_id: record.itemCompanyId,
      item_branch_id: record.itemBranchId,
      item_code: record.itemCode,
      item_sku: record.itemSku,
      item_name_en: record.itemNameEn,
      item_name_ta: record.itemNameTa,
      item_alias: record.itemAlias,
      item_stock_type: record.itemStockType,
      item_default_barcode: record.itemDefaultBarcode,
      item_group_id: record.itemGroupId,
      item_category_id: record.itemCategoryId,
      item_brand_id: record.itemBrandId,
      item_section_id: record.itemSectionId,
      item_company_category_id: record.itemCompanyCategoryId,
      item_mfgr_id: record.itemMfgrId,
      item_supplier_id: record.itemSupplierId,
      item_cust_group: record.itemCustGroup,
      item_base_unit_id: record.itemBaseUnitId,
      item_is_service: record.itemIsService,
      item_is_batch_based: record.itemIsBatchBased,
      item_is_expiry_item: record.itemIsExpiryItem,
      item_expiry_days: record.itemExpiryDays,
      item_intimate_before_days: record.itemIntimateBeforeDays,
      item_allow_sales: record.itemAllowSales,
      item_allow_sales_return: record.itemAllowSalesReturn,
      item_allow_purchase: record.itemAllowPurchase,
      item_allow_po: record.itemAllowPo,
      item_allow_so: record.itemAllowSo,
      item_allow_neg_stock: record.itemAllowNegStock,
      item_allow_negative_so: record.itemAllowNegativeSo,
      item_price_list: record.itemPriceList,
      item_weigh_scale: record.itemWeighScale,
      item_retail_item: record.itemRetailItem,
      item_is_kit: record.itemIsKit,
      item_auto_break: record.itemAutoBreak,
      item_auto_make: record.itemAutoMake,
      item_allow_loyalty: record.itemAllowLoyalty,
      item_allow_promo: record.itemAllowPromo,
      item_has_offer: record.itemHasOffer,
      item_damagable_product: record.itemDamagableProduct,
      item_is_demand: record.itemIsDemand,
      item_allow_loading: record.itemAllowLoading,
      item_allow_freight: record.itemAllowFreight,
      item_random_stock: record.itemRandomStock,
      item_barcode_sticker: record.itemBarcodeSticker,
      item_barcode_sticker_id: record.itemBarcodeStickerId,
      item_default_tax_id: record.itemDefaultTaxId,
      item_hsn_code: record.itemHsnCode,
      item_batch_config: record.itemBatchConfig,
      item_track_preset_id: record.itemTrackPresetId,
      item_track_preset_name: record.trackPreset?.sptName ?? null,
      item_sort_order: record.itemSortOrder,
      item_photo: record.itemPhoto ? Buffer.from(record.itemPhoto).toString('base64') : null,
      item_image_url: record.itemImageUrl,
      item_notes: record.itemNotes,
      item_storage_location: record.itemStorageLocation,
      item_packing_item_ids: record.itemPackingItemIds,
      item_incl_tax: record.itemInclTax,
      item_is_active: record.itemIsActive,
      item_is_deleted: record.itemIsDeleted,
      item_created_on: record.itemCreatedOn.toISOString(),
      item_created_by: record.itemCreatedBy,
      item_modified_on: record.itemModifiedOn.toISOString(),
      item_modified_by: record.itemModifiedBy,
    };
  }
  /**
   * Notes 137 D4 — a unique violation is reported against the key it hit (it
   * used to be ITEM_NAME_TAKEN whatever it was), and an exclusion violation
   * (the stock track policy's ex_stp_overlap, written in the same transaction)
   * is a 409, not a 500.
   */
  private handleWriteError(error: unknown): void {
    if (isUniqueConstraintError(error)) {
      const constraint = violatedConstraintOf(error) ?? '';
      const [field, code] = /item_name/.test(constraint)
        ? ['item_name_en', ItemErrorCode.NAME_TAKEN]
        : /item_code/.test(constraint)
          ? ['item_code', ItemErrorCode.CODE_TAKEN]
          : /item_sku/.test(constraint)
            ? ['item_sku', ItemErrorCode.SKU_TAKEN]
            : ['request', ItemErrorCode.DUPLICATE];
      throwInventoryConflict<ItemErrorDetail>('Item already exists', [
        {
          field,
          code,
          message:
            code === ItemErrorCode.DUPLICATE
              ? 'Another live item already holds one of these values'
              : `Another live item of this company (or a shared one) already has this ${field}`,
        },
      ]);
    }
    if (isExclusionConstraintError(error)) {
      throwInventoryConflict<ItemErrorDetail>('Stock track policy clash', [
        {
          field: 'item_track_preset_id',
          code: ItemErrorCode.TRACK_POLICY_CLASH,
          message:
            "The item's stock track policy overlaps another live policy for the same item and scope. Reload the item and save again.",
        },
      ]);
    }
    if (isForeignKeyConstraintError(error)) {
      const known = ITEM_FOREIGN_KEYS[violatedConstraintOf(error) ?? ''];
      throwInventoryBadRequest<ItemErrorDetail>('Invalid relation reference', [
        known
          ? {
              field: known.field,
              code: known.code,
              message: `${known.field} does not name an existing ${known.what}`,
            }
          : {
              field: 'request',
              code: ItemErrorCode.UNKNOWN_REFERENCE,
              message: 'Referenced relation does not exist',
            },
      ]);
    }
  }
}
