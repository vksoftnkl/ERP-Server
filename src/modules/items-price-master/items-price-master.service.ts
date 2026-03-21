import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
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

const DEFAULT_ACTOR = 'system';
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
      queryDto.ipm_item_id !== undefined ||
      queryDto.ipm_unit_id !== undefined ||
      queryDto.ipm_godown_id !== undefined ||
      queryDto.ipm_profit_type !== undefined ||
      queryDto.ipm_is_active !== undefined ||
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
        orderBy: [{ ipmItemId: 'asc' }, { ipmUnitSlno: 'asc' }, { ipmUnitRateId: 'asc' }],
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

  async getById(ipmUnitRateId: string): Promise<ItemPricePayload> {
    const record = await this.prisma.itemPriceMaster.findUnique({
      where: {
        ipmUnitRateId,
      },
    });

    if (!record) {
      this.throwNotFound(ipmUnitRateId);
    }

    return this.toPayload(record);
  }

  async delete(ipmUnitRateId: string): Promise<ItemPriceDeleteResult>;
  async delete(ipmUnitRateId: string[]): Promise<ItemPriceDeleteResult[]>;
  async delete(
    ipmUnitRateId: string | string[],
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]>;
  async delete(
    ipmUnitRateId: string | string[],
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]> {
    const deleteIds = Array.isArray(ipmUnitRateId) ? ipmUnitRateId : [ipmUnitRateId];

    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const deletedItems: ItemPriceDeleteResult[] = [];

        for (const deleteId of deleteIds) {
          deletedItems.push(await this.deleteItemPrice(tx, deleteId));
        }

        return deletedItems;
      });

      return Array.isArray(ipmUnitRateId) ? results : results[0];
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }

  private async saveItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    if (saveItemPriceDto.ipm_unit_rate_id) {
      return this.updateItemPrice(tx, saveItemPriceDto);
    }

    return this.createItemPrice(tx, saveItemPriceDto);
  }

  private async deleteItemPrice(
    tx: Prisma.TransactionClient,
    ipmUnitRateId: string,
  ): Promise<ItemPriceDeleteResult> {
    const existing = await tx.itemPriceMaster.findUnique({
      where: {
        ipmUnitRateId,
      },
    });
    if (!existing) {
      this.throwNotFound(ipmUnitRateId);
    }

    await tx.itemPriceMaster.delete({
      where: {
        ipmUnitRateId,
      },
    });

    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmUnitRateId,
        displayName: this.buildDisplayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: null,
        userId: DEFAULT_ACTOR,
        notes: 'Item price deleted',
      },
      tx,
    );

    return {
      ipm_unit_rate_id: ipmUnitRateId,
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
    const createdBy = this.resolveActor(saveItemPriceDto.ipm_created_by);
    const modifiedBy = this.resolveActor(saveItemPriceDto.ipm_modified_by, createdBy);
    const data: Prisma.ItemPriceMasterUncheckedCreateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUnitId: saveItemPriceDto.ipm_unit_id,
      ipmProfitType: profitType,
      ipmCreatedOn: now,
      ipmCreatedBy: createdBy,
      ipmModifiedOn: now,
      ipmModifiedBy: modifiedBy,
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
        pk: payload.ipm_unit_rate_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: createdBy,
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
    const ipmUnitRateId = saveItemPriceDto.ipm_unit_rate_id!;
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'ipm_profit_type',
          message: 'ipm_profit_type cannot be empty',
        },
      ]);
    }

    const existing = await tx.itemPriceMaster.findUnique({
      where: {
        ipmUnitRateId,
      },
    });
    if (!existing) {
      this.throwNotFound(ipmUnitRateId);
    }

    const data: Prisma.ItemPriceMasterUncheckedUpdateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUnitId: saveItemPriceDto.ipm_unit_id,
      ipmProfitType: profitType,
      ipmModifiedOn: new Date(),
      ipmModifiedBy: this.resolveActor(saveItemPriceDto.ipm_modified_by),
    };
    this.applyOptionalFields(data, saveItemPriceDto);

    const updated = await tx.itemPriceMaster.update({
      where: {
        ipmUnitRateId,
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
        pk: ipmUnitRateId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: payload.ipm_modified_by ?? DEFAULT_ACTOR,
        notes: 'Item price updated',
      },
      tx,
    );

    return payload;
  }

  private buildListWhere(queryDto: ListItemPriceQueryDto): Prisma.ItemPriceMasterWhereInput {
    const where: Prisma.ItemPriceMasterWhereInput = {};

    if (queryDto.ipm_item_id !== undefined) {
      where.ipmItemId = queryDto.ipm_item_id;
    }

    if (queryDto.ipm_unit_id !== undefined) {
      where.ipmUnitId = queryDto.ipm_unit_id;
    }

    if (queryDto.ipm_godown_id !== undefined) {
      where.ipmGodownId = queryDto.ipm_godown_id;
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
        { ipmRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private applyOptionalFields(
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    saveItemPriceDto: SaveItemPriceDto,
  ): void {
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_godown_id')) {
      data.ipmGodownId = saveItemPriceDto.ipm_godown_id;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_unit_slno')) {
      data.ipmUnitSlno = saveItemPriceDto.ipm_unit_slno;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_conversion_factor')) {
      data.ipmConversionFactor = saveItemPriceDto.ipm_conversion_factor;
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

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_a_margin')) {
      data.ipmPriceAMargin = saveItemPriceDto.ipm_price_a_margin;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_b_margin')) {
      data.ipmPriceBMargin = saveItemPriceDto.ipm_price_b_margin;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_c_margin')) {
      data.ipmPriceCMargin = saveItemPriceDto.ipm_price_c_margin;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_d_margin')) {
      data.ipmPriceDMargin = saveItemPriceDto.ipm_price_d_margin;
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

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_big_unit')) {
      data.ipmBigUnit = saveItemPriceDto.ipm_big_unit;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_uom_weight')) {
      data.ipmUomWeight = saveItemPriceDto.ipm_uom_weight;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_loading_charge')) {
      data.ipmLoadingCharge = saveItemPriceDto.ipm_loading_charge;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_freight_charge')) {
      data.ipmFreightCharge = saveItemPriceDto.ipm_freight_charge;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_points')) {
      data.ipmPoints = saveItemPriceDto.ipm_points;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_remarks')) {
      data.ipmRemarks = saveItemPriceDto.ipm_remarks;
    }

    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_active')) {
      data.ipmIsActive = saveItemPriceDto.ipm_is_active;
    }
  }

  private toPayload(record: ItemPriceMaster): ItemPricePayload {
    return {
      ipm_unit_rate_id: record.ipmUnitRateId,
      ipm_item_id: record.ipmItemId,
      ipm_unit_id: record.ipmUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_unit_slno: record.ipmUnitSlno,
      ipm_conversion_factor: this.toNumber(record.ipmConversionFactor),
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
      ipm_price_a_margin: this.toNumber(record.ipmPriceAMargin),
      ipm_price_b_margin: this.toNumber(record.ipmPriceBMargin),
      ipm_price_c_margin: this.toNumber(record.ipmPriceCMargin),
      ipm_price_d_margin: this.toNumber(record.ipmPriceDMargin),
      ipm_max_price: this.toNumber(record.ipmMaxPrice),
      ipm_min_price: this.toNumber(record.ipmMinPrice),
      ipm_disc_perc: this.toNumber(record.ipmDiscPerc),
      ipm_disc_qty: this.toNumber(record.ipmDiscQty),
      ipm_addl_cess: this.toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: this.toNumber(record.ipmRoundOff),
      ipm_big_unit: record.ipmBigUnit,
      ipm_uom_weight: this.toNumber(record.ipmUomWeight),
      ipm_loading_charge: this.toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: this.toNumber(record.ipmFreightCharge),
      ipm_points: record.ipmPoints,
      ipm_remarks: record.ipmRemarks,
      ipm_is_active: record.ipmIsActive,
      ipm_created_on: record.ipmCreatedOn.toISOString(),
      ipm_created_by: record.ipmCreatedBy,
      ipm_modified_on: record.ipmModifiedOn.toISOString(),
      ipm_modified_by: record.ipmModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private buildDisplayName(record: ItemPriceMaster): string {
    const godownSegment = record.ipmGodownId ?? 'GLOBAL';
    return `${record.ipmItemId}:${record.ipmUnitId}:${godownSegment}`;
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item price already exists', [
          {
            field: 'ipm_item_id',
            message: 'Duplicate item + unit + godown combination is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'ipm_item_id',
            message: 'Referenced item/unit does not exist',
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
            field: 'ipm_unit_rate_id',
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

  private throwNotFound(ipmUnitRateId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item price not found', [
        {
          field: 'ipm_unit_rate_id',
          message: `No item price found with id ${ipmUnitRateId}`,
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
