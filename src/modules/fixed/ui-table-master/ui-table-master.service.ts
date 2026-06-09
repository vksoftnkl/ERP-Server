import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { Prisma, Uitable, UitableColumns } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListUiTableMasterQueryDto } from './dto/list-ui-table-master-query.dto';
import { SaveUiTableMasterDto } from './dto/save-ui-table-master.dto';
import { SaveUiTableColumnDto } from './dto/save-ui-table-column.dto';
import {
  UiTableMasterErrorDetail,
  UiTableMasterErrorResponse,
  UiTableMasterListItem,
  UiTableMasterListMeta,
  UiTableMasterPayload,
  UiTableColumnPayload,
} from './types/ui-table-master-api.types';
import {
  DEFAULT_ACTOR,
  FixedWriteClient,
  applyPresentFields,
  resolveActor,
  throwFixedBadRequest,
  throwFixedConflict,
  throwFixedNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery, runFixedListQuery } from 'src/common/utils/module-list.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const UI_TABLE_MASTER_TABLE_NAME = 'ui tables';
const UI_TABLE_MASTER_AUDIT_SCREEN_NAME = 'UI Table Master';
const UI_TABLE_MASTER_OPTIONAL_FIELDS = ['uiTblEditable', 'uiTblIsActive', 'uiTblDeviceType'];

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

type UitableWithColumns = Uitable & { uiTableColumns: UitableColumns[] };

@Injectable()
export class UiTableMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveUiTableMasterDto: SaveUiTableMasterDto): Promise<UiTableMasterPayload> {
    return saveUiTableMasterDto.uiTblId
      ? this.updateUiTable(saveUiTableMasterDto)
      : this.createUiTable(saveUiTableMasterDto);
  }

  async list(
    queryDto: ListUiTableMasterQueryDto,
  ): Promise<ConfiguredGridListResult<UiTableMasterListItem, UiTableMasterListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const fixedGridId = queryDto.uiTableId ? BigInt(queryDto.uiTableId) : undefined;
    const tableWhere: Prisma.UitableWhereInput = {
      uiTblIsDeleted: false,
      ...(fixedGridId !== undefined ? { uiTblId: fixedGridId } : {}),
    };
    const columnWhere: Prisma.UitableColumnsWhereInput = {
      uiTblClmIsDeleted: false,
      ...(queryDto.uiTblClmIsActive !== undefined ? { uiTblClmIsActive: queryDto.uiTblClmIsActive } : {}),
    };
    return runFixedListQuery<UitableWithColumns, UiTableMasterListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<UiTableMasterListItem>(
            this.configuredGridSqlService,
            { tableName: UI_TABLE_MASTER_TABLE_NAME, alias: 'ui_table_master_grid', search: queryDto.search, page, limit, skip, fixedGridId },
          ),
        countFn: () => this.prisma.uitable.count({ where: tableWhere }),
        findManyFn: () =>
          this.prisma.uitable.findMany({
            where: tableWhere,
            orderBy: { uiTblId: 'asc' },
            include: {
              uiTableColumns: {
                where: columnWhere,
                orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
              },
            },
            skip,
            take: limit,
          }) as unknown as Promise<UitableWithColumns[]>,
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(uiTblId: string): Promise<UiTableMasterPayload> {
    const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);
    const record = await this.prisma.uitable.findFirst({
      where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
      include: {
        uiTableColumns: {
          where: { uiTblClmIsDeleted: false },
          orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
        },
      },
    });
    if (!record) {
      throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        'UI table not found',
        'uiTblId',
        `No active UI table found with id ${uiTblId}`,
      );
    }
    return this.toPayload(record as UitableWithColumns);
  }

  async softDelete(uiTblId: string): Promise<{ uiTblId: string; deleted: true }> {
    const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.uitable.findFirst({
        where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
      });
      if (!existing) {
        throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
          'UI table not found',
          'uiTblId',
          `No active UI table found with id ${uiTblId}`,
        );
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const result = await tx.uitable.updateMany({
        where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
        data: {
          uiTblIsDeleted: true,
          uiTblIsActive: false,
          uiTblModifiedOn: modifiedOn,
          uiTblModifiedBy: actor,
        },
      });
      if (result.count === 0) {
        throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
          'UI table not found',
          'uiTblId',
          `No active UI table found with id ${uiTblId}`,
        );
      }
      const originalRecord = this.toPayload({ ...existing, uiTableColumns: [] });
      const modifiedRecord = this.toPayload({
        ...existing,
        uiTblIsDeleted: true,
        uiTblIsActive: false,
        uiTblModifiedOn: modifiedOn,
        uiTblModifiedBy: actor,
        uiTableColumns: [],
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: UI_TABLE_MASTER_TABLE_NAME,
          screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: uiTblId,
          displayName: this.resolveDisplayName(existing.uiTblName, uiTblId),
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: 'UI table soft deleted',
        },
        tx,
      );
      return { uiTblId, deleted: true };
    });
  }

  private async createUiTable(
    saveUiTableMasterDto: SaveUiTableMasterDto,
  ): Promise<UiTableMasterPayload> {
    const normalizedName = this.normalizeRequiredName(saveUiTableMasterDto.uiTblName);
    const now = new Date();
    const createdBy = resolveActor(null, this.requestContextService.getUserId());
    const data: Prisma.UitableUncheckedCreateInput = {
      uiTblName: normalizedName,
      uiTblCreatedOn: now,
      uiTblCreatedBy: createdBy,
    };
    applyPresentFields(data, saveUiTableMasterDto, UI_TABLE_MASTER_OPTIONAL_FIELDS);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureNameIsUnique(tx, normalizedName);
        const created = await tx.uitable.create({ data });
        if (saveUiTableMasterDto.uiTblColumns?.length) {
          await this.saveColumnsInTx(saveUiTableMasterDto.uiTblColumns, created.uiTblId, createdBy, tx);
        }
        const full = await tx.uitable.findFirstOrThrow({
          where: { uiTblId: created.uiTblId },
          include: {
            uiTableColumns: {
              where: { uiTblClmIsDeleted: false },
              orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
            },
          },
        });
        const payload = this.toPayload(full as UitableWithColumns);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: UI_TABLE_MASTER_TABLE_NAME,
            screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.uiTblId,
            displayName: this.resolveDisplayName(payload.uiTblName, payload.uiTblId),
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'UI table created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        error,
        'UI table already exists',
        [{ field: 'uiTblName', message: 'Duplicate uiTblName is not allowed' }],
      );
      throw error;
    }
  }

  private async updateUiTable(
    saveUiTableMasterDto: SaveUiTableMasterDto,
  ): Promise<UiTableMasterPayload> {
    const uiTblId = saveUiTableMasterDto.uiTblId!;
    const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.uitable.findFirst({
          where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
        });
        if (!existing) {
          throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
            'UI table not found',
            'uiTblId',
            `No active UI table found with id ${uiTblId}`,
          );
        }
        const actor = resolveActor(null, this.requestContextService.getUserId());
        const data: Prisma.UitableUncheckedUpdateInput = {
          uiTblModifiedOn: new Date(),
          uiTblModifiedBy: actor,
        };
        if (saveUiTableMasterDto.uiTblName?.trim()) {
          const normalizedName = this.normalizeRequiredName(saveUiTableMasterDto.uiTblName);
          await this.ensureNameIsUnique(tx, normalizedName, parsedUiTableId);
          data.uiTblName = normalizedName;
        }
        applyPresentFields(data, saveUiTableMasterDto, UI_TABLE_MASTER_OPTIONAL_FIELDS);
        await tx.uitable.update({ where: { uiTblId: parsedUiTableId }, data });
        if (saveUiTableMasterDto.uiTblColumns !== undefined) {
          await this.saveColumnsInTx(saveUiTableMasterDto.uiTblColumns, parsedUiTableId, actor, tx);
          const keptIds = saveUiTableMasterDto.uiTblColumns
            .filter((col) => !!col.uiTblClmId)
            .map((col) => BigInt(col.uiTblClmId!));
          await tx.uitableColumns.updateMany({
            where: {
              uiTblClmTableId: parsedUiTableId,
              uiTblClmIsDeleted: false,
              ...(keptIds.length > 0 ? { uiTblClmId: { notIn: keptIds } } : {}),
            },
            data: {
              uiTblClmIsDeleted: true,
              uiTblClmIsActive: false,
              uiTblClmModifiedOn: new Date(),
              uiTblClmModifiedBy: actor,
            },
          });
        }
        const full = await tx.uitable.findFirstOrThrow({
          where: { uiTblId: parsedUiTableId },
          include: {
            uiTableColumns: {
              where: { uiTblClmIsDeleted: false },
              orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
            },
          },
        });
        const payload = this.toPayload(full as UitableWithColumns);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: UI_TABLE_MASTER_TABLE_NAME,
            screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: uiTblId,
            displayName: this.resolveDisplayName(payload.uiTblName, payload.uiTblId),
            originalRecord: this.toPayload({ ...existing, uiTableColumns: [] }),
            modifiedRecord: payload,
            userId: actor,
            notes: 'UI table updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        error,
        'UI table already exists',
        [{ field: 'uiTblName', message: 'Duplicate uiTblName is not allowed' }],
      );
      throw error;
    }
  }

  private async saveColumnsInTx(
    columns: SaveUiTableColumnDto[],
    tableId: bigint,
    actor: string,
    tx: FixedWriteClient,
  ): Promise<void> {
    for (const colDto of columns) {
      await this.upsertColumnInTx(colDto, tableId, actor, tx);
    }
  }

  private async upsertColumnInTx(
    colDto: SaveUiTableColumnDto,
    tableId: bigint,
    actor: string,
    tx: FixedWriteClient,
  ): Promise<void> {
    const normalizedName = colDto.uiTblClmName?.trim();
    if (!normalizedName) {
      throwFixedBadRequest<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        'Validation failed',
        [{ field: 'uiTblClmName', message: 'uiTblClmName must not be empty' }],
      );
    }
    const now = new Date();

    if (colDto.uiTblClmId) {
      const parsedId = BigInt(colDto.uiTblClmId);
      const colData: Prisma.UitableColumnsUncheckedUpdateInput = {
        uiTblClmName: normalizedName,
        uiTblClmTableId: tableId,
        uiTblClmModifiedOn: now,
        uiTblClmModifiedBy: actor,
      };
      if (colDto.uiTblClmNo !== undefined && colDto.uiTblClmNo !== null) {
        colData.uiTblClmNo = BigInt(colDto.uiTblClmNo);
      }
      applyPresentFields(colData, colDto, UI_TABLE_COLUMN_OPTIONAL_FIELDS);
      await tx.uitableColumns.update({ where: { uiTblClmId: parsedId }, data: colData });
    } else {
      const colData: Prisma.UitableColumnsUncheckedCreateInput = {
        uiTblClmName: normalizedName,
        uiTblClmTableId: tableId,
        uiTblClmCreatedOn: now,
        uiTblClmCreatedBy: actor,
      };
      if (colDto.uiTblClmNo !== undefined && colDto.uiTblClmNo !== null) {
        colData.uiTblClmNo = BigInt(colDto.uiTblClmNo);
      }
      applyPresentFields(colData, colDto, UI_TABLE_COLUMN_OPTIONAL_FIELDS);
      await tx.uitableColumns.create({ data: colData });
    }
  }

  private async ensureNameIsUnique(
    tx: FixedWriteClient,
    uiTblName: string,
    excludeId?: bigint,
  ): Promise<void> {
    const existing = await tx.uitable.findFirst({
      where: {
        uiTblIsDeleted: false,
        uiTblName: { equals: uiTblName, mode: 'insensitive' },
        ...(excludeId ? { uiTblId: { not: excludeId } } : {}),
      },
      select: { uiTblId: true },
    });
    if (existing) {
      throwFixedConflict<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        'UI table name already exists',
        [{ field: 'uiTblName', message: 'Duplicate uiTblName is not allowed' }],
      );
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throwFixedBadRequest<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        'Validation failed',
        [{ field: 'uiTblName', message: 'uiTblName must not be empty' }],
      );
    }
    return trimmed;
  }

  private toPayload(record: UitableWithColumns): UiTableMasterPayload {
    return {
      uiTblId: record.uiTblId.toString(),
      uiTblName: record.uiTblName,
      uiTblEditable: record.uiTblEditable,
      uiTblIsActive: record.uiTblIsActive,
      uiTblIsDeleted: record.uiTblIsDeleted,
      uiTblDeviceType: (record as unknown as Record<string, unknown>)['uiTblDeviceType'] as string | null ?? null,
      uiTblSyncDate: record.uiTblSyncDate ? record.uiTblSyncDate.toISOString() : null,
      uiTblCreatedOn: record.uiTblCreatedOn.toISOString(),
      uiTblCreatedBy: record.uiTblCreatedBy,
      uiTblModifiedOn: record.uiTblModifiedOn.toISOString(),
      uiTblModifiedBy: record.uiTblModifiedBy,
      columns: record.uiTableColumns.map((col) => this.toColumnPayload(col)),
    };
  }

  private toColumnPayload(record: UitableColumns): UiTableColumnPayload {
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

  private resolveDisplayName(uiTblName: string | null, uiTblId: string): string {
    return uiTblName?.trim() || `UI Table ${uiTblId}`;
  }

  private parseBigIntId(field: string, value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwFixedBadRequest<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        'Validation failed',
        [{ field, message: `${field} must be a numeric id` }],
      );
    }
    return BigInt(normalized);
  }
}
