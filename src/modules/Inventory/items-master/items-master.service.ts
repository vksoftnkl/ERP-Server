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
import { PrismaService } from 'src/database/prisma/prisma.service';
import { toNumber } from 'src/common/utils/module-service.utils';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const ITEM_TABLE_NAME = 'item master';
const ITEM_AUDIT_SCREEN_NAME = 'Item Master';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
// A composite save writes the item plus four child collections (each row an
// insert/update alongside its audit-log row) in one transaction, so it needs
// more headroom than Prisma's 5s interactive-transaction default.
const COMPOSITE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
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
      const item = await this.save(dto, tx);
      const children = await this.itemMasterUpdateService.syncChildren(item.item_id, dto, tx);
      return { item, ...children };
    }, COMPOSITE_TRANSACTION_OPTIONS);
  }
  async getById(itemId: string): Promise<ItemPayload> {
    const record = await this.prisma.itemMaster.findFirst({
      where: {
        itemId,
        itemIsDeleted: false,
      },
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
    const companyIds = collect(
      item.item_company_id,
      ...prices.map((r) => r.ipm_company_id),
    );
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
    const [companies, branches, units, godowns, groups, categories, brands, sections, suppliers, custGroups, taxes] =
      await Promise.all([
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
        taxIds.length
          ? this.prisma.itemTaxMaster.findMany({
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
    const where: Prisma.ItemMasterWhereInput = {
      itemIsDeleted: false,
      itemIsActive: true,
      ...(params.itemCompanyId ? { itemCompanyId: params.itemCompanyId } : {}),
      ...(params.itemBranchId ? { itemBranchId: params.itemBranchId } : {}),
      ...(params.itemGroupId ? { itemGroupId: params.itemGroupId } : {}),
      ...(params.itemBrandId ? { itemBrandId: params.itemBrandId } : {}),
      ...(params.itemSectionId ? { itemSectionId: params.itemSectionId } : {}),
      ...(params.itemCategoryId ? { itemCategoryId: params.itemCategoryId } : {}),
    };
    const items = await this.prisma.itemMaster.findMany({
      where,
      include: {
        prices: {
          where: { ipmIsDeleted: false },
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
    const taxRecords = taxIds.length > 0
      ? await this.prisma.itemTaxMaster.findMany({ where: { taxId: { in: taxIds }, taxIsDeleted: false } })
      : [];
    const taxById = new Map(taxRecords.map((t) => [t.taxId, t]));
    return items.map((item): BulkLoadItemPayload => {
      const p = (params.godownId
        ? item.prices.find((r) => r.ipmGodownId === params.godownId)
        : undefined)
        ?? item.prices.find((r) => r.itemUnitConversion.iucIsDefaultUnit)
        ?? item.prices[0]
        ?? null;
      const tax = item.itemDefaultTaxId ? (taxById.get(item.itemDefaultTaxId) ?? null) : null;
      const trackingType =
        item.itemBatchConfig === 1 ? 'MRP'
        : item.itemBatchConfig === 2 || item.itemIsBatchBased || item.itemIsExpiryItem ? 'BATCH'
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
        tax_perc: toNumber(tax?.taxGstRateTotal ?? 0),
        cess_type: tax?.taxCessType ?? 'NONE',
        cess_perc: toNumber(tax?.taxCessPerc ?? 0),
        cess_per_unit: toNumber(tax?.taxCessUnit ?? 0),
        tracking_type: trackingType,
      };
    });
  }
  async toggleDelete(itemId: string): Promise<{ item_id: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Find regardless of current deleted state
      const existing = await tx.itemMaster.findFirst({
        where: {
          itemId,
        },
      });
      if (!existing) {
        throwInventoryNotFound<ItemErrorDetail>(
          'Item not found',
          'item_id',
          `No item found with id ${itemId}`,
        );
      }
      const wasDeleted = existing.itemIsDeleted;
      const nextDeleted = !wasDeleted;
      const modifiedOn = new Date();
      const modifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // Guarded update: only flips if state hasn't changed since the read
      const result = await tx.itemMaster.updateMany({
        where: {
          itemId,
          itemIsDeleted: wasDeleted,
        },
        data: {
          itemIsDeleted: nextDeleted,
          itemModifiedOn: modifiedOn,
          itemModifiedBy: modifiedBy,
        },
      });
      if (result.count === 0) {
        throwInventoryNotFound<ItemErrorDetail>(
          'Item not found',
          'item_id',
          `No item found with id ${itemId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        itemIsDeleted: nextDeleted,
        itemModifiedOn: modifiedOn,
        itemModifiedBy: modifiedBy,
      });
      await this.auditLogService.logEntityChange(
        {
          action: nextDeleted ? 'cancel' : 'update',
          tableName: ITEM_TABLE_NAME,
          screenName: ITEM_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: itemId,
          displayName: existing.itemNameEn,
          originalRecord,
          modifiedRecord,
          userId: modifiedBy,
          notes: nextDeleted ? 'Item soft deleted' : 'Item restored',
        },
        tx,
      );
      return {
        item_id: itemId,
        deleted: nextDeleted,
      };
    });
  }
  /**
   * Soft deletes (or restores) an item and cascades the same state to all of
   * its unit conversions, prices, EAN codes and reorders. NOT atomic: the item
   * is toggled first (its own transaction), then each child collection is
   * toggled in its own transaction. Only child rows currently in the item's
   * OLD state are flipped (e.g. deleting the item soft-deletes its currently
   * active children; restoring it restores its currently deleted children) —
   * children already in the target state are left untouched.
   */
  async toggleDeleteComposite(itemId: string): Promise<ItemCompositeDeleteResult> {
    const item = await this.toggleDelete(itemId);
    const wasDeleted = !item.deleted;
    const [unitConversionIds, priceIds, eanCodeIds, reorderIds] = await Promise.all([
      this.itemUnitConversionService.findIdsByItemId(itemId, wasDeleted),
      this.itemsPriceMasterService.findIdsByItemId(itemId, wasDeleted),
      this.itemsEanCodeMasterService.findIdsByItemId(itemId, wasDeleted),
      this.itemsReorderMasterService.findIdsByItemId(itemId, wasDeleted),
    ]);
    const [unit_conversions, prices, ean_codes, reorders] = await Promise.all([
      unitConversionIds.length
        ? this.itemUnitConversionService.toggleDelete(unitConversionIds)
        : [],
      priceIds.length ? this.itemsPriceMasterService.toggleDelete(priceIds) : [],
      eanCodeIds.length ? this.itemsEanCodeMasterService.toggleDelete(eanCodeIds) : [],
      reorderIds.length ? this.itemsReorderMasterService.toggleDelete(reorderIds) : [],
    ]);
    return { item, unit_conversions, prices, ean_codes, reorders };
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
    const createdBy = resolveActor(saveItemDto.item_created_by, this.requestContextService.getUserId());
    const modifiedBy = resolveActor(saveItemDto.item_modified_by, createdBy);
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
      const created = await client.itemMaster.create({ data });
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
  private async updateItem(
    saveItemDto: SaveItemDto,
    tx?: Prisma.TransactionClient,
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
    const companyId = saveItemDto.item_company_id ?? null;
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
      const data: Prisma.ItemMasterUncheckedUpdateInput = {
        itemCompanyId: companyId,
        itemNameEn,
        itemGroupId: saveItemDto.item_group_id,
        itemBaseUnitId: saveItemDto.item_base_unit_id ?? null,
        itemModifiedOn: new Date(),
        itemModifiedBy: resolveActor(saveItemDto.item_modified_by, this.requestContextService.getUserId()),
      };
      this.applyOptionalFields(data, saveItemDto);
      const updated = await client.itemMaster.update({
        where: {
          itemId,
        },
        data,
      });
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
          userId: payload.item_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
    if (hasOwnProperty(saveItemDto, 'item_packing_item_ids')) {
      data.itemPackingItemIds = saveItemDto.item_packing_item_ids ?? [];
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
  private toPayload(record: ItemMaster): ItemPayload {
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
      item_sort_order: record.itemSortOrder,
      item_photo: record.itemPhoto ? Buffer.from(record.itemPhoto).toString('base64') : null,
      item_image_url: record.itemImageUrl,
      item_notes: record.itemNotes,
      item_storage_location: record.itemStorageLocation,
      item_packing_item_ids: record.itemPackingItemIds,
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
      throwInventoryBadRequest<ItemErrorDetail>('Invalid relation reference', [
        { field: 'item_group_id', message: 'Referenced relation does not exist' },
      ]);
    }
  }
}