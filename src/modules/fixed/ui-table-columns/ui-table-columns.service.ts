import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { Prisma, UitableColumns } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListUiTableColumnQueryDto } from './dto/list-ui-table-column-query.dto';
import { SaveUiTableColumnDto } from './dto/save-ui-table-column.dto';
import {
  UiTableColumnErrorDetail,
  UiTableColumnErrorResponse,
  UiTableColumnListItem,
  UiTableColumnListMeta,
  UiTableColumnPayload,
} from './types/ui-table-column-api.types';
import {
  DEFAULT_ACTOR,
  FixedWriteClient,
  applyPresentFields,
  isForeignKeyConstraintError,
  resolveActor,
  throwFixedBadRequest,
  throwFixedNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery, runFixedListQuery } from 'src/common/utils/module-list.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const UI_TABLE_COLUMNS_TABLE_NAME = 'ui table columns';
const UI_TABLE_COLUMNS_AUDIT_SCREEN_NAME = 'UI Table Columns';
const UI_TABLE_COLUMN_OPTIONAL_FIELDS = [
  'uiTblClmColumnWidth',
  'uiTblClmColumnVisibility',
  'uiTblClmColumnFocus',
  'uiTblClmColumnPosition',
  'uiTblClmColumnNecessity',
  'uiTblClmNextColumn',
  'uiTblClmPreviousColumn',
  'uiTblClmIsActive',
];

@Injectable()
export class UiTableColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveUiTableColumnDto: SaveUiTableColumnDto): Promise<UiTableColumnPayload> {
    if (saveUiTableColumnDto.uiTblClmId) {
      return this.updateUiTableColumn(saveUiTableColumnDto);
    }
    return this.createUiTableColumn(saveUiTableColumnDto);
  }

  async list(
    queryDto: ListUiTableColumnQueryDto,
  ): Promise<ConfiguredGridListResult<UiTableColumnListItem, UiTableColumnListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const tableId = queryDto.uiTblClmTableId
      ? BigInt(queryDto.uiTblClmTableId)
      : undefined;
    const where = {
      uiTblClmIsDeleted: false,
      ...(tableId !== undefined && { uiTblClmTableId: tableId }),
      ...(queryDto.uiTblClmIsActive !== undefined && { uiTblClmIsActive: queryDto.uiTblClmIsActive }),
      ...(queryDto.uiTblClmColumnVisibility !== undefined && { uiTblClmColumnVisibility: queryDto.uiTblClmColumnVisibility }),
      ...(queryDto.uiTblClmColumnFocus !== undefined && { uiTblClmColumnFocus: queryDto.uiTblClmColumnFocus }),
      ...(queryDto.uiTblClmColumnNecessity !== undefined && { uiTblClmColumnNecessity: queryDto.uiTblClmColumnNecessity }),
    };
    return runFixedListQuery<UitableColumns, UiTableColumnListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<UiTableColumnListItem>(
            this.configuredGridSqlService,
            { tableName: UI_TABLE_COLUMNS_TABLE_NAME, alias: 'ui_table_columns_grid', search: queryDto.search, page, limit, skip },
          ),
        countFn: () => this.prisma.uitableColumns.count({ where }),
        findManyFn: () =>
          this.prisma.uitableColumns.findMany({
            where,
            orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(uiTblClmId: string): Promise<UiTableColumnPayload> {
    const parsedUiTblClmId = this.parseBigIntId('uiTblClmId', uiTblClmId);
    const record = await this.prisma.uitableColumns.findFirst({
      where: { uiTblClmId: parsedUiTblClmId, uiTblClmIsDeleted: false },
    });
    if (!record) {
      throwFixedNotFound<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
        'UI table column not found',
        'uiTblClmId',
        `No active UI table column found with id ${uiTblClmId}`,
      );
    }
    return this.toPayload(record);
  }

  async softDelete(uiTblClmId: string): Promise<{ uiTblClmId: string; deleted: true }> {
    const parsedUiTblClmId = this.parseBigIntId('uiTblClmId', uiTblClmId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.uitableColumns.findFirst({
        where: { uiTblClmId: parsedUiTblClmId, uiTblClmIsDeleted: false },
      });
      if (!existing) {
        throwFixedNotFound<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
          'UI table column not found',
          'uiTblClmId',
          `No active UI table column found with id ${uiTblClmId}`,
        );
      }
      const modifiedOn = new Date();
      const result = await tx.uitableColumns.updateMany({
        where: { uiTblClmId: parsedUiTblClmId, uiTblClmIsDeleted: false },
        data: {
          uiTblClmIsDeleted: true,
          uiTblClmIsActive: false,
          uiTblClmModifiedOn: modifiedOn,
          uiTblClmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwFixedNotFound<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
          'UI table column not found',
          'uiTblClmId',
          `No active UI table column found with id ${uiTblClmId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        uiTblClmIsDeleted: true,
        uiTblClmIsActive: false,
        uiTblClmModifiedOn: modifiedOn,
        uiTblClmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: UI_TABLE_COLUMNS_TABLE_NAME,
          screenName: UI_TABLE_COLUMNS_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: uiTblClmId,
          displayName: this.resolveDisplayName(existing.uiTblClmName, uiTblClmId),
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'UI table column soft deleted',
        },
        tx,
      );
      return { uiTblClmId, deleted: true };
    });
  }

  private async createUiTableColumn(
    saveUiTableColumnDto: SaveUiTableColumnDto,
  ): Promise<UiTableColumnPayload> {
    const normalizedName = this.normalizeRequiredName(saveUiTableColumnDto.uiTblClmName);
    const parsedUiTblClmNo = this.parseNullableBigIntId('uiTblClmNo', saveUiTableColumnDto.uiTblClmNo);
    const parsedUiTblClmTableId = this.parseNullableBigIntId('uiTblClmTableId', saveUiTableColumnDto.uiTblClmTableId);
    const now = new Date();
    const createdBy = resolveActor(saveUiTableColumnDto.uiTblClmCreatedBy, this.requestContextService.getUserId());
    const modifiedBy = resolveActor(saveUiTableColumnDto.uiTblClmModifiedBy, createdBy);
    const data: Prisma.UitableColumnsUncheckedCreateInput = {
      uiTblClmName: normalizedName,
      uiTblClmCreatedOn: now,
      uiTblClmCreatedBy: createdBy,
    };
    applyPresentFields(data, saveUiTableColumnDto, UI_TABLE_COLUMN_OPTIONAL_FIELDS);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureUiTableExists(parsedUiTblClmTableId, saveUiTableColumnDto.uiTblClmTableId, tx);
        this.assignUiTableColumnNo(data, parsedUiTblClmNo);
        this.assignUiTableColumnTableId(data, parsedUiTblClmTableId);
        const created = await tx.uitableColumns.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: UI_TABLE_COLUMNS_TABLE_NAME,
            screenName: UI_TABLE_COLUMNS_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.uiTblClmId,
            displayName: this.resolveDisplayName(payload.uiTblClmName, payload.uiTblClmId),
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'UI table column created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
        error,
        'UI table column already exists',
        [{ field: 'uiTblClmName', message: 'Duplicate uiTblClmName is not allowed' }],
      );
      if (isForeignKeyConstraintError(error)) {
        throwFixedBadRequest<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
          'Invalid relation reference',
          [{ field: 'uiTblClmTableId', message: 'Referenced UI table does not exist' }],
        );
      }
      throw error;
    }
  }

  private async updateUiTableColumn(
    saveUiTableColumnDto: SaveUiTableColumnDto,
  ): Promise<UiTableColumnPayload> {
    const uiTblClmId = saveUiTableColumnDto.uiTblClmId!;
    const parsedUiTblClmId = this.parseBigIntId('uiTblClmId', uiTblClmId);
    const parsedUiTblClmNo = this.parseNullableBigIntId('uiTblClmNo', saveUiTableColumnDto.uiTblClmNo);
    const parsedUiTblClmTableId = this.parseNullableBigIntId('uiTblClmTableId', saveUiTableColumnDto.uiTblClmTableId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.uitableColumns.findFirst({
          where: { uiTblClmId: parsedUiTblClmId, uiTblClmIsDeleted: false },
        });
        if (!existing) {
          throwFixedNotFound<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
            'UI table column not found',
            'uiTblClmId',
            `No active UI table column found with id ${uiTblClmId}`,
          );
        }
        const normalizedName = this.normalizeRequiredName(saveUiTableColumnDto.uiTblClmName);
        const data: Prisma.UitableColumnsUncheckedUpdateInput = {
          uiTblClmName: normalizedName,
          uiTblClmModifiedOn: new Date(),
          uiTblClmModifiedBy: resolveActor(saveUiTableColumnDto.uiTblClmModifiedBy, this.requestContextService.getUserId()),
        };
        await this.ensureUiTableExists(parsedUiTblClmTableId, saveUiTableColumnDto.uiTblClmTableId, tx);
        applyPresentFields(data, saveUiTableColumnDto, UI_TABLE_COLUMN_OPTIONAL_FIELDS);
        this.assignUiTableColumnNo(data, parsedUiTblClmNo);
        this.assignUiTableColumnTableId(data, parsedUiTblClmTableId);
        const updated = await tx.uitableColumns.update({ where: { uiTblClmId: parsedUiTblClmId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: UI_TABLE_COLUMNS_TABLE_NAME,
            screenName: UI_TABLE_COLUMNS_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: uiTblClmId,
            displayName: this.resolveDisplayName(payload.uiTblClmName, payload.uiTblClmId),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: resolveActor(saveUiTableColumnDto.uiTblClmModifiedBy, this.requestContextService.getUserId()),
            notes: 'UI table column updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
        error,
        'UI table column already exists',
        [{ field: 'uiTblClmName', message: 'Duplicate uiTblClmName is not allowed' }],
      );
      if (isForeignKeyConstraintError(error)) {
        throwFixedBadRequest<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
          'Invalid relation reference',
          [{ field: 'uiTblClmTableId', message: 'Referenced UI table does not exist' }],
        );
      }
      throw error;
    }
  }

  private assignUiTableColumnTableId(
    data: Prisma.UitableColumnsUncheckedCreateInput | Prisma.UitableColumnsUncheckedUpdateInput,
    uiTblClmTableId: bigint | null | undefined,
  ): void {
    if (uiTblClmTableId !== undefined) {
      data.uiTblClmTableId = uiTblClmTableId;
    }
  }

  private assignUiTableColumnNo(
    data: Prisma.UitableColumnsUncheckedCreateInput | Prisma.UitableColumnsUncheckedUpdateInput,
    uiTblClmNo: bigint | null | undefined,
  ): void {
    if (uiTblClmNo !== undefined && uiTblClmNo !== null) {
      data.uiTblClmNo = uiTblClmNo;
    }
  }

  private async ensureUiTableExists(
    uiTblClmTableId: bigint | null | undefined,
    rawUiTblClmTableId: string | null | undefined,
    tx: FixedWriteClient = this.prisma,
  ): Promise<void> {
    if (uiTblClmTableId === undefined || uiTblClmTableId === null) {
      return;
    }
    const uiTable = await tx.uitable.findFirst({
      where: { uiTblId: uiTblClmTableId, uiTblIsDeleted: false },
      select: { uiTblId: true },
    });
    if (!uiTable) {
      throwFixedBadRequest<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
        'Validation failed',
        [{ field: 'uiTblClmTableId', message: `No active UI table found with id ${rawUiTblClmTableId}` }],
      );
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throwFixedBadRequest<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
        'Validation failed',
        [{ field: 'uiTblClmName', message: 'uiTblClmName must not be empty' }],
      );
    }
    return trimmed;
  }

  private toPayload(record: UitableColumns): UiTableColumnPayload {
    return {
      uiTblClmId: record.uiTblClmId.toString(),
      uiTblClmNo: record.uiTblClmNo?.toString() ?? '',
      uiTblClmName: record.uiTblClmName,
      uiTblClmTableId: record.uiTblClmTableId?.toString() ?? null,
      uiTblClmColumnWidth: record.uiTblClmColumnWidth === null ? null : Number(record.uiTblClmColumnWidth),
      uiTblClmColumnVisibility: record.uiTblClmColumnVisibility,
      uiTblClmColumnFocus: record.uiTblClmColumnFocus,
      uiTblClmColumnPosition: record.uiTblClmColumnPosition,
      uiTblClmColumnNecessity: record.uiTblClmColumnNecessity,
      uiTblClmNextColumn: record.uiTblClmNextColumn,
      uiTblClmPreviousColumn: record.uiTblClmPreviousColumn,
      uiTblClmIsActive: record.uiTblClmIsActive,
      uiTblClmIsDeleted: record.uiTblClmIsDeleted,
      uiTblClmSyncDate: record.uiTblClmSyncDate ? record.uiTblClmSyncDate.toISOString() : null,
      uiTblClmCreatedOn: record.uiTblClmCreatedOn.toISOString(),
      uiTblClmCreatedBy: record.uiTblClmCreatedBy,
      uiTblClmModifiedOn: record.uiTblClmModifiedOn.toISOString(),
      uiTblClmModifiedBy: record.uiTblClmModifiedBy,
    };
  }

  private resolveDisplayName(uiTblClmName: string | null, uiTblClmId: string): string {
    return uiTblClmName?.trim() || `UI Table Column ${uiTblClmId}`;
  }

  private parseBigIntId(field: string, value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwFixedBadRequest<UiTableColumnErrorDetail, UiTableColumnErrorResponse>(
        'Validation failed',
        [{ field, message: `${field} must be a numeric id` }],
      );
    }
    return BigInt(normalized);
  }

  private parseNullableBigIntId(
    field: string,
    value: string | null | undefined,
  ): bigint | null | undefined {
    if (value === undefined || value === null) return value;
    return this.parseBigIntId(field, value);
  }
}
