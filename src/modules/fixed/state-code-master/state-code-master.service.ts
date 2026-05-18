import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Prisma, StateCode } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListStateCodeMasterQueryDto } from './dto/list-state-code-master-query.dto';
import { SaveStateCodeMasterDto } from './dto/save-state-code-master.dto';
import {
  StateCodeMasterErrorDetail,
  StateCodeMasterErrorResponse,
  StateCodeMasterListItem,
  StateCodeMasterListMeta,
  StateCodeMasterPayload,
} from './types/state-code-master-api.types';
import {
  DEFAULT_ACTOR,
  FixedWriteClient,
  applyPresentFields,
  normalizeRequiredText,
  resolveActor,
  throwFixedBadRequest,
  throwFixedConflict,
  throwFixedNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery, runFixedListQuery } from 'src/common/utils/module-list.utils';

const STATE_CODE_MASTER_TABLE_NAME = 'state codes';
const STATE_CODE_MASTER_AUDIT_SCREEN_NAME = 'State Code Master';
const STATE_CODE_MASTER_OPTIONAL_FIELDS = ['stateUt', 'tinCode', 'isActive'];

@Injectable()
export class StateCodeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveStateCodeMasterDto: SaveStateCodeMasterDto): Promise<StateCodeMasterPayload> {
    const stateCode = this.normalizeStateCode(saveStateCodeMasterDto.stateCode);
    const existing = await this.prisma.stateCode.findUnique({
      where: { stateCode },
      select: { stateCode: true },
    });
    if (existing) {
      return this.updateStateCode(saveStateCodeMasterDto, stateCode);
    }
    return this.createStateCode(saveStateCodeMasterDto, stateCode);
  }

  async list(
    queryDto: ListStateCodeMasterQueryDto,
  ): Promise<ConfiguredGridListResult<StateCodeMasterListItem, StateCodeMasterListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const hasStructuredFilters =
      queryDto.isActive !== undefined || queryDto.stateUt !== undefined;
    const where: Prisma.StateCodeWhereInput = { isDeleted: false };
    if (queryDto.isActive !== undefined) where.isActive = queryDto.isActive;
    if (queryDto.stateUt !== undefined) where.stateUt = queryDto.stateUt;
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { stateCode: { contains: search, mode: 'insensitive' } },
        { stateName: { contains: search, mode: 'insensitive' } },
        { tinCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    return runFixedListQuery({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => runConfiguredGridQuery<StateCodeMasterListItem>(
        this.configuredGridSqlService,
        { tableName: STATE_CODE_MASTER_TABLE_NAME, alias: 'state_code_master_grid', search: queryDto.search, page, limit, skip },
      ),
      countFn: () => this.prisma.stateCode.count({ where }),
      findManyFn: () => this.prisma.stateCode.findMany({
        where,
        orderBy: [{ stateName: 'asc' }, { stateCode: 'asc' }],
        skip,
        take: limit,
      }),
      toItemFn: (record) => this.toPayload(record),
      loadStylesFn: () => this.configuredGridSqlService.loadPrimaryGridStyles(STATE_CODE_MASTER_TABLE_NAME),
    });
  }

  async getById(stateCodeValue: string): Promise<StateCodeMasterPayload> {
    const stateCode = this.normalizeStateCode(stateCodeValue);
    const record = await this.prisma.stateCode.findFirst({
      where: { stateCode, isDeleted: false },
    });
    if (!record) {
      throwFixedNotFound<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
        'State code not found',
        'stateCode',
        `No active state code found with code ${stateCode}`,
      );
    }
    return this.toPayload(record);
  }

  async softDelete(stateCodeValue: string): Promise<{ stateCode: string; deleted: true }> {
    const stateCode = this.normalizeStateCode(stateCodeValue);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stateCode.findFirst({
        where: { stateCode, isDeleted: false },
      });
      if (!existing) {
        throwFixedNotFound<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
          'State code not found',
          'stateCode',
          `No active state code found with code ${stateCode}`,
        );
      }
      const modifiedOn = new Date();
      const result = await tx.stateCode.updateMany({
        where: { stateCode, isDeleted: false },
        data: {
          isDeleted: true,
          isActive: false,
          modifiedOn,
          modifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwFixedNotFound<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
          'State code not found',
          'stateCode',
          `No active state code found with code ${stateCode}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        isDeleted: true,
        isActive: false,
        modifiedOn,
        modifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: STATE_CODE_MASTER_TABLE_NAME,
          screenName: STATE_CODE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: stateCode,
          displayName: existing.stateName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'State code soft deleted',
        },
        tx,
      );
      return { stateCode, deleted: true };
    });
  }

  private async createStateCode(
    saveStateCodeMasterDto: SaveStateCodeMasterDto,
    stateCode: string,
  ): Promise<StateCodeMasterPayload> {
    const normalizedName = normalizeRequiredText<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
      saveStateCodeMasterDto.stateName,
      'stateName',
    );
    const now = new Date();
    const createdBy = resolveActor(saveStateCodeMasterDto.createdBy);
    const modifiedBy = resolveActor(saveStateCodeMasterDto.modifiedBy, createdBy);
    const data: Prisma.StateCodeUncheckedCreateInput = {
      stateCode,
      stateName: normalizedName,
      createdOn: now,
      createdBy,
      modifiedOn: now,
      modifiedBy,
    };
    applyPresentFields(data, saveStateCodeMasterDto, STATE_CODE_MASTER_OPTIONAL_FIELDS);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureStateNameIsUnique(tx, normalizedName, stateCode);
        const created = await tx.stateCode.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: STATE_CODE_MASTER_TABLE_NAME,
            screenName: STATE_CODE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.stateCode,
            displayName: payload.stateName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'State code created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
        error,
        'State code already exists',
        [{ field: 'stateCode', message: 'Duplicate stateCode is not allowed' }],
      );
      throw error;
    }
  }

  private async updateStateCode(
    saveStateCodeMasterDto: SaveStateCodeMasterDto,
    stateCode: string,
  ): Promise<StateCodeMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.stateCode.findUnique({ where: { stateCode } });
        if (!existing) {
          throwFixedNotFound<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
            'State code not found',
            'stateCode',
            `No active state code found with code ${stateCode}`,
          );
        }
        const normalizedName = normalizeRequiredText<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
          saveStateCodeMasterDto.stateName,
          'stateName',
        );
        await this.ensureStateNameIsUnique(tx, normalizedName, stateCode);
        const data: Prisma.StateCodeUncheckedUpdateInput = {
          stateName: normalizedName,
          isDeleted: false,
          modifiedOn: new Date(),
          modifiedBy: resolveActor(saveStateCodeMasterDto.modifiedBy),
        };
        applyPresentFields(data, saveStateCodeMasterDto, STATE_CODE_MASTER_OPTIONAL_FIELDS);
        const updated = await tx.stateCode.update({ where: { stateCode }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: STATE_CODE_MASTER_TABLE_NAME,
            screenName: STATE_CODE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: stateCode,
            displayName: payload.stateName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: resolveActor(saveStateCodeMasterDto.modifiedBy),
            notes: existing.isDeleted ? 'State code restored and updated' : 'State code updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
        error,
        'State code already exists',
        [{ field: 'stateCode', message: 'Duplicate stateCode is not allowed' }],
      );
      throw error;
    }
  }

  private async ensureStateNameIsUnique(
    tx: FixedWriteClient,
    stateName: string,
    excludeCode?: string,
  ): Promise<void> {
    const existing = await tx.stateCode.findFirst({
      where: {
        isDeleted: false,
        stateName: { equals: stateName, mode: 'insensitive' },
        ...(excludeCode ? { stateCode: { not: excludeCode } } : {}),
      },
      select: { stateCode: true },
    });
    if (existing) {
      throwFixedConflict<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
        'State name already exists',
        [{ field: 'stateName', message: 'Duplicate stateName is not allowed' }],
      );
    }
  }

  private normalizeStateCode(value: string, fieldName = 'stateCode'): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized || normalized.length !== 2) {
      throwFixedBadRequest<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse>(
        'Validation failed',
        [{ field: fieldName, message: `${fieldName} must be a 2-character code` }],
      );
    }
    return normalized;
  }

  private toPayload(record: StateCode): StateCodeMasterPayload {
    return {
      stateCode: record.stateCode,
      stateName: record.stateName,
      stateUt: record.stateUt,
      tinCode: record.tinCode,
      isActive: record.isActive,
      isDeleted: record.isDeleted,
      stateSyncDate: record.stateSyncDate ? record.stateSyncDate.toISOString() : null,
      createdOn: record.createdOn.toISOString(),
      createdBy: record.createdBy,
      modifiedOn: record.modifiedOn.toISOString(),
      modifiedBy: record.modifiedBy,
    };
  }
}
