import { Injectable } from '@nestjs/common';
import { ItemPriceMaster, ItemUnitConversion, Prisma } from '@prisma/client';
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
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
const DEFAULT_AUDIT_ACTOR = 'system';
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
type ItemUnitConversionSnapshot = Pick<
  ItemUnitConversion,
  | 'iucBaseUnitId'
  | 'iucToBaseFactor'
  | 'iucUnitSlno'
  | 'iucUnitFactor'
  | 'iucIsDefaultUnit'
  | 'iucIsBaseUnit'
  | 'iucIsBigUnit'
  | 'iucUomRemarks'
>;
@Injectable()
export class ItemsPriceMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveItemPriceDto: SaveItemPriceDto): Promise<ItemPricePayload>;
  async save(saveItemPriceDto: SaveItemPriceDto[]): Promise<ItemPricePayload[]>;
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
  ): Promise<ItemPricePayload | ItemPricePayload[]>;
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
  ): Promise<ItemPricePayload | ItemPricePayload[]> {
    const saveItems = Array.isArray(saveItemPriceDto) ? saveItemPriceDto : [saveItemPriceDto];
    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const savedItems: ItemPricePayload[] = [];
        for (const saveItem of saveItems) {
          savedItems.push(await this.saveItemPrice(tx, saveItem));
        }
        return savedItems;
      });
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
            orderBy: [{ ipmItemId: 'asc' }, { ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
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
  async findByItemId(itemId: string): Promise<ItemPricePayload[]> {
    const records = await this.prisma.itemPriceMaster.findMany({
      where: { ipmItemId: itemId, ipmIsDeleted: false },
      orderBy: [{ ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
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
  async toggleDelete(ipmId: string): Promise<ItemPriceDeleteResult>;
  async toggleDelete(ipmId: string[]): Promise<ItemPriceDeleteResult[]>;
  async toggleDelete(
    ipmId: string | string[],
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]>;
  async toggleDelete(
    ipmId: string | string[],
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]> {
    const toggleIds = Array.isArray(ipmId) ? ipmId : [ipmId];
    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const toggledItems: ItemPriceDeleteResult[] = [];
        for (const toggleId of toggleIds) {
          toggledItems.push(await this.toggleDeleteItemPrice(tx, toggleId));
        }
        return toggledItems;
      });
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
    const unitConversion = await this.syncUnitConversionFromItemPriceInput(tx, saveItemPriceDto);
    const now = new Date();
    const createdBy = this.resolveRecordActor(saveItemPriceDto.ipm_created_by);
    const updatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by) ?? createdBy;
    const data: Prisma.ItemPriceMasterUncheckedCreateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUnitId: saveItemPriceDto.ipm_unit_id,
      ipmGodownId: saveItemPriceDto.ipm_godown_id,
      ipmProfitType: profitType,
      ipmCreatedOn: now,
      ipmCreatedBy: createdBy,
      ipmUpdatedOn: now,
      ipmUpdatedBy: updatedBy,
    };
    this.applyOptionalFields(data, saveItemPriceDto);
    this.applyUnitConversionFields(data, unitConversion, saveItemPriceDto);
    const created = await tx.itemPriceMaster.create({ data });
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
    const unitConversion = await this.syncUnitConversionFromItemPriceInput(tx, saveItemPriceDto);
    const data: Prisma.ItemPriceMasterUncheckedUpdateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUnitId: saveItemPriceDto.ipm_unit_id,
      ipmGodownId: saveItemPriceDto.ipm_godown_id,
      ipmProfitType: profitType,
      ipmUpdatedOn: new Date(),
    };
    if (hasOwnProperty(saveItemPriceDto, 'ipm_updated_by')) {
      data.ipmUpdatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by);
    }
    this.applyOptionalFields(data, saveItemPriceDto);
    this.applyUnitConversionFields(data, unitConversion, saveItemPriceDto);
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
  private roundFactor(value: number, scale = 9): number {
    return Number(value.toFixed(scale));
  }
  private toPositiveFactor(value: Prisma.Decimal | number | null | undefined): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }
    return parsed;
  }
  private async syncUnitConversionFromItemPriceInput(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemUnitConversionSnapshot> {
    const explicitUnitFactor = this.toPositiveFactor(saveItemPriceDto.ipm_unit_factor);
    if (explicitUnitFactor === undefined) {
      return this.resolveUnitConversion(tx, saveItemPriceDto);
    }
    const persistedRows = await tx.itemUnitConversion.findMany({
      where: {
        iucItemId: saveItemPriceDto.ipm_item_id,
        iucIsDeleted: false,
      },
      orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
    });
    if (persistedRows.length === 0) {
      return this.buildFallbackUnitConversionSnapshot(saveItemPriceDto);
    }
    type ChainRow = {
      iucId: string;
      unitId: string;
      baseUnitId: string;
      unitSlno: number;
      unitFactor: number;
      toBaseFactor: number;
      isBaseUnit: boolean;
      isDefaultUnit: boolean;
      isBigUnit: boolean;
      uomRemarks: string | null;
      cumulative: number;
    };
    const chainRows: ChainRow[] = persistedRows.map((row) => ({
      iucId: row.iucId,
      unitId: row.iucUnitId,
      baseUnitId: row.iucBaseUnitId,
      unitSlno: row.iucUnitSlno,
      unitFactor: this.toPositiveFactor(row.iucUnitFactor) ?? 1,
      toBaseFactor: this.toPositiveFactor(row.iucToBaseFactor) ?? 1,
      isBaseUnit: row.iucIsBaseUnit,
      isDefaultUnit: row.iucIsDefaultUnit,
      isBigUnit: row.iucIsBigUnit,
      uomRemarks: row.iucUomRemarks,
      cumulative: 1,
    }));
    const targetRow = chainRows.find((row) => row.unitId === saveItemPriceDto.ipm_unit_id);
    if (!targetRow) {
      return this.buildFallbackUnitConversionSnapshot(saveItemPriceDto);
    }
    if (saveItemPriceDto.ipm_unit_slno !== undefined) {
      targetRow.unitSlno = saveItemPriceDto.ipm_unit_slno;
    }
    chainRows.sort((left, right) => {
      if (left.unitSlno !== right.unitSlno) {
        return left.unitSlno - right.unitSlno;
      }
      return left.unitId.localeCompare(right.unitId);
    });
    const resolvedBaseUnitId =
      saveItemPriceDto.ipm_base_unit_id ??
      (saveItemPriceDto.ipm_is_base_unit === true ? saveItemPriceDto.ipm_unit_id : undefined) ??
      chainRows.find((row) => row.isBaseUnit)?.unitId ??
      chainRows[0].baseUnitId ??
      chainRows[0].unitId;
    for (const row of chainRows) {
      row.baseUnitId = resolvedBaseUnitId;
      row.isBaseUnit = row.unitId === resolvedBaseUnitId;
    }
    for (let i = 0; i < chainRows.length; i++) {
      const row = chainRows[i];
      if (i === 0) {
        row.unitFactor = 1;
        row.cumulative = 1;
        continue;
      }
      if (row.unitId === saveItemPriceDto.ipm_unit_id) {
        row.unitFactor = explicitUnitFactor;
      }
      const previousRow = chainRows[i - 1];
      row.cumulative = this.roundFactor(previousRow.cumulative * row.unitFactor);
    }
    const baseRow = chainRows.find((row) => row.unitId === resolvedBaseUnitId);
    if (!baseRow) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: 'ipm_base_unit_id',
          message: 'Unable to resolve base unit for item price conversion',
        },
      ]);
    }
    for (const row of chainRows) {
      row.toBaseFactor = this.roundFactor(baseRow.cumulative / row.cumulative);
    }
    const actor =
      this.resolveRecordActor(saveItemPriceDto.ipm_updated_by) ??
      this.resolveRecordActor(saveItemPriceDto.ipm_created_by);
    const now = new Date();
    for (const row of chainRows) {
      await tx.itemUnitConversion.update({
        where: {
          iucId: row.iucId,
        },
        data: {
          iucBaseUnitId: row.baseUnitId,
          iucUnitSlno: row.unitSlno,
          iucUnitFactor: row.unitFactor,
          iucToBaseFactor: row.toBaseFactor,
          iucIsBaseUnit: row.isBaseUnit,
          iucUpdatedOn: now,
          ...(actor ? { iucUpdatedBy: actor } : {}),
        },
      });
    }
    const selectedRow = chainRows.find((row) => row.unitId === saveItemPriceDto.ipm_unit_id)!;
    return {
      iucBaseUnitId: selectedRow.baseUnitId,
      iucToBaseFactor: new Prisma.Decimal(selectedRow.toBaseFactor),
      iucUnitSlno: selectedRow.unitSlno,
      iucUnitFactor: new Prisma.Decimal(selectedRow.unitFactor),
      iucIsDefaultUnit: selectedRow.isDefaultUnit,
      iucIsBaseUnit: selectedRow.isBaseUnit,
      iucIsBigUnit: selectedRow.isBigUnit,
      iucUomRemarks: selectedRow.uomRemarks,
    };
  }
  private async resolveUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemUnitConversionSnapshot> {
    const unitConversion = await tx.itemUnitConversion.findFirst({
      where: {
        iucItemId: saveItemPriceDto.ipm_item_id,
        iucUnitId: saveItemPriceDto.ipm_unit_id,
        iucIsActive: true,
        iucIsDeleted: false,
      },
    });
    if (!unitConversion) {
      return this.buildFallbackUnitConversionSnapshot(saveItemPriceDto);
    }
    return unitConversion;
  }
  private buildFallbackUnitConversionSnapshot(
    saveItemPriceDto: SaveItemPriceDto,
  ): ItemUnitConversionSnapshot {
    const resolvedBaseUnitId = saveItemPriceDto.ipm_base_unit_id ?? saveItemPriceDto.ipm_unit_id;
    const isBaseUnit =
      saveItemPriceDto.ipm_is_base_unit ?? resolvedBaseUnitId === saveItemPriceDto.ipm_unit_id;
    // only unit_factor defaults to 1
    const unitFactor = this.toPositiveFactor(saveItemPriceDto.ipm_unit_factor) ?? 1;
    // do NOT force to_base_factor = 1
    const toBaseFactor =
      this.toPositiveFactor(saveItemPriceDto.ipm_to_base_factor) ??
      this.toPositiveFactor(saveItemPriceDto.ipm_unit_factor) ??
      1;
    return {
      iucBaseUnitId: resolvedBaseUnitId,
      iucToBaseFactor: new Prisma.Decimal(toBaseFactor),
      iucUnitSlno: saveItemPriceDto.ipm_unit_slno ?? 0,
      iucUnitFactor: new Prisma.Decimal(unitFactor),
      iucIsDefaultUnit: saveItemPriceDto.ipm_is_default_unit ?? false,
      iucIsBaseUnit: isBaseUnit,
      iucIsBigUnit: saveItemPriceDto.ipm_is_big_unit ?? false,
      iucUomRemarks: saveItemPriceDto.ipm_uom_remarks ?? null,
    };
  }
  private applyUnitConversionFields(
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    unitConversion: ItemUnitConversionSnapshot,
    saveItemPriceDto: SaveItemPriceDto,
  ): void {
    data.ipmBaseUnitId = unitConversion.iucBaseUnitId;
    data.ipmToBaseFactor = unitConversion.iucToBaseFactor;
    data.ipmUnitSlno = unitConversion.iucUnitSlno;
    data.ipmUnitFactor = unitConversion.iucUnitFactor;
    data.ipmIsDefaultUnit = unitConversion.iucIsDefaultUnit;
    data.ipmIsBigUnit = unitConversion.iucIsBigUnit;
    data.ipmIsBaseUnit = unitConversion.iucIsBaseUnit;
    if (!hasOwnProperty(saveItemPriceDto, 'ipm_uom_remarks')) {
      data.ipmUomRemarks = unitConversion.iucUomRemarks;
    }
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
    if (hasOwnProperty(saveItemPriceDto, 'ipm_base_unit_id')) {
      data.ipmBaseUnitId = saveItemPriceDto.ipm_base_unit_id;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_to_base_factor')) {
      data.ipmToBaseFactor = saveItemPriceDto.ipm_to_base_factor;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_unit_slno')) {
      data.ipmUnitSlno = saveItemPriceDto.ipm_unit_slno;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_unit_factor')) {
      data.ipmUnitFactor = saveItemPriceDto.ipm_unit_factor;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_is_default_unit')) {
      data.ipmIsDefaultUnit = saveItemPriceDto.ipm_is_default_unit;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_is_big_unit')) {
      data.ipmIsBigUnit = saveItemPriceDto.ipm_is_big_unit;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_is_base_unit')) {
      data.ipmIsBaseUnit = saveItemPriceDto.ipm_is_base_unit;
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
      ipm_unit_id: record.ipmUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_base_unit_id: record.ipmBaseUnitId,
      ipm_to_base_factor: toNumber(record.ipmToBaseFactor),
      ipm_unit_slno: record.ipmUnitSlno,
      ipm_unit_factor: toNumber(record.ipmUnitFactor),
      ipm_is_default_unit: record.ipmIsDefaultUnit,
      ipm_is_big_unit: record.ipmIsBigUnit,
      ipm_is_base_unit: record.ipmIsBaseUnit,
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
    return `${record.ipmItemId}:${record.ipmUnitId}:${branchSegment}:${record.ipmGodownId}`;
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