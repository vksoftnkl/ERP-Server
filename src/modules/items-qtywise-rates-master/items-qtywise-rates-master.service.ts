import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemQtywiseRate, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemQtywiseRateQueryDto } from './dto/list-item-qtywise-rate-query.dto';
import { SaveItemQtywiseRateDto } from './dto/save-item-qtywise-rate.dto';
import {
  ItemQtywiseRateErrorDetail,
  ItemQtywiseRateErrorResponse,
  ItemQtywiseRateListItem,
  ItemQtywiseRateListMeta,
  ItemQtywiseRatePayload,
} from './types/item-qtywise-rate-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const ITEM_QTYWISE_RATE_TABLE_NAME = 'item qtywise rates';
const ITEM_QTYWISE_RATE_AUDIT_SCREEN_NAME = 'Item Qtywise Rate Master';

@Injectable()
export class ItemsQtywiseRatesMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveItemQtywiseRateDto: SaveItemQtywiseRateDto): Promise<ItemQtywiseRatePayload> {
    if (saveItemQtywiseRateDto.iqr_id) {
      return this.updateItemQtywiseRate(saveItemQtywiseRateDto);
    }

    return this.createItemQtywiseRate(saveItemQtywiseRateDto);
  }

  async list(
    queryDto: ListItemQtywiseRateQueryDto,
  ): Promise<ConfiguredGridListResult<ItemQtywiseRateListItem, ItemQtywiseRateListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.iqr_branch_id !== undefined ||
      queryDto.iqr_unit_rate_id !== undefined ||
      queryDto.iqr_price_level !== undefined ||
      queryDto.iqr_is_active !== undefined;

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.itemQtywiseRate.count({ where }),
      this.prisma.itemQtywiseRate.findMany({
        where,
        orderBy: [{ iqrPriority: 'desc' }, { iqrId: 'asc' }],
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
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<ItemQtywiseRateListItem, ItemQtywiseRateListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_QTYWISE_RATE_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_QTYWISE_RATE_TABLE_NAME,
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
        tableName: ITEM_QTYWISE_RATE_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemQtywiseRateListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_qtywise_rate_grid',
          search,
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

  async getById(iqrId: string): Promise<ItemQtywiseRatePayload> {
    const record = await this.prisma.itemQtywiseRate.findFirst({
      where: {
        iqrId,
        iqrIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(iqrId);
    }

    return this.toPayload(record);
  }

  async softDelete(iqrId: string): Promise<{ iqr_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.itemQtywiseRate.findFirst({
        where: {
          iqrId,
          iqrIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(iqrId);
      }

      const modifiedOn = new Date();
      const modifiedBy = DEFAULT_ACTOR;
      const result = await tx.itemQtywiseRate.updateMany({
        where: {
          iqrId,
          iqrIsDeleted: false,
        },
        data: {
          iqrIsDeleted: true,
          iqrModifiedOn: modifiedOn,
          iqrModifiedBy: modifiedBy,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(iqrId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        iqrIsDeleted: true,
        iqrModifiedOn: modifiedOn,
        iqrModifiedBy: modifiedBy,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_QTYWISE_RATE_TABLE_NAME,
          screenName: ITEM_QTYWISE_RATE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: iqrId,
          displayName: this.buildDisplayName(existing),
          originalRecord,
          modifiedRecord,
          userId: modifiedBy,
          notes: 'Item qty-wise rate soft deleted',
        },
        tx,
      );

      return {
        iqr_id: iqrId,
        deleted: true,
      };
    });
  }

  private async createItemQtywiseRate(
    saveItemQtywiseRateDto: SaveItemQtywiseRateDto,
  ): Promise<ItemQtywiseRatePayload> {
    const startQty = saveItemQtywiseRateDto.iqr_start_qty;
    const endQty = saveItemQtywiseRateDto.iqr_end_qty ?? null;
    this.validateQuantityRange(startQty, endQty);
    this.validateDateRange(
      this.parseOptionalDate(saveItemQtywiseRateDto.iqr_valid_from, 'iqr_valid_from') ?? null,
      this.parseOptionalDate(saveItemQtywiseRateDto.iqr_valid_to, 'iqr_valid_to') ?? null,
    );

    const now = new Date();
    const createdBy = this.resolveActor(saveItemQtywiseRateDto.iqr_created_by);
    const modifiedBy = this.resolveActor(saveItemQtywiseRateDto.iqr_modified_by, createdBy);
    const data: Prisma.ItemQtywiseRateUncheckedCreateInput = {
      iqrUnitRateId: saveItemQtywiseRateDto.iqr_unit_rate_id,
      iqrPriceLevel: saveItemQtywiseRateDto.iqr_price_level,
      iqrStartQty: startQty,
      iqrEachQty: saveItemQtywiseRateDto.iqr_each_qty,
      iqrCreatedOn: now,
      iqrCreatedBy: createdBy,
      iqrModifiedOn: now,
      iqrModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveItemQtywiseRateDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.itemQtywiseRate.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_QTYWISE_RATE_TABLE_NAME,
            screenName: ITEM_QTYWISE_RATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.iqr_id,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Item qty-wise rate created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateItemQtywiseRate(
    saveItemQtywiseRateDto: SaveItemQtywiseRateDto,
  ): Promise<ItemQtywiseRatePayload> {
    const iqrId = saveItemQtywiseRateDto.iqr_id!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemQtywiseRate.findFirst({
          where: {
            iqrId,
            iqrIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(iqrId);
        }

        const nextStartQty = saveItemQtywiseRateDto.iqr_start_qty;
        const nextEndQty = this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_end_qty')
          ? (saveItemQtywiseRateDto.iqr_end_qty ?? null)
          : this.toNullableNumber(existing.iqrEndQty);
        this.validateQuantityRange(nextStartQty, nextEndQty);

        const nextValidFrom = this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_valid_from')
          ? (this.parseOptionalDate(saveItemQtywiseRateDto.iqr_valid_from, 'iqr_valid_from') ??
            null)
          : existing.iqrValidFrom;
        const nextValidTo = this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_valid_to')
          ? (this.parseOptionalDate(saveItemQtywiseRateDto.iqr_valid_to, 'iqr_valid_to') ?? null)
          : existing.iqrValidTo;
        this.validateDateRange(nextValidFrom, nextValidTo);

        const data: Prisma.ItemQtywiseRateUncheckedUpdateInput = {
          iqrUnitRateId: saveItemQtywiseRateDto.iqr_unit_rate_id,
          iqrPriceLevel: saveItemQtywiseRateDto.iqr_price_level,
          iqrStartQty: saveItemQtywiseRateDto.iqr_start_qty,
          iqrEachQty: saveItemQtywiseRateDto.iqr_each_qty,
          iqrModifiedOn: new Date(),
          iqrModifiedBy: this.resolveActor(saveItemQtywiseRateDto.iqr_modified_by),
        };
        this.applyOptionalFields(data, saveItemQtywiseRateDto);

        const updated = await tx.itemQtywiseRate.update({
          where: {
            iqrId,
          },
          data,
        });

        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_QTYWISE_RATE_TABLE_NAME,
            screenName: ITEM_QTYWISE_RATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: iqrId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.iqr_modified_by ?? DEFAULT_ACTOR,
            notes: 'Item qty-wise rate updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private buildListWhere(queryDto: ListItemQtywiseRateQueryDto): Prisma.ItemQtywiseRateWhereInput {
    const where: Prisma.ItemQtywiseRateWhereInput = {
      iqrIsDeleted: false,
    };

    if (queryDto.iqr_branch_id !== undefined) {
      where.iqrBranchId = queryDto.iqr_branch_id;
    }

    if (queryDto.iqr_unit_rate_id !== undefined) {
      where.iqrUnitRateId = queryDto.iqr_unit_rate_id;
    }

    if (queryDto.iqr_price_level !== undefined) {
      where.iqrPriceLevel = queryDto.iqr_price_level;
    }

    if (queryDto.iqr_is_active !== undefined) {
      where.iqrIsActive = queryDto.iqr_is_active;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      const numericSearch = Number(search);
      where.OR = [
        { iqrRemarks: { contains: search, mode: 'insensitive' } },
        ...(Number.isFinite(numericSearch) ? [{ iqrPriceLevel: numericSearch }] : []),
      ];
    }

    return where;
  }

  private applyOptionalFields(
    data: Prisma.ItemQtywiseRateUncheckedCreateInput | Prisma.ItemQtywiseRateUncheckedUpdateInput,
    saveItemQtywiseRateDto: SaveItemQtywiseRateDto,
  ): void {
    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_branch_id')) {
      data.iqrBranchId = saveItemQtywiseRateDto.iqr_branch_id;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_end_qty')) {
      data.iqrEndQty = saveItemQtywiseRateDto.iqr_end_qty;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_sales_price')) {
      data.iqrSalesPrice = saveItemQtywiseRateDto.iqr_sales_price;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_price_wot')) {
      data.iqrPriceWot = saveItemQtywiseRateDto.iqr_price_wot;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_price_margin')) {
      data.iqrPriceMargin = saveItemQtywiseRateDto.iqr_price_margin;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_disc_perc')) {
      data.iqrDiscPerc = saveItemQtywiseRateDto.iqr_disc_perc;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_disc_qty')) {
      data.iqrDiscQty = saveItemQtywiseRateDto.iqr_disc_qty;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_valid_from')) {
      data.iqrValidFrom = this.parseOptionalDate(
        saveItemQtywiseRateDto.iqr_valid_from,
        'iqr_valid_from',
      );
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_valid_to')) {
      data.iqrValidTo = this.parseOptionalDate(saveItemQtywiseRateDto.iqr_valid_to, 'iqr_valid_to');
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_priority')) {
      data.iqrPriority = saveItemQtywiseRateDto.iqr_priority;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_is_active')) {
      data.iqrIsActive = saveItemQtywiseRateDto.iqr_is_active;
    }

    if (this.hasOwnProperty(saveItemQtywiseRateDto, 'iqr_remarks')) {
      data.iqrRemarks = saveItemQtywiseRateDto.iqr_remarks;
    }
  }

  private validateQuantityRange(startQty: number, endQty: number | null): void {
    if (endQty === null) {
      return;
    }

    if (startQty > endQty) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'iqr_end_qty',
          message: 'iqr_end_qty must be greater than or equal to iqr_start_qty',
        },
      ]);
    }
  }

  private validateDateRange(validFrom: Date | null, validTo: Date | null): void {
    if (!validFrom || !validTo) {
      return;
    }

    if (validFrom.getTime() > validTo.getTime()) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'iqr_valid_to',
          message: 'iqr_valid_to must be greater than or equal to iqr_valid_from',
        },
      ]);
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

  private toPayload(record: ItemQtywiseRate): ItemQtywiseRatePayload {
    return {
      iqr_id: record.iqrId,
      iqr_branch_id: record.iqrBranchId,
      iqr_unit_rate_id: record.iqrUnitRateId,
      iqr_price_level: record.iqrPriceLevel,
      iqr_start_qty: this.toNumber(record.iqrStartQty),
      iqr_end_qty: this.toNullableNumber(record.iqrEndQty),
      iqr_each_qty: this.toNumber(record.iqrEachQty),
      iqr_sales_price: this.toNumber(record.iqrSalesPrice),
      iqr_price_wot: this.toNumber(record.iqrPriceWot),
      iqr_price_margin: this.toNumber(record.iqrPriceMargin),
      iqr_disc_perc: this.toNumber(record.iqrDiscPerc),
      iqr_disc_qty: this.toNumber(record.iqrDiscQty),
      iqr_valid_from: record.iqrValidFrom ? record.iqrValidFrom.toISOString() : null,
      iqr_valid_to: record.iqrValidTo ? record.iqrValidTo.toISOString() : null,
      iqr_priority: record.iqrPriority,
      iqr_is_active: record.iqrIsActive,
      iqr_is_deleted: record.iqrIsDeleted,
      iqr_created_on: record.iqrCreatedOn.toISOString(),
      iqr_created_by: record.iqrCreatedBy,
      iqr_modified_on: record.iqrModifiedOn.toISOString(),
      iqr_modified_by: record.iqrModifiedBy,
      iqr_remarks: record.iqrRemarks,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return this.toNumber(value);
  }

  private buildDisplayName(record: ItemQtywiseRate): string {
    const endQty = this.toNullableNumber(record.iqrEndQty) ?? 'MAX';
    return `${record.iqrUnitRateId}:L${record.iqrPriceLevel}:${this.toNumber(
      record.iqrStartQty,
    )}-${endQty}`;
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item qty-wise rate already exists', [
          {
            field: 'iqr_id',
            message: 'Duplicate item qty-wise rate is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'iqr_unit_rate_id',
            message: 'Referenced unit rate does not exist',
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

  private throwNotFound(iqrId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item qty-wise rate not found', [
        {
          field: 'iqr_id',
          message: `No active item qty-wise rate found with id ${iqrId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemQtywiseRateErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemQtywiseRateErrorDetail[] = [],
  ): ItemQtywiseRateErrorResponse {
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
