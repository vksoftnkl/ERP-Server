import { Injectable } from '@nestjs/common';
import { ItemMaster, Prisma } from '@prisma/client';
import { SaveItemDto } from './dto/save-item.dto';
import { SaveItemCompositeDto } from './dto/save-item-composite.dto';
import { BulkLoadItemPayload, ItemErrorDetail, ItemPayload } from './types/item-api.types';
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
  isForeignKeyConstraintError,
  isUniqueConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryConflict,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
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
const ITEM_FOREIGN_KEYS: Readonly<Record<string, { field: string; what: string }>> = {
  item_master_item_group_id_fkey: { field: 'item_group_id', what: 'item group' },
  item_master_item_default_tax_id_fkey: {
    field: 'item_default_tax_id',
    what: 'tax rate (tax_rate_master)',
  },
  item_master_item_base_unit_id_fkey: { field: 'item_base_unit_id', what: 'unit' },
  item_master_item_category_id_fkey: { field: 'item_category_id', what: 'item category' },
  item_master_item_company_id_fkey: { field: 'item_company_id', what: 'company' },
  fk_item_track_preset: { field: 'item_track_preset_id', what: 'stock track preset' },
};
/** What keeps an item from being deleted (notes 70 C4): stock that still exists. */
const ITEM_STOCK_REFERENCES: readonly LiveReference[] = [
  {
    table: 'stock.stock_balance',
    column: 'sbl_item_id',
    live: 'sbl_is_deleted = false AND (sbl_on_hand_qty <> 0 OR sbl_transit_in_qty <> 0)',
    label: 'stock holdings with quantity on hand or in transit',
  },
];
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
      return this.updateItem(saveItemDto, tx);
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
      const item = dto.item_id
        ? await this.updateItem(dto, tx, { rekeyPrices: false })
        : await this.createItem(dto, tx);
      const children = await this.itemMasterUpdateService.syncChildren(item.item_id, dto, tx);
      // AFTER the price sync, not before: this save may both change the
      // tracking (preset, group) and remove the row that would otherwise
      // collide under it, and the payload is the final word on which rows
      // exist. Re-keying first would refuse a save whose end state is valid.
      if (await this.priceBucketService.rekeyItem(tx, item.item_id)) {
        children.prices = await this.itemsPriceMasterService.findByItemId(item.item_id, tx);
      }
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
            message: `${existing.itemNameEn} is already deleted. POST /items/restore brings it back.`,
          },
        ]);
      }
      // Notes 70 C4 — an item with stock on hand (or on its way to a branch)
      // is not deleted: it would vanish from every picker while the holding
      // stays valued and unsellable. Past transactions do not block — a soft
      // delete keeps them readable — only stock that still exists does.
      await assertNoLiveReferences(tx, ITEM_STOCK_REFERENCES, itemId, {
        label: 'item',
        idField: 'item_id',
      });
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
              message: `${existing.itemNameEn} is not deleted; there is nothing to restore.`,
            },
          ]);
        }
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
        return { item, ...children };
      }, COMPOSITE_TRANSACTION_OPTIONS);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        const constraint = violatedConstraintOf(error) ?? '';
        throwInventoryConflict<ItemErrorDetail>('Item cannot be restored', [
          /item_name_en/.test(constraint)
            ? {
                field: 'item_name_en',
                message: 'Another live item now has this name. Rename one of them, then restore.',
              }
            : /ean_code/.test(constraint)
              ? {
                  field: 'ean_codes',
                  message:
                    'An EAN code of this item now belongs to another live item. Remove it there, then restore.',
                }
              : {
                  field: 'item_id',
                  message: 'A row of this item now clashes with a live row elsewhere.',
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
          message: 'item_name_en is required',
        },
      ]);
    }
    const companyId = saveItemDto.item_company_id ?? null;
    const now = new Date();
    const createdBy = resolveActor(
      saveItemDto.item_created_by,
      this.requestContextService.getUserId(),
    );
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
    const refuse = (message: string): never =>
      throwInventoryBadRequest<ItemErrorDetail>('Validation failed', [
        { field: 'item_branch_id', message },
      ]);
    if (!companyId) {
      return refuse(
        "An item with a branch must name that branch's company: set item_company_id, or clear " +
          'item_branch_id to share the item with every company',
      );
    }
    const branch = await client.branchMaster.findFirst({
      where: { brId: branchId },
      select: { brCompId: true, brName: true },
    });
    if (!branch) {
      return refuse(`No branch found with id ${branchId}`);
    }
    if (branch.brCompId !== companyId) {
      return refuse(`${branch.brName} belongs to another company, not to item_company_id`);
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
   * @param options.rekeyPrices re-derive the item's price buckets under the
   *   policy this save leaves in force (plan-nestjs-one-price-table.md §4.3).
   *   saveComposite turns it off and re-keys after its own price sync instead.
   */
  private async updateItem(
    saveItemDto: SaveItemDto,
    tx?: Prisma.TransactionClient,
    options: { rekeyPrices: boolean } = { rekeyPrices: true },
  ): Promise<ItemPayload> {
    const itemId = saveItemDto.item_id!;
    const itemNameEn = saveItemDto.item_name_en?.trim();
    if (!itemNameEn) {
      throwInventoryBadRequest<ItemErrorDetail>('Validation failed', [
        {
          field: 'item_name_en',
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
        itemModifiedBy: resolveActor(
          saveItemDto.item_modified_by,
          this.requestContextService.getUserId(),
        ),
      };
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
      if (options.rekeyPrices) {
        await this.priceBucketService.rekeyItem(client, itemId);
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
      return payload;
    };
    try {
      return tx ? await update(tx) : await this.prisma.$transaction(update);
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
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
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemErrorDetail>(error, 'Item already exists', [
      { field: 'item_name_en', message: 'Duplicate item_name_en is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      const known = ITEM_FOREIGN_KEYS[violatedConstraintOf(error) ?? ''];
      throwInventoryBadRequest<ItemErrorDetail>('Invalid relation reference', [
        known
          ? {
              field: known.field,
              message: `${known.field} does not name an existing ${known.what}`,
            }
          : { field: 'request', message: 'Referenced relation does not exist' },
      ]);
    }
  }
}
