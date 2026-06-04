import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { Prisma, Uitable } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListUiTableMasterQueryDto } from './dto/list-ui-table-master-query.dto';
import { SaveUiTableMasterDto } from './dto/save-ui-table-master.dto';
import {
  UiTableMasterErrorDetail,
  UiTableMasterErrorResponse,
  UiTableMasterListItem,
  UiTableMasterListMeta,
  UiTableMasterPayload,
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
const UI_TABLE_MASTER_TABLE_NAME = 'ui tables';
const UI_TABLE_MASTER_AUDIT_SCREEN_NAME = 'UI Table Master';
const UI_TABLE_MASTER_OPTIONAL_FIELDS = ['uiTblEditable', 'uiTblIsActive'];
@Injectable()
export class UiTableMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveUiTableMasterDto: SaveUiTableMasterDto): Promise<UiTableMasterPayload> {
    if (saveUiTableMasterDto.uiTblId) {
      return this.updateUiTable(saveUiTableMasterDto);
    }
    return this.createUiTable(saveUiTableMasterDto);
  }
  async list(
    queryDto: ListUiTableMasterQueryDto,
  ): Promise<ConfiguredGridListResult<UiTableMasterListItem, UiTableMasterListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    return runFixedListQuery<Uitable, UiTableMasterListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<UiTableMasterListItem>(
            this.configuredGridSqlService,
            { tableName: UI_TABLE_MASTER_TABLE_NAME, alias: 'ui_table_master_grid', search: queryDto.search, page, limit, skip },
          ),
        countFn: () => this.prisma.uitable.count({ where: { uiTblIsDeleted: false } }),
        findManyFn: () =>
          this.prisma.uitable.findMany({
            where: { uiTblIsDeleted: false },
            orderBy: { uiTblId: 'asc' },
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }
  async getById(uiTblId: string): Promise<UiTableMasterPayload> {
    const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);
    const record = await this.prisma.uitable.findFirst({
      where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
    });
    if (!record) {
      throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
        'UI table not found',
        'uiTblId',
        `No active UI table found with id ${uiTblId}`,
      );
    }
    return this.toPayload(record);
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
      const result = await tx.uitable.updateMany({
        where: { uiTblId: parsedUiTableId, uiTblIsDeleted: false },
        data: {
          uiTblIsDeleted: true,
          uiTblIsActive: false,
          uiTblModifiedOn: modifiedOn,
          uiTblModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwFixedNotFound<UiTableMasterErrorDetail, UiTableMasterErrorResponse>(
          'UI table not found',
          'uiTblId',
          `No active UI table found with id ${uiTblId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        uiTblIsDeleted: true,
        uiTblIsActive: false,
        uiTblModifiedOn: modifiedOn,
        uiTblModifiedBy: DEFAULT_ACTOR,
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
          userId: DEFAULT_ACTOR,
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
    const createdBy = resolveActor(saveUiTableMasterDto.uiTblCreatedBy);
    const modifiedBy = resolveActor(saveUiTableMasterDto.uiTblModifiedBy, createdBy);
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
        const payload = this.toPayload(created);
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
        const normalizedName = this.normalizeRequiredName(saveUiTableMasterDto.uiTblName);
        await this.ensureNameIsUnique(tx, normalizedName, parsedUiTableId);
        const data: Prisma.UitableUncheckedUpdateInput = {
          uiTblName: normalizedName,
          uiTblModifiedOn: new Date(),
          uiTblModifiedBy: resolveActor(saveUiTableMasterDto.uiTblModifiedBy),
        };
        applyPresentFields(data, saveUiTableMasterDto, UI_TABLE_MASTER_OPTIONAL_FIELDS);
        const updated = await tx.uitable.update({ where: { uiTblId: parsedUiTableId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: UI_TABLE_MASTER_TABLE_NAME,
            screenName: UI_TABLE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: uiTblId,
            displayName: this.resolveDisplayName(payload.uiTblName, payload.uiTblId),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: resolveActor(saveUiTableMasterDto.uiTblModifiedBy),
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
  private toPayload(record: Uitable): UiTableMasterPayload {
    return {
      uiTblId: record.uiTblId.toString(),
      uiTblName: record.uiTblName,
      uiTblEditable: record.uiTblEditable,
      uiTblIsActive: record.uiTblIsActive,
      uiTblIsDeleted: record.uiTblIsDeleted,
      uiTblSyncDate: record.uiTblSyncDate ? record.uiTblSyncDate.toISOString() : null,
      uiTblCreatedOn: record.uiTblCreatedOn.toISOString(),
      uiTblCreatedBy: record.uiTblCreatedBy,
      uiTblModifiedOn: record.uiTblModifiedOn.toISOString(),
      uiTblModifiedBy: record.uiTblModifiedBy,
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