import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvtVoucherTypeMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListAccountVoucherTypeQueryDto } from './dto/list-account-voucher-type-query.dto';
import { SaveAccountVoucherTypeDto } from './dto/save-account-voucher-type.dto';
import {
  AccountVoucherTypeErrorDetail,
  AccountVoucherTypeErrorResponse,
  AccountVoucherTypeListItem,
  AccountVoucherTypeListMeta,
  AccountVoucherTypePayload,
} from './types/account-voucher-type-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ACCOUNT_VOUCHER_TYPE_TABLE_NAME = 'avt_voucher_type_master';
const ACCOUNT_VOUCHER_TYPE_AUDIT_SCREEN_NAME = 'Account Voucher Type Master';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;

type AccountVoucherTypeWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AccountVoucherTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(
    saveAccountVoucherTypeDto: SaveAccountVoucherTypeDto,
  ): Promise<AccountVoucherTypePayload> {
    if (saveAccountVoucherTypeDto.avtId) {
      return this.updateAccountVoucherType(saveAccountVoucherTypeDto);
    }

    return this.createAccountVoucherType(saveAccountVoucherTypeDto);
  }

  async list(
    queryDto: ListAccountVoucherTypeQueryDto,
  ): Promise<{ items: AccountVoucherTypeListItem[]; meta: AccountVoucherTypeListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.avtIsActive !== undefined || Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.AvtVoucherTypeMasterWhereInput = {
      avtIsDeleted: false,
    };

    if (queryDto.avtIsActive !== undefined) {
      where.avtIsActive = queryDto.avtIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { avtShort: { contains: search, mode: 'insensitive' } },
        { avtDesc: { contains: search, mode: 'insensitive' } },
        { avtTallyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.avtVoucherTypeMaster.count({ where }),
      this.prisma.avtVoucherTypeMaster.findMany({
        where,
        orderBy: [{ avtSortOrder: 'asc' }, { avtShort: 'asc' }],
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
  ): Promise<{ items: AccountVoucherTypeListItem[]; meta: AccountVoucherTypeListMeta } | null> {
    const configuredGrid = await this.prisma.gridDetails.findFirst({
      where: {
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
          contains: ACCOUNT_VOUCHER_TYPE_TABLE_NAME,
          mode: 'insensitive',
        },
      },
      orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
      select: {
        gridSql: true,
      },
    });

    const rawGridSql = configuredGrid?.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }

    try {
      const baseSql = this.validateConfiguredGridSql(rawGridSql);
      const countSql = `SELECT COUNT(*)::bigint AS total FROM (${baseSql}) AS account_voucher_type_grid`;
      const rowsSql = `SELECT * FROM (${baseSql}) AS account_voucher_type_grid LIMIT $1 OFFSET $2`;
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(countSql),
        this.prisma.$queryRawUnsafe<AccountVoucherTypeListItem[]>(rowsSql, limit, skip),
      ]);
      const total = this.parseCountValue(countResult[0]?.total);

      return {
        items: rows,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch {
      return null;
    }
  }

  private validateConfiguredGridSql(sql: string): string {
    const normalized = sql.trim().replace(/;+\s*$/g, '');
    if (!/^select\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for account voucher type list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }

    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for account voucher type list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }

    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for account voucher type list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }

    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for account voucher type list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }

    if (!/\bavt_voucher_type_master\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for account voucher type list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference avt_voucher_type_master table',
        },
      ]);
    }

    return normalized;
  }

  private parseCountValue(value: bigint | number | string | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  async getById(avtId: string): Promise<AccountVoucherTypePayload> {
    const record = await this.prisma.avtVoucherTypeMaster.findFirst({
      where: {
        avtId,
        avtIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(avtId);
    }

    return this.toPayload(record);
  }

  async softDelete(avtId: string): Promise<{ avtId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.avtVoucherTypeMaster.findFirst({
        where: {
          avtId,
          avtIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(avtId);
      }

      const modifiedOn = new Date();
      const result = await tx.avtVoucherTypeMaster.updateMany({
        where: {
          avtId,
          avtIsDeleted: false,
        },
        data: {
          avtIsDeleted: true,
          avtIsActive: false,
          avtModifiedOn: modifiedOn,
          avtModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(avtId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        avtIsDeleted: true,
        avtIsActive: false,
        avtModifiedOn: modifiedOn,
        avtModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ACCOUNT_VOUCHER_TYPE_TABLE_NAME,
          screenName: ACCOUNT_VOUCHER_TYPE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: avtId,
          displayName: existing.avtShort,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Account voucher type soft deleted',
        },
        tx,
      );

      return {
        avtId,
        deleted: true,
      };
    });
  }

  private async createAccountVoucherType(
    saveAccountVoucherTypeDto: SaveAccountVoucherTypeDto,
  ): Promise<AccountVoucherTypePayload> {
    const normalizedShort = this.normalizeRequiredText(
      saveAccountVoucherTypeDto.avtShort,
      'avtShort',
    );
    const normalizedDesc = this.normalizeRequiredText(saveAccountVoucherTypeDto.avtDesc, 'avtDesc');
    const normalizedTallyName = this.normalizeRequiredText(
      saveAccountVoucherTypeDto.avtTallyName,
      'avtTallyName',
    );
    const now = new Date();
    const createdBy = this.resolveActor(saveAccountVoucherTypeDto.avtCreatedBy);
    const modifiedBy = this.resolveActor(saveAccountVoucherTypeDto.avtModifiedBy, createdBy);
    const data: Prisma.AvtVoucherTypeMasterUncheckedCreateInput = {
      avtShort: normalizedShort,
      avtDesc: normalizedDesc,
      avtTallyName: normalizedTallyName,
      avtCreatedOn: now,
      avtCreatedBy: createdBy,
      avtModifiedOn: now,
      avtModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveAccountVoucherTypeDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureShortIsUnique(tx, normalizedShort);

        const created = await tx.avtVoucherTypeMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ACCOUNT_VOUCHER_TYPE_TABLE_NAME,
            screenName: ACCOUNT_VOUCHER_TYPE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.avtId,
            displayName: payload.avtShort,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Account voucher type created',
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

  private async updateAccountVoucherType(
    saveAccountVoucherTypeDto: SaveAccountVoucherTypeDto,
  ): Promise<AccountVoucherTypePayload> {
    const avtId = saveAccountVoucherTypeDto.avtId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.avtVoucherTypeMaster.findFirst({
          where: {
            avtId,
            avtIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(avtId);
        }

        const normalizedShort = this.normalizeRequiredText(
          saveAccountVoucherTypeDto.avtShort,
          'avtShort',
        );
        const normalizedDesc = this.normalizeRequiredText(
          saveAccountVoucherTypeDto.avtDesc,
          'avtDesc',
        );
        const normalizedTallyName = this.normalizeRequiredText(
          saveAccountVoucherTypeDto.avtTallyName,
          'avtTallyName',
        );

        await this.ensureShortIsUnique(tx, normalizedShort, avtId);

        const data: Prisma.AvtVoucherTypeMasterUncheckedUpdateInput = {
          avtShort: normalizedShort,
          avtDesc: normalizedDesc,
          avtTallyName: normalizedTallyName,
          avtModifiedOn: new Date(),
          avtModifiedBy: this.resolveActor(saveAccountVoucherTypeDto.avtModifiedBy),
        };
        this.applyOptionalFields(data, saveAccountVoucherTypeDto);

        const updated = await tx.avtVoucherTypeMaster.update({
          where: {
            avtId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ACCOUNT_VOUCHER_TYPE_TABLE_NAME,
            screenName: ACCOUNT_VOUCHER_TYPE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: avtId,
            displayName: payload.avtShort,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.avtModifiedBy,
            notes: 'Account voucher type updated',
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

  private async ensureShortIsUnique(
    tx: AccountVoucherTypeWriteClient,
    voucherShort: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.avtVoucherTypeMaster.findFirst({
      where: {
        avtIsDeleted: false,
        avtShort: {
          equals: voucherShort,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              avtId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        avtId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Voucher short name already exists', [
          {
            field: 'avtShort',
            message: 'Duplicate avtShort is not allowed',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data:
      | Prisma.AvtVoucherTypeMasterUncheckedCreateInput
      | Prisma.AvtVoucherTypeMasterUncheckedUpdateInput,
    saveAccountVoucherTypeDto: SaveAccountVoucherTypeDto,
  ): void {
    if (this.hasOwnProperty(saveAccountVoucherTypeDto, 'avtDrcr')) {
      data.avtDrcr = saveAccountVoucherTypeDto.avtDrcr;
    }

    if (this.hasOwnProperty(saveAccountVoucherTypeDto, 'avtPrintEnabled')) {
      data.avtPrintEnabled = saveAccountVoucherTypeDto.avtPrintEnabled;
    }

    if (this.hasOwnProperty(saveAccountVoucherTypeDto, 'avtPrintStyle')) {
      data.avtPrintStyle = saveAccountVoucherTypeDto.avtPrintStyle;
    }

    if (this.hasOwnProperty(saveAccountVoucherTypeDto, 'avtSortOrder')) {
      data.avtSortOrder = saveAccountVoucherTypeDto.avtSortOrder;
    }

    if (this.hasOwnProperty(saveAccountVoucherTypeDto, 'avtTallyReservedType')) {
      data.avtTallyReservedType = saveAccountVoucherTypeDto.avtTallyReservedType;
    }

    if (this.hasOwnProperty(saveAccountVoucherTypeDto, 'avtIsActive')) {
      data.avtIsActive = saveAccountVoucherTypeDto.avtIsActive;
    }
  }

  private normalizeRequiredText(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: fieldName,
          message: `${fieldName} must not be empty`,
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: AvtVoucherTypeMaster): AccountVoucherTypePayload {
    return {
      avtId: record.avtId,
      avtShort: record.avtShort,
      avtDesc: record.avtDesc,
      avtDrcr: record.avtDrcr,
      avtPrintEnabled: record.avtPrintEnabled,
      avtPrintStyle: record.avtPrintStyle,
      avtSortOrder: record.avtSortOrder,
      avtTallyName: record.avtTallyName,
      avtTallyReservedType: record.avtTallyReservedType,
      avtIsActive: record.avtIsActive,
      avtIsDeleted: record.avtIsDeleted,
      avtSyncDate: record.avtSyncDate ? record.avtSyncDate.toISOString() : null,
      avtCreatedOn: record.avtCreatedOn.toISOString(),
      avtCreatedBy: record.avtCreatedBy,
      avtModifiedOn: record.avtModifiedOn.toISOString(),
      avtModifiedBy: record.avtModifiedBy,
    };
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    if (!value) {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Account voucher type already exists', [
          {
            field: 'avtShort',
            message: 'Duplicate avtShort is not allowed',
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

  private throwNotFound(avtId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Account voucher type not found', [
        {
          field: 'avtId',
          message: `No active account voucher type found with id ${avtId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: AccountVoucherTypeErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: AccountVoucherTypeErrorDetail[] = [],
  ): AccountVoucherTypeErrorResponse {
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
