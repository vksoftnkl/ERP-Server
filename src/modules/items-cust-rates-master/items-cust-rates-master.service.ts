import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { CustItemRate, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemCustRateQueryDto } from './dto/list-item-cust-rate-query.dto';
import { SaveItemCustRateDto } from './dto/save-item-cust-rate.dto';
import {
  ItemCustRateErrorDetail,
  ItemCustRateErrorResponse,
  ItemCustRateListItem,
  ItemCustRateListMeta,
  ItemCustRatePayload,
} from './types/item-cust-rate-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const ITEM_CUST_RATE_TABLE_NAME = 'cust item rates';
const ITEM_CUST_RATE_AUDIT_SCREEN_NAME = 'Item Customer Rate Master';

@Injectable()
export class ItemsCustRatesMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveItemCustRateDto: SaveItemCustRateDto): Promise<ItemCustRatePayload> {
    if (saveItemCustRateDto.csr_id) {
      return this.updateItemCustRate(saveItemCustRateDto);
    }

    return this.createItemCustRate(saveItemCustRateDto);
  }

  async list(
    queryDto: ListItemCustRateQueryDto,
  ): Promise<ConfiguredGridListResult<ItemCustRateListItem, ItemCustRateListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.csr_branch_id !== undefined ||
      queryDto.csr_customer_id !== undefined ||
      queryDto.csr_unit_rate_id !== undefined ||
      queryDto.csr_rate_type !== undefined ||
      queryDto.csr_price_level !== undefined ||
      queryDto.csr_is_active !== undefined;

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.custItemRate.count({ where }),
      this.prisma.custItemRate.findMany({
        where,
        orderBy: [{ csrPriority: 'desc' }, { csrId: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<ItemCustRateListItem, ItemCustRateListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_CUST_RATE_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_CUST_RATE_TABLE_NAME,
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
        tableName: ITEM_CUST_RATE_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemCustRateListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_cust_rate_grid',
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

  async getById(csrId: string): Promise<ItemCustRatePayload> {
    const record = await this.prisma.custItemRate.findFirst({
      where: {
        csrId,
        csrIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(csrId);
    }

    return this.toPayload(record);
  }

  async softDelete(csrId: string): Promise<{ csr_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.custItemRate.findFirst({
        where: {
          csrId,
          csrIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(csrId);
      }

      const modifiedOn = new Date();
      const modifiedBy = DEFAULT_ACTOR;
      const result = await tx.custItemRate.updateMany({
        where: {
          csrId,
          csrIsDeleted: false,
        },
        data: {
          csrIsDeleted: true,
          csrModifiedOn: modifiedOn,
          csrModifiedBy: modifiedBy,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(csrId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        csrIsDeleted: true,
        csrModifiedOn: modifiedOn,
        csrModifiedBy: modifiedBy,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_CUST_RATE_TABLE_NAME,
          screenName: ITEM_CUST_RATE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: csrId,
          displayName: this.buildDisplayName(existing),
          originalRecord,
          modifiedRecord,
          userId: modifiedBy,
          notes: 'Item customer rate soft deleted',
        },
        tx,
      );

      return {
        csr_id: csrId,
        deleted: true,
      };
    });
  }

  private async createItemCustRate(
    saveItemCustRateDto: SaveItemCustRateDto,
  ): Promise<ItemCustRatePayload> {
    this.validateDateRange(
      this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from') ?? null,
      this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to') ?? null,
    );

    const now = new Date();
    const createdBy = this.resolveActor(saveItemCustRateDto.csr_created_by);
    const modifiedBy = this.resolveActor(saveItemCustRateDto.csr_modified_by, createdBy);
    const data: Prisma.CustItemRateUncheckedCreateInput = {
      csrCustomerId: saveItemCustRateDto.csr_customer_id,
      csrUnitRateId: saveItemCustRateDto.csr_unit_rate_id,
      csrCreatedOn: now,
      csrCreatedBy: createdBy,
      csrModifiedOn: now,
      csrModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveItemCustRateDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.custItemRate.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_CUST_RATE_TABLE_NAME,
            screenName: ITEM_CUST_RATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.csr_id,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Item customer rate created',
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

  private async updateItemCustRate(
    saveItemCustRateDto: SaveItemCustRateDto,
  ): Promise<ItemCustRatePayload> {
    const csrId = saveItemCustRateDto.csr_id!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.custItemRate.findFirst({
          where: {
            csrId,
            csrIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(csrId);
        }

        const nextValidFrom = this.hasOwnProperty(saveItemCustRateDto, 'csr_valid_from')
          ? (this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from') ?? null)
          : existing.csrValidFrom;
        const nextValidTo = this.hasOwnProperty(saveItemCustRateDto, 'csr_valid_to')
          ? (this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to') ?? null)
          : existing.csrValidTo;
        this.validateDateRange(nextValidFrom, nextValidTo);

        const data: Prisma.CustItemRateUncheckedUpdateInput = {
          csrCustomerId: saveItemCustRateDto.csr_customer_id,
          csrUnitRateId: saveItemCustRateDto.csr_unit_rate_id,
          csrModifiedOn: new Date(),
          csrModifiedBy: this.resolveActor(saveItemCustRateDto.csr_modified_by),
        };
        this.applyOptionalFields(data, saveItemCustRateDto);

        const updated = await tx.custItemRate.update({
          where: {
            csrId,
          },
          data,
        });

        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_CUST_RATE_TABLE_NAME,
            screenName: ITEM_CUST_RATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: csrId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.csr_modified_by ?? DEFAULT_ACTOR,
            notes: 'Item customer rate updated',
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

  private buildListWhere(queryDto: ListItemCustRateQueryDto): Prisma.CustItemRateWhereInput {
    const where: Prisma.CustItemRateWhereInput = {
      csrIsDeleted: false,
    };

    if (queryDto.csr_branch_id !== undefined) {
      where.csrBranchId = queryDto.csr_branch_id;
    }

    if (queryDto.csr_customer_id !== undefined) {
      where.csrCustomerId = queryDto.csr_customer_id;
    }

    if (queryDto.csr_unit_rate_id !== undefined) {
      where.csrUnitRateId = queryDto.csr_unit_rate_id;
    }

    if (queryDto.csr_rate_type !== undefined) {
      where.csrRateType = queryDto.csr_rate_type;
    }

    if (queryDto.csr_price_level !== undefined) {
      where.csrPriceLevel = queryDto.csr_price_level;
    }

    if (queryDto.csr_is_active !== undefined) {
      where.csrIsActive = queryDto.csr_is_active;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { csrRateType: { contains: search, mode: 'insensitive' } },
        { csrPriceLevel: { contains: search, mode: 'insensitive' } },
        { csrRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private applyOptionalFields(
    data: Prisma.CustItemRateUncheckedCreateInput | Prisma.CustItemRateUncheckedUpdateInput,
    saveItemCustRateDto: SaveItemCustRateDto,
  ): void {
    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_branch_id')) {
      data.csrBranchId = saveItemCustRateDto.csr_branch_id;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_rate_type')) {
      data.csrRateType = saveItemCustRateDto.csr_rate_type;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_item_rate')) {
      data.csrItemRate = saveItemCustRateDto.csr_item_rate;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_disc_perc')) {
      data.csrDiscPerc = saveItemCustRateDto.csr_disc_perc;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_disc_qty')) {
      data.csrDiscQty = saveItemCustRateDto.csr_disc_qty;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_price_level')) {
      data.csrPriceLevel = saveItemCustRateDto.csr_price_level;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_valid_from')) {
      data.csrValidFrom = this.parseOptionalDate(
        saveItemCustRateDto.csr_valid_from,
        'csr_valid_from',
      );
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_valid_to')) {
      data.csrValidTo = this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to');
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_priority')) {
      data.csrPriority = saveItemCustRateDto.csr_priority;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_is_active')) {
      data.csrIsActive = saveItemCustRateDto.csr_is_active;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_uploaded_at')) {
      data.csrUploadedAt = this.parseOptionalDate(
        saveItemCustRateDto.csr_uploaded_at,
        'csr_uploaded_at',
      );
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_uploaded_by')) {
      data.csrUploadedBy = saveItemCustRateDto.csr_uploaded_by;
    }

    if (this.hasOwnProperty(saveItemCustRateDto, 'csr_remarks')) {
      data.csrRemarks = saveItemCustRateDto.csr_remarks;
    }
  }

  private validateDateRange(validFrom: Date | null, validTo: Date | null): void {
    if (!validFrom || !validTo) {
      return;
    }

    if (validFrom.getTime() > validTo.getTime()) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'csr_valid_to',
          message: 'csr_valid_to must be greater than or equal to csr_valid_from',
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

  private toPayload(record: CustItemRate): ItemCustRatePayload {
    return {
      csr_id: record.csrId,
      csr_branch_id: record.csrBranchId,
      csr_customer_id: record.csrCustomerId,
      csr_unit_rate_id: record.csrUnitRateId,
      csr_rate_type: record.csrRateType,
      csr_item_rate: this.toNumber(record.csrItemRate),
      csr_disc_perc: this.toNumber(record.csrDiscPerc),
      csr_disc_qty: this.toNumber(record.csrDiscQty),
      csr_price_level: record.csrPriceLevel,
      csr_valid_from: record.csrValidFrom ? record.csrValidFrom.toISOString() : null,
      csr_valid_to: record.csrValidTo ? record.csrValidTo.toISOString() : null,
      csr_priority: record.csrPriority,
      csr_is_active: record.csrIsActive,
      csr_is_deleted: record.csrIsDeleted,
      csr_created_on: record.csrCreatedOn.toISOString(),
      csr_created_by: record.csrCreatedBy,
      csr_modified_on: record.csrModifiedOn.toISOString(),
      csr_modified_by: record.csrModifiedBy,
      csr_uploaded_at: record.csrUploadedAt ? record.csrUploadedAt.toISOString() : null,
      csr_uploaded_by: record.csrUploadedBy,
      csr_remarks: record.csrRemarks,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private buildDisplayName(record: CustItemRate): string {
    return `${record.csrCustomerId}:${record.csrUnitRateId}`;
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item customer rate already exists', [
          {
            field: 'csr_id',
            message: 'Duplicate item customer rate is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'csr_customer_id',
            message: 'Referenced relation does not exist',
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

  private throwNotFound(csrId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item customer rate not found', [
        {
          field: 'csr_id',
          message: `No active item customer rate found with id ${csrId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemCustRateErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemCustRateErrorDetail[] = [],
  ): ItemCustRateErrorResponse {
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
