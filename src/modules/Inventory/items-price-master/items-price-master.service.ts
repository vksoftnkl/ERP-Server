import { Injectable } from '@nestjs/common';
import { ItemPriceMaster, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { GetItemPriceQueryDto } from './dto/get-item-price-query.dto';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import {
  ItemPriceDeleteResult,
  ItemPriceErrorDetail,
  ItemPriceListItem,
  ItemPriceListMeta,
  ItemPricePayload,
} from './types/item-price-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  hasOwnProperty,
  isForeignKeyConstraintError,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from 'src/common/utils/module-service.utils';
import type { InventoryWriteClient } from 'src/common/utils/module-service.utils';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
const DEFAULT_AUDIT_ACTOR = 'system';
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
/**
 * item_price_master stores no unit shape (base unit, factors, slno, the is_*
 * flags) — item_unit_conversion owns it, and a price row reaches it through
 * ipm_uc_unit_id. Callers that need those attributes read the conversion row
 * itself; nothing here mirrors them onto the price payload.
 */
@Injectable()
export class ItemsPriceMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(
    saveItemPriceDto: SaveItemPriceDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload>;
  async save(
    saveItemPriceDto: SaveItemPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload[]>;
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload | ItemPricePayload[]>;
  /**
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own (see ItemsMasterService.saveComposite).
   */
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload | ItemPricePayload[]> {
    const saveItems = Array.isArray(saveItemPriceDto) ? saveItemPriceDto : [saveItemPriceDto];
    const saveAll = async (client: Prisma.TransactionClient) => {
      const savedItems: ItemPricePayload[] = [];
      for (const saveItem of saveItems) {
        savedItems.push(await this.saveItemPrice(client, saveItem));
      }
      return savedItems;
    };
    try {
      const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
      return Array.isArray(saveItemPriceDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async listPrices(
    queryDto: GetItemPriceQueryDto,
  ): Promise<ConfiguredGridListResult<ItemPriceListItem, ItemPriceListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.ItemPriceMasterWhereInput = {
      ipmIsDeleted: false,
      ...(queryDto.ipm_item_id !== undefined && { ipmItemId: queryDto.ipm_item_id }),
      ...(queryDto.ipm_company_id !== undefined && { ipmCompanyId: queryDto.ipm_company_id }),
      ...(queryDto.ipm_branch_id !== undefined && { ipmBranchId: queryDto.ipm_branch_id }),
      ...(queryDto.ipm_is_active !== undefined && { ipmIsActive: queryDto.ipm_is_active }),
    };
    return runInventoryListQuery<ItemPriceMaster, ItemPriceListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<ItemPriceListItem>(this.configuredGridSqlService, {
            tableName: ITEM_PRICE_TABLE_NAME,
            alias: 'item_price_grid',
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.itemPriceMaster.count({ where }),
        findManyFn: () =>
          this.prisma.itemPriceMaster.findMany({
            where,
            // The conversion row carries the display order the unit shape lives on.
            orderBy: [
              { ipmItemId: 'asc' },
              { itemUnitConversion: { iucUnitSlno: 'asc' } },
              { ipmId: 'asc' },
            ],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(ipmId: string): Promise<ItemPricePayload> {
    const record = await this.prisma.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });
    if (!record) {
      throwInventoryNotFound<ItemPriceErrorDetail>(
        'Item price not found',
        'ipm_id',
        `No item price found with id ${ipmId}`,
      );
    }
    return this.toPayload(record);
  }
  async findByItemId(
    itemId: string,
    client: InventoryWriteClient = this.prisma,
  ): Promise<ItemPricePayload[]> {
    const records = await client.itemPriceMaster.findMany({
      where: { ipmItemId: itemId, ipmIsDeleted: false },
      orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
    });
    return records.map((record) => this.toPayload(record));
  }
  async findIdsByItemId(itemId: string, isDeleted: boolean): Promise<string[]> {
    const records = await this.prisma.itemPriceMaster.findMany({
      where: { ipmItemId: itemId, ipmIsDeleted: isDeleted },
      select: { ipmId: true },
    });
    return records.map((record) => record.ipmId);
  }
  async toggleDelete(ipmId: string, tx?: Prisma.TransactionClient): Promise<ItemPriceDeleteResult>;
  async toggleDelete(
    ipmId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPriceDeleteResult[]>;
  async toggleDelete(
    ipmId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]>;
  async toggleDelete(
    ipmId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]> {
    const toggleIds = Array.isArray(ipmId) ? ipmId : [ipmId];
    const toggleAll = async (client: Prisma.TransactionClient) => {
      const toggledItems: ItemPriceDeleteResult[] = [];
      for (const toggleId of toggleIds) {
        toggledItems.push(await this.toggleDeleteItemPrice(client, toggleId));
      }
      return toggledItems;
    };
    try {
      const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
      return Array.isArray(ipmId) ? results : results[0];
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }
  private async saveItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    if (saveItemPriceDto.ipm_id) {
      return this.updateItemPrice(tx, saveItemPriceDto);
    }
    return this.createItemPrice(tx, saveItemPriceDto);
  }
  private async toggleDeleteItemPrice(
    tx: Prisma.TransactionClient,
    ipmId: string,
  ): Promise<ItemPriceDeleteResult> {
    // Find regardless of current deleted state
    const existing = await tx.itemPriceMaster.findFirst({
      where: {
        ipmId,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemPriceErrorDetail>(
        'Item price not found',
        'ipm_id',
        `No item price found with id ${ipmId}`,
      );
    }
    const nextDeleted = !existing.ipmIsDeleted;
    const updatedOn = new Date();
    const updated = await tx.itemPriceMaster.update({
      where: {
        ipmId,
      },
      data: {
        ipmIsDeleted: nextDeleted,
        ipmUpdatedOn: updatedOn,
      },
    });
    await this.auditLogService.logEntityChange(
      {
        action: nextDeleted ? 'cancel' : 'update',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmId,
        displayName: this.buildDisplayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(updated),
        userId: this.resolveAuditActor(updated.ipmUpdatedBy),
        notes: nextDeleted ? 'Item price soft deleted' : 'Item price restored',
      },
      tx,
    );
    return {
      ipm_id: ipmId,
      deleted: nextDeleted,
    };
  }
  private async createItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: 'ipm_profit_type',
          message: 'ipm_profit_type is required',
        },
      ]);
    }
    const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
    const now = new Date();
    const createdBy = this.resolveRecordActor(saveItemPriceDto.ipm_created_by);
    const updatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by) ?? createdBy;
    const data: Prisma.ItemPriceMasterUncheckedCreateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUcUnitId: unitConversion.iucId,
      ipmGodownId: saveItemPriceDto.ipm_godown_id ?? null,
      ipmProfitType: profitType,
      // The unit's own remark seeds the price row when the caller sends none.
      ipmUomRemarks: unitConversion.iucUomRemarks,
      ipmCreatedOn: now,
      ipmCreatedBy: createdBy,
      ipmUpdatedOn: now,
      ipmUpdatedBy: updatedBy,
    };
    this.applyOptionalFields(data, saveItemPriceDto);
    const created = await tx.itemPriceMaster.create({
      data,
    });
    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ipm_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: this.resolveAuditActor(createdBy),
        notes: 'Item price created',
      },
      tx,
    );
    return payload;
  }
  private async updateItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    const ipmId = saveItemPriceDto.ipm_id!;
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: 'ipm_profit_type',
          message: 'ipm_profit_type cannot be empty',
        },
      ]);
    }
    const existing = await tx.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemPriceErrorDetail>(
        'Item price not found',
        'ipm_id',
        `No item price found with id ${ipmId}`,
      );
    }
    const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
    const data: Prisma.ItemPriceMasterUncheckedUpdateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUcUnitId: unitConversion.iucId,
      ipmGodownId: saveItemPriceDto.ipm_godown_id ?? null,
      ipmProfitType: profitType,
      ipmUpdatedOn: new Date(),
    };
    if (hasOwnProperty(saveItemPriceDto, 'ipm_updated_by')) {
      data.ipmUpdatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by);
    }
    this.applyOptionalFields(data, saveItemPriceDto);
    const updated = await tx.itemPriceMaster.update({
      where: {
        ipmId,
      },
      data,
    });
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: this.resolveAuditActor(payload.ipm_updated_by),
        notes: 'Item price updated',
      },
      tx,
    );
    return payload;
  }
  /**
   * ipm_uc_unit_id is a FK to item_unit_conversion(iuc_id), and the conversion
   * row must belong to the item being priced — the FK alone would happily let a
   * price point at another item's unit. Resolving it here also names the
   * offending field instead of surfacing an opaque foreign-key violation.
   */
  private async requireUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<{ iucId: string; iucUomRemarks: string | null }> {
    const unitConversion = await tx.itemUnitConversion.findFirst({
      where: {
        iucId: saveItemPriceDto.ipm_uc_unit_id,
        iucItemId: saveItemPriceDto.ipm_item_id,
        iucIsDeleted: false,
      },
      select: { iucId: true, iucUomRemarks: true },
    });
    if (!unitConversion) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: 'ipm_uc_unit_id',
          message: `Unit conversion ${saveItemPriceDto.ipm_uc_unit_id} does not exist for item ${saveItemPriceDto.ipm_item_id}`,
        },
      ]);
    }
    return unitConversion;
  }
  private applyOptionalFields(
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    saveItemPriceDto: SaveItemPriceDto,
  ): void {
    if (hasOwnProperty(saveItemPriceDto, 'ipm_company_id')) {
      data.ipmCompanyId = saveItemPriceDto.ipm_company_id;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_branch_id')) {
      data.ipmBranchId = saveItemPriceDto.ipm_branch_id;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_cost_price')) {
      data.ipmCostPrice = saveItemPriceDto.ipm_cost_price;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_cost_wot')) {
      data.ipmCostWot = saveItemPriceDto.ipm_cost_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_a')) {
      data.ipmSalesPriceA = saveItemPriceDto.ipm_sales_price_a;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_b')) {
      data.ipmSalesPriceB = saveItemPriceDto.ipm_sales_price_b;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_c')) {
      data.ipmSalesPriceC = saveItemPriceDto.ipm_sales_price_c;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_d')) {
      data.ipmSalesPriceD = saveItemPriceDto.ipm_sales_price_d;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_a_wot')) {
      data.ipmPriceAWot = saveItemPriceDto.ipm_price_a_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_b_wot')) {
      data.ipmPriceBWot = saveItemPriceDto.ipm_price_b_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_c_wot')) {
      data.ipmPriceCWot = saveItemPriceDto.ipm_price_c_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_d_wot')) {
      data.ipmPriceDWot = saveItemPriceDto.ipm_price_d_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_a_markup_perc')) {
      data.ipmPriceAMarkupPerc = saveItemPriceDto.ipm_price_a_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_b_markup_perc')) {
      data.ipmPriceBMarkupPerc = saveItemPriceDto.ipm_price_b_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_c_markup_perc')) {
      data.ipmPriceCMarkupPerc = saveItemPriceDto.ipm_price_c_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_d_markup_perc')) {
      data.ipmPriceDMarkupPerc = saveItemPriceDto.ipm_price_d_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_max_price')) {
      data.ipmMaxPrice = saveItemPriceDto.ipm_max_price;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_min_price')) {
      data.ipmMinPrice = saveItemPriceDto.ipm_min_price;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_disc_perc')) {
      data.ipmDiscPerc = saveItemPriceDto.ipm_disc_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_disc_qty')) {
      data.ipmDiscQty = saveItemPriceDto.ipm_disc_qty;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_addl_cess')) {
      data.ipmAddlCess = saveItemPriceDto.ipm_addl_cess;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_round_off')) {
      data.ipmRoundOff = saveItemPriceDto.ipm_round_off;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_loading_charge')) {
      data.ipmLoadingCharge = saveItemPriceDto.ipm_loading_charge;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_freight_charge')) {
      data.ipmFreightCharge = saveItemPriceDto.ipm_freight_charge;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_loyalty_points')) {
      data.ipmLoyaltyPoints = saveItemPriceDto.ipm_loyalty_points;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_uom_remarks')) {
      data.ipmUomRemarks = saveItemPriceDto.ipm_uom_remarks;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_cost_remarks')) {
      data.ipmCostRemarks = saveItemPriceDto.ipm_cost_remarks;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_is_active')) {
      data.ipmIsActive = saveItemPriceDto.ipm_is_active;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sync_date')) {
      data.ipmSyncDate = this.parseOptionalDate(saveItemPriceDto.ipm_sync_date, 'ipm_sync_date');
    }
  }
  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: fieldName,
          message: `${fieldName} must be a valid date`,
        },
      ]);
    }
    return parsedDate;
  }
  private toPayload(record: ItemPriceMaster): ItemPricePayload {
    return {
      ipm_id: record.ipmId,
      ipm_company_id: record.ipmCompanyId,
      ipm_branch_id: record.ipmBranchId,
      ipm_item_id: record.ipmItemId,
      ipm_uc_unit_id: record.ipmUcUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_cost_price: toNumber(record.ipmCostPrice),
      ipm_cost_wot: toNumber(record.ipmCostWot),
      ipm_sales_price_a: toNumber(record.ipmSalesPriceA),
      ipm_sales_price_b: toNumber(record.ipmSalesPriceB),
      ipm_sales_price_c: toNumber(record.ipmSalesPriceC),
      ipm_sales_price_d: toNumber(record.ipmSalesPriceD),
      ipm_price_a_wot: toNumber(record.ipmPriceAWot),
      ipm_price_b_wot: toNumber(record.ipmPriceBWot),
      ipm_price_c_wot: toNumber(record.ipmPriceCWot),
      ipm_price_d_wot: toNumber(record.ipmPriceDWot),
      ipm_price_a_markup_perc: toNumber(record.ipmPriceAMarkupPerc),
      ipm_price_b_markup_perc: toNumber(record.ipmPriceBMarkupPerc),
      ipm_price_c_markup_perc: toNumber(record.ipmPriceCMarkupPerc),
      ipm_price_d_markup_perc: toNumber(record.ipmPriceDMarkupPerc),
      ipm_max_price: toNumber(record.ipmMaxPrice),
      ipm_min_price: toNumber(record.ipmMinPrice),
      ipm_disc_perc: toNumber(record.ipmDiscPerc),
      ipm_disc_qty: toNumber(record.ipmDiscQty),
      ipm_addl_cess: toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: toNumber(record.ipmRoundOff),
      ipm_loading_charge: toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: toNumber(record.ipmFreightCharge),
      ipm_loyalty_points: toNumber(record.ipmLoyaltyPoints),
      ipm_uom_remarks: record.ipmUomRemarks,
      ipm_cost_remarks: record.ipmCostRemarks,
      ipm_is_active: record.ipmIsActive,
      ipm_is_deleted: record.ipmIsDeleted,
      ipm_sync_date: record.ipmSyncDate ? record.ipmSyncDate.toISOString() : null,
      ipm_created_on: record.ipmCreatedOn.toISOString(),
      ipm_created_by: record.ipmCreatedBy,
      ipm_updated_on: record.ipmUpdatedOn ? record.ipmUpdatedOn.toISOString() : null,
      ipm_updated_by: record.ipmUpdatedBy,
    };
  }
  private buildDisplayName(record: ItemPriceMaster): string {
    const branchSegment = record.ipmBranchId ?? 'NO_BRANCH';
    const godownSegment = record.ipmGodownId ?? 'ALL_GODOWNS';
    return `${record.ipmItemId}:${record.ipmUcUnitId}:${branchSegment}:${godownSegment}`;
  }
  private resolveRecordActor(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed || null;
  }
  private resolveAuditActor(
    value: string | null | undefined,
    fallback = DEFAULT_AUDIT_ACTOR,
  ): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemPriceErrorDetail>(error, 'Item price already exists', [
      { field: 'ipm_item_id', message: 'Duplicate item price configuration is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Invalid relation reference', [
        {
          field: 'request',
          message: 'Referenced company, branch, item, unit, base unit, or godown does not exist',
        },
      ]);
    }
  }
  private handleDeleteError(error: unknown): void {
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Cannot delete item price', [
        { field: 'ipm_id', message: 'Item price is referenced by related records' },
      ]);
    }
  }
}