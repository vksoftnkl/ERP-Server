import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { CustItemRate, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemCustRateQueryDto } from './dto/list-item-cust-rate-query.dto';
import { SaveItemCustRateDto } from './dto/save-item-cust-rate.dto';
import {
  ItemCustRateErrorDetail,
  ItemCustRateListItem,
  ItemCustRateListMeta,
  ItemCustRatePayload,
} from './types/item-cust-rate-api.types';
import { resolvePagination, runConfiguredGridQuery } from 'src/common/utils/module-list.utils';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwMasterBadRequest,
  throwMasterNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../common/request-context/request-context.service';

const ITEM_CUST_RATE_TABLE_NAME = 'cust item rates';
const ITEM_CUST_RATE_AUDIT_SCREEN_NAME = 'Item Customer Rate Master';

@Injectable()
export class ItemsCustRatesMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
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
    const { page, limit, skip } = resolvePagination(queryDto);
    const result = await runConfiguredGridQuery<ItemCustRateListItem>(
      this.configuredGridSqlService,
      { tableName: ITEM_CUST_RATE_TABLE_NAME, alias: 'item_cust_rate_grid', search: queryDto.search, page, limit, skip },
    );
    if (!result) {
      throwMasterBadRequest<ItemCustRateErrorDetail>('No configured grid found for item customer rate list', []);
    }
    return result;
  }

  async getById(csrId: string): Promise<ItemCustRatePayload> {
    const record = await this.prisma.custItemRate.findFirst({
      where: { csrId, csrIsDeleted: false },
    });
    if (!record) {
      this.throwNotFound(csrId);
    }
    return this.toPayload(record);
  }

  async softDelete(csrId: string): Promise<{ csr_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.custItemRate.findFirst({
        where: { csrId, csrIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(csrId);
      }

      const modifiedOn = new Date();
      const modifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const result = await tx.custItemRate.updateMany({
        where: { csrId, csrIsDeleted: false },
        data: { csrIsDeleted: true, csrModifiedOn: modifiedOn, csrModifiedBy: modifiedBy },
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

      return { csr_id: csrId, deleted: true };
    });
  }

  private async createItemCustRate(saveItemCustRateDto: SaveItemCustRateDto): Promise<ItemCustRatePayload> {
    this.validateDateRange(
      this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from') ?? null,
      this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to') ?? null,
    );

    const now = new Date();
    const createdBy = resolveActor(saveItemCustRateDto.csr_created_by, this.requestContextService.getUserId());
    const modifiedBy = resolveActor(saveItemCustRateDto.csr_modified_by, createdBy);
    const data: Prisma.CustItemRateUncheckedCreateInput = {
      csrCustomerId: saveItemCustRateDto.csr_customer_id,
      csrUnitRateId: saveItemCustRateDto.csr_unit_rate_id,
      csrCreatedOn: now,
      csrCreatedBy: createdBy,
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

  private async updateItemCustRate(saveItemCustRateDto: SaveItemCustRateDto): Promise<ItemCustRatePayload> {
    const csrId = saveItemCustRateDto.csr_id!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.custItemRate.findFirst({
          where: { csrId, csrIsDeleted: false },
        });
        if (!existing) {
          this.throwNotFound(csrId);
        }

        const nextValidFrom = hasOwnProperty(saveItemCustRateDto, 'csr_valid_from')
          ? (this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from') ?? null)
          : existing.csrValidFrom;
        const nextValidTo = hasOwnProperty(saveItemCustRateDto, 'csr_valid_to')
          ? (this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to') ?? null)
          : existing.csrValidTo;
        this.validateDateRange(nextValidFrom, nextValidTo);

        const data: Prisma.CustItemRateUncheckedUpdateInput = {
          csrCustomerId: saveItemCustRateDto.csr_customer_id,
          csrUnitRateId: saveItemCustRateDto.csr_unit_rate_id,
          csrModifiedOn: new Date(),
          csrModifiedBy: resolveActor(saveItemCustRateDto.csr_modified_by, this.requestContextService.getUserId()),
        };
        this.applyOptionalFields(data, saveItemCustRateDto);

        const updated = await tx.custItemRate.update({ where: { csrId }, data });
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
            userId: payload.csr_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
    const where: Prisma.CustItemRateWhereInput = { csrIsDeleted: false };

    if (queryDto.csr_branch_id !== undefined) where.csrBranchId = queryDto.csr_branch_id;
    if (queryDto.csr_customer_id !== undefined) where.csrCustomerId = queryDto.csr_customer_id;
    if (queryDto.csr_unit_rate_id !== undefined) where.csrUnitRateId = queryDto.csr_unit_rate_id;
    if (queryDto.csr_rate_type !== undefined) where.csrRateType = queryDto.csr_rate_type;
    if (queryDto.csr_price_level !== undefined) where.csrPriceLevel = queryDto.csr_price_level;
    if (queryDto.csr_is_active !== undefined) where.csrIsActive = queryDto.csr_is_active;

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
    if (hasOwnProperty(saveItemCustRateDto, 'csr_branch_id')) data.csrBranchId = saveItemCustRateDto.csr_branch_id;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_rate_type')) data.csrRateType = saveItemCustRateDto.csr_rate_type;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_item_rate')) data.csrItemRate = saveItemCustRateDto.csr_item_rate;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_disc_perc')) data.csrDiscPerc = saveItemCustRateDto.csr_disc_perc;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_disc_qty')) data.csrDiscQty = saveItemCustRateDto.csr_disc_qty;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_price_level')) data.csrPriceLevel = saveItemCustRateDto.csr_price_level;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_valid_from')) {
      data.csrValidFrom = this.parseOptionalDate(saveItemCustRateDto.csr_valid_from, 'csr_valid_from');
    }
    if (hasOwnProperty(saveItemCustRateDto, 'csr_valid_to')) {
      data.csrValidTo = this.parseOptionalDate(saveItemCustRateDto.csr_valid_to, 'csr_valid_to');
    }
    if (hasOwnProperty(saveItemCustRateDto, 'csr_priority')) data.csrPriority = saveItemCustRateDto.csr_priority;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_is_active')) data.csrIsActive = saveItemCustRateDto.csr_is_active;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_uploaded_at')) {
      data.csrUploadedAt = this.parseOptionalDate(saveItemCustRateDto.csr_uploaded_at, 'csr_uploaded_at');
    }
    if (hasOwnProperty(saveItemCustRateDto, 'csr_uploaded_by')) data.csrUploadedBy = saveItemCustRateDto.csr_uploaded_by;
    if (hasOwnProperty(saveItemCustRateDto, 'csr_remarks')) data.csrRemarks = saveItemCustRateDto.csr_remarks;
  }

  private validateDateRange(validFrom: Date | null, validTo: Date | null): void {
    if (!validFrom || !validTo) return;
    if (validFrom.getTime() > validTo.getTime()) {
      throwMasterBadRequest<ItemCustRateErrorDetail>('Validation failed', [
        { field: 'csr_valid_to', message: 'csr_valid_to must be greater than or equal to csr_valid_from' },
      ]);
    }
  }

  private parseOptionalDate(value: string | null | undefined, fieldName: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwMasterBadRequest<ItemCustRateErrorDetail>('Validation failed', [
        { field: fieldName, message: `${fieldName} must be a valid date` },
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
      csr_item_rate: toNumber(record.csrItemRate),
      csr_disc_perc: toNumber(record.csrDiscPerc),
      csr_disc_qty: toNumber(record.csrDiscQty),
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

  private buildDisplayName(record: CustItemRate): string {
    return `${record.csrCustomerId}:${record.csrUnitRateId}`;
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemCustRateErrorDetail>(error, 'Item customer rate already exists', [
      { field: 'csr_id', message: 'Duplicate item customer rate is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwMasterBadRequest<ItemCustRateErrorDetail>('Invalid relation reference', [
        { field: 'csr_customer_id', message: 'Referenced relation does not exist' },
      ]);
    }
  }

  private throwNotFound(csrId: string): never {
    throwMasterNotFound<ItemCustRateErrorDetail>(
      'Item customer rate not found',
      'csr_id',
      `No active item customer rate found with id ${csrId}`,
    );
  }
}
