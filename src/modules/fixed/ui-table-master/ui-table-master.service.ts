import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { Prisma, Uitable, UitableColumns } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListUiTableMasterQueryDto } from './dto/list-ui-table-master-query.dto';
import { SaveUiTableMasterDto } from './dto/save-ui-table-master.dto';
import { SaveUiTableColumnDto } from './dto/save-ui-table-column.dto';
import { SaveUiTableColumnWidthDto } from './dto/save-ui-table-column-width.dto';
import {
  SaveUiTableVisibilitySettingsDto,
  UiTableVisibilitySettingItemDto,
} from './dto/save-ui-table-visibility-settings.dto';
import {
  UiTableMasterErrorDetail,
  UiTableMasterErrorResponse,
  UiTableMasterListItem,
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
import { RequestContextService } from '../../../common/request-context/request-context.service';

const UI_TABLE_MASTER_TABLE_NAME = 'ui tables';
const UI_TABLE_COLUMN_TABLE_NAME = 'ui table columns';
const UI_TABLE_MASTER_AUDIT_SCREEN_NAME = 'UI Table Master';
const UI_TABLE_MASTER_OPTIONAL_FIELDS = ['uiTblEditable', 'uiTblIsActive', 'uiTblDeviceType'];

const UI_TABLE_VISIBILITY_SETTING_FIELDS = [
  'uiTblClmColumnWidth',
  'uiTblClmColumnVisibility',
  'uiTblClmColumnFocus',
  'uiTblClmColumnPosition',
  'uiTblClmColumnNecessity',
  'uiTblClmNextColumn',
  'uiTblClmPreviousColumn',
] as const satisfies readonly (keyof UiTableVisibilitySettingItemDto)[];

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
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveUiTableMasterDto: SaveUiTableMasterDto): Promise<UiTableMasterPayload> {
    return saveUiTableMasterDto.uiTblId
      ? this.updateUiTable(saveUiTableMasterDto)
      : this.createUiTable(saveUiTableMasterDto);
  }

  async list(queryDto: ListUiTableMasterQueryDto): Promise<{ items: UiTableMasterListItem[] }> {
    const requestedTableId = queryDto.uiTableId ?? queryDto.uiTblId;
    const fixedTableId = requestedTableId ? BigInt(requestedTableId) : undefined;
    const search = queryDto.search?.trim();
    const tableWhere: Prisma.UitableWhereInput = {
      uiTblIsDeleted: false,
      ...(fixedTableId !== undefined ? { uiTblId: fixedTableId } : {}),
      ...(search ? { uiTblName: { contains: search, mode: 'insensitive' } } : {}),
    };
    const columnWhere: Prisma.UitableColumnsWhereInput = {
      uiTblClmIsDeleted: false,
    };

    const records = await this.prisma.uitable.findMany({
      where: tableWhere,
      orderBy: { uiTblId: 'asc' },
      include: {
        uiTableColumns: {
          where: columnWhere,
          orderBy: [{ uiTblClmNo: 'asc' }, { uiTblClmId: 'asc' }],
        },
      },
    }) as unknown as UitableWithColumns[];

    return { items: records.map((record) => this.toPayload(record)) };
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

  async updateColumnWidths(dto: SaveUiTableColumnWidthDto): Promise<{ updated: number }> {
    const actor = resolveActor(null, this.requestContextService.getUserId());
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.columns) {
        const columnId = BigInt(item.uiTblClmId);
        const existing = await tx.uitableColumns.findFirst({
          where: { uiTblClmId: columnId, uiTblClmIsDeleted: false },
          select: { uiTblClmId: true },
        });
        if (!existing) {
          throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
            'UI table column not found',
            'uiTblClmId',
            `No active UI table column found with id ${item.uiTblClmId}`,
          );
        }
        await tx.uitableColumns.update({
          where: { uiTblClmId: columnId },
          data: {
            uiTblClmColumnWidth: item.uiTblClmColumnWidth,
            uiTblClmModifiedOn: new Date(),
            uiTblClmModifiedBy: actor,
          },
        });
        count++;
      }
    });
    return { updated: count };
  }

  async updateVisibilitySettings(dto: SaveUiTableVisibilitySettingsDto): Promise<{ updated: number }> {
    const actor = resolveActor(null, this.requestContextService.getUserId());
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.columns) {
        const columnId = BigInt(item.uiTblClmId);
        const existing = await tx.uitableColumns.findFirst({
          where: { uiTblClmId: columnId, uiTblClmIsDeleted: false },
          select: { uiTblClmId: true },
        });
        if (!existing) {
          throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
            'UI table column not found',
            'uiTblClmId',
            `No active UI table column found with id ${item.uiTblClmId}`,
          );
        }
        const data: Prisma.UitableColumnsUncheckedUpdateInput = {
          uiTblClmModifiedOn: new Date(),
          uiTblClmModifiedBy: actor,
        };
        for (const field of UI_TABLE_VISIBILITY_SETTING_FIELDS) {
          const value = item[field];
          if (value !== undefined) {
            (data as Record<string, unknown>)[field] = value;
          }
        }
        await tx.uitableColumns.update({ where: { uiTblClmId: columnId }, data });
        count++;
      }
    });
    return { updated: count };
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

  async softDeleteColumn(uiTblClmId: string): Promise<{ uiTblClmId: string; deleted: true }> {
    const parsedColumnId = this.parseBigIntId('uiTblClmId', uiTblClmId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.uitableColumns.findFirst({
        where: { uiTblClmId: parsedColumnId, uiTblClmIsDeleted: false },
      });
      if (!existing) {
        throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
          'UI table column not found',
          'uiTblClmId',
          `No active UI table column found with id ${uiTblClmId}`,
        );
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await tx.uitableColumns.update({
        where: { uiTblClmId: parsedColumnId },
        data: {
          uiTblClmIsDeleted: true,
          uiTblClmIsActive: false,
          uiTblClmModifiedOn: modifiedOn,
          uiTblClmModifiedBy: actor,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: UI_TABLE_COLUMN_TABLE_NAME,
          screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: uiTblClmId,
          displayName: existing.uiTblClmName?.trim() || `UI table column ${uiTblClmId}`,
          originalRecord: this.toColumnPayload(existing),
          modifiedRecord: this.toColumnPayload({
            ...existing,
            uiTblClmIsDeleted: true,
            uiTblClmIsActive: false,
            uiTblClmModifiedOn: modifiedOn,
            uiTblClmModifiedBy: actor,
          }),
          userId: actor,
          notes: 'UI table column soft deleted',
        },
        tx,
      );
      return { uiTblClmId, deleted: true };
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
          // keptIds must include columns created in this request (they have no
          // uiTblClmId in the DTO), otherwise the replace step wipes them too.
          const keptIds = await this.saveColumnsInTx(
            saveUiTableMasterDto.uiTblColumns,
            parsedUiTableId,
            actor,
            tx,
          );
          if (saveUiTableMasterDto.replaceColumns === true) {
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
  ): Promise<bigint[]> {
    const savedIds: bigint[] = [];
    for (const colDto of columns) {
      savedIds.push(await this.upsertColumnInTx(colDto, tableId, actor, tx));
    }
    return savedIds;
  }
  private async upsertColumnInTx(
    colDto: SaveUiTableColumnDto,
    tableId: bigint,
    actor: string,
    tx: FixedWriteClient,
  ): Promise<bigint> {
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
      return parsedId;
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
      const created = await tx.uitableColumns.create({ data: colData });
      return created.uiTblClmId;
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
      uiTblSyncOn: record.uiTblSyncOn ? record.uiTblSyncOn.toISOString() : null,
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