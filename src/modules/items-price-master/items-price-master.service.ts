import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemPriceMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemPriceQueryDto } from './dto/list-item-price-query.dto';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import {
  ItemPriceDeleteResult,
  ItemPriceErrorDetail,
  ItemPriceErrorResponse,
  ItemPriceListItem,
  ItemPriceListMeta,
  ItemPricePayload,
} from './types/item-price-api.types';

const DEFAULT_AUDIT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const ITEM_PRICE_TABLE_NAME = 'item_price_master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';

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

  async list(
    queryDto: ListItemPriceQueryDto,
  ): Promise<ConfiguredGridListResult<ItemPriceListItem, ItemPriceListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.ipm_company_id !== undefined ||
      queryDto.ipm_branch_id !== undefined ||
      queryDto.ipm_item_id !== undefined ||
      queryDto.ipm_unit_id !== undefined ||
      queryDto.ipm_godown_id !== undefined ||
      queryDto.ipm_base_unit_id !== undefined ||
      queryDto.ipm_profit_type !== undefined ||
      queryDto.ipm_is_active !== undefined ||
      queryDto.ipm_is_deleted !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.itemPriceMaster.count({ where }),
      this.prisma.itemPriceMaster.findMany({
        where,
        orderBy: [{ ipmItemId: 'asc' }, { ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  private async listFromConfiguredGridSql(
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<ItemPriceListItem, ItemPriceListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_PRICE_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_PRICE_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: ITEM_PRICE_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemPriceListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_price_grid',
          limit,
          skip,
          gridId: configuredGrid.gridId,
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
          styles: result.styles,
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  async getById(ipmId: string): Promise<ItemPricePayload> {
    const record = await this.prisma.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(ipmId);
    }

    return this.toPayload(record);
  }

  async delete(ipmId: string): Promise<ItemPriceDeleteResult>;
  async delete(ipmId: string[]): Promise<ItemPriceDeleteResult[]>;
  async delete(ipmId: string | string[]): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]>;
  async delete(ipmId: string | string[]): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]> {
    const deleteIds = Array.isArray(ipmId) ? ipmId : [ipmId];

    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const deletedItems: ItemPriceDeleteResult[] = [];

        for (const deleteId of deleteIds) {
          deletedItems.push(await this.deleteItemPrice(tx, deleteId));
        }

        return deletedItems;
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

  private async deleteItemPrice(
    tx: Prisma.TransactionClient,
    ipmId: string,
  ): Promise<ItemPriceDeleteResult> {
    const existing = await tx.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwNotFound(ipmId);
    }

    const deletedOn = new Date();
    const updated = await tx.itemPriceMaster.update({
      where: {
        ipmId,
      },
      data: {
        ipmIsDeleted: true,
        ipmUpdatedOn: deletedOn,
      },
    });

    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmId,
        displayName: this.buildDisplayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(updated),
        userId: this.resolveAuditActor(updated.ipmUpdatedBy),
        notes: 'Item price soft deleted',
      },
      tx,
    );

    return {
      ipm_id: ipmId,
      deleted: true,
    };
  }

  private async createItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'ipm_profit_type',
          message: 'ipm_profit_type is required',
        },
      ]);
    }

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
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
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
      this.throwNotFound(ipmId);
    }

    const data: Prisma.ItemPriceMasterUncheckedUpdateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUnitId: saveItemPriceDto.ipm_unit_id,
      ipmGodownId: saveItemPriceDto.ipm_godown_id,
      ipmProfitType: profitType,
      ipmUpdatedOn: new Date(),
    };
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_updated_by')) {
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

  private buildListWhere(queryDto: ListItemPriceQueryDto): Prisma.ItemPriceMasterWhereInput {
    const where: Prisma.ItemPriceMasterWhereInput = {
      ipmIsDeleted: queryDto.ipm_is_deleted ?? false,
    };

    if (queryDto.ipm_company_id !== undefined) {
      where.ipmCompanyId = queryDto.ipm_company_id;
    }

    if (queryDto.ipm_branch_id !== undefined) {
      where.ipmBranchId = queryDto.ipm_branch_id;
    }

    if (queryDto.ipm_item_id !== undefined) {
      where.ipmItemId = queryDto.ipm_item_id;
    }

    if (queryDto.ipm_unit_id !== undefined) {
      where.ipmUnitId = queryDto.ipm_unit_id;
    }

    if (queryDto.ipm_godown_id !== undefined) {
      where.ipmGodownId = queryDto.ipm_godown_id;
    }

    if (queryDto.ipm_base_unit_id !== undefined) {
      where.ipmBaseUnitId = queryDto.ipm_base_unit_id;
    }

    if (queryDto.ipm_profit_type !== undefined) {
      where.ipmProfitType = queryDto.ipm_profit_type;
    }

    if (queryDto.ipm_is_active !== undefined) {
      where.ipmIsActive = queryDto.ipm_is_active;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { ipmProfitType: { contains: search, mode: 'insensitive' } },
        { ipmUomRemarks: { contains: search, mode: 'insensitive' } },
        { ipmCostRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private applyOptionalFields(
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    saveItemPriceDto: SaveItemPriceDto,
  ): void {
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_company_id')) {
      data.ipmCompanyId = saveItemPriceDto.ipm_company_id;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_branch_id')) {
      data.ipmBranchId = saveItemPriceDto.ipm_branch_id;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_base_unit_id')) {
      data.ipmBaseUnitId = saveItemPriceDto.ipm_base_unit_id;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_to_base_factor')) {
      data.ipmToBaseFactor = saveItemPriceDto.ipm_to_base_factor;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_unit_slno')) {
      data.ipmUnitSlno = saveItemPriceDto.ipm_unit_slno;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_unit_factor')) {
      data.ipmUnitFactor = saveItemPriceDto.ipm_unit_factor;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_default_unit')) {
      data.ipmIsDefaultUnit = saveItemPriceDto.ipm_is_default_unit;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_big_unit')) {
      data.ipmIsBigUnit = saveItemPriceDto.ipm_is_big_unit;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_base_unit')) {
      data.ipmIsBaseUnit = saveItemPriceDto.ipm_is_base_unit;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_cost_price')) {
      data.ipmCostPrice = saveItemPriceDto.ipm_cost_price;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_cost_wot')) {
      data.ipmCostWot = saveItemPriceDto.ipm_cost_wot;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_a')) {
      data.ipmSalesPriceA = saveItemPriceDto.ipm_sales_price_a;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_b')) {
      data.ipmSalesPriceB = saveItemPriceDto.ipm_sales_price_b;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_c')) {
      data.ipmSalesPriceC = saveItemPriceDto.ipm_sales_price_c;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_d')) {
      data.ipmSalesPriceD = saveItemPriceDto.ipm_sales_price_d;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_a_wot')) {
      data.ipmPriceAWot = saveItemPriceDto.ipm_price_a_wot;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_b_wot')) {
      data.ipmPriceBWot = saveItemPriceDto.ipm_price_b_wot;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_c_wot')) {
      data.ipmPriceCWot = saveItemPriceDto.ipm_price_c_wot;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_d_wot')) {
      data.ipmPriceDWot = saveItemPriceDto.ipm_price_d_wot;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_a_markup_perc')) {
      data.ipmPriceAMarkupPerc = saveItemPriceDto.ipm_price_a_markup_perc;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_b_markup_perc')) {
      data.ipmPriceBMarkupPerc = saveItemPriceDto.ipm_price_b_markup_perc;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_c_markup_perc')) {
      data.ipmPriceCMarkupPerc = saveItemPriceDto.ipm_price_c_markup_perc;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_d_markup_perc')) {
      data.ipmPriceDMarkupPerc = saveItemPriceDto.ipm_price_d_markup_perc;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_max_price')) {
      data.ipmMaxPrice = saveItemPriceDto.ipm_max_price;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_min_price')) {
      data.ipmMinPrice = saveItemPriceDto.ipm_min_price;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_disc_perc')) {
      data.ipmDiscPerc = saveItemPriceDto.ipm_disc_perc;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_disc_qty')) {
      data.ipmDiscQty = saveItemPriceDto.ipm_disc_qty;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_addl_cess')) {
      data.ipmAddlCess = saveItemPriceDto.ipm_addl_cess;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_round_off')) {
      data.ipmRoundOff = saveItemPriceDto.ipm_round_off;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_loading_charge')) {
      data.ipmLoadingCharge = saveItemPriceDto.ipm_loading_charge;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_freight_charge')) {
      data.ipmFreightCharge = saveItemPriceDto.ipm_freight_charge;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_loyalty_points')) {
      data.ipmLoyaltyPoints = saveItemPriceDto.ipm_loyalty_points;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_uom_remarks')) {
      data.ipmUomRemarks = saveItemPriceDto.ipm_uom_remarks;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_cost_remarks')) {
      data.ipmCostRemarks = saveItemPriceDto.ipm_cost_remarks;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_active')) {
      data.ipmIsActive = saveItemPriceDto.ipm_is_active;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sync_date')) {
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
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
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
      ipm_to_base_factor: this.toNumber(record.ipmToBaseFactor),
      ipm_unit_slno: record.ipmUnitSlno,
      ipm_unit_factor: this.toNumber(record.ipmUnitFactor),
      ipm_is_default_unit: record.ipmIsDefaultUnit,
      ipm_is_big_unit: record.ipmIsBigUnit,
      ipm_is_base_unit: record.ipmIsBaseUnit,
      ipm_cost_price: this.toNumber(record.ipmCostPrice),
      ipm_cost_wot: this.toNumber(record.ipmCostWot),
      ipm_sales_price_a: this.toNumber(record.ipmSalesPriceA),
      ipm_sales_price_b: this.toNumber(record.ipmSalesPriceB),
      ipm_sales_price_c: this.toNumber(record.ipmSalesPriceC),
      ipm_sales_price_d: this.toNumber(record.ipmSalesPriceD),
      ipm_price_a_wot: this.toNumber(record.ipmPriceAWot),
      ipm_price_b_wot: this.toNumber(record.ipmPriceBWot),
      ipm_price_c_wot: this.toNumber(record.ipmPriceCWot),
      ipm_price_d_wot: this.toNumber(record.ipmPriceDWot),
      ipm_price_a_markup_perc: this.toNumber(record.ipmPriceAMarkupPerc),
      ipm_price_b_markup_perc: this.toNumber(record.ipmPriceBMarkupPerc),
      ipm_price_c_markup_perc: this.toNumber(record.ipmPriceCMarkupPerc),
      ipm_price_d_markup_perc: this.toNumber(record.ipmPriceDMarkupPerc),
      ipm_max_price: this.toNumber(record.ipmMaxPrice),
      ipm_min_price: this.toNumber(record.ipmMinPrice),
      ipm_disc_perc: this.toNumber(record.ipmDiscPerc),
      ipm_disc_qty: this.toNumber(record.ipmDiscQty),
      ipm_addl_cess: this.toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: this.toNumber(record.ipmRoundOff),
      ipm_loading_charge: this.toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: this.toNumber(record.ipmFreightCharge),
      ipm_loyalty_points: this.toNumber(record.ipmLoyaltyPoints),
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

  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private buildDisplayName(record: ItemPriceMaster): string {
    const branchSegment = record.ipmBranchId ?? 'NO_BRANCH';
    return `${record.ipmItemId}:${record.ipmUnitId}:${branchSegment}:${record.ipmGodownId}`;
  }

  private resolveRecordActor(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private resolveAuditActor(value: string | null | undefined, fallback = DEFAULT_AUDIT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item price already exists', [
          {
            field: 'ipm_item_id',
            message: 'Duplicate item price configuration is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'request',
            message: 'Referenced company, branch, item, unit, base unit, or godown does not exist',
          },
        ]),
      );
    }
  }

  private handleDeleteError(error: unknown): void {
    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Cannot delete item price', [
          {
            field: 'ipm_id',
            message: 'Item price is referenced by related records',
          },
        ]),
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2003';
  }

  private throwNotFound(ipmId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item price not found', [
        {
          field: 'ipm_id',
          message: `No item price found with id ${ipmId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemPriceErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemPriceErrorDetail[] = [],
  ): ItemPriceErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
