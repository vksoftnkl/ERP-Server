import { Injectable } from '@nestjs/common';
import { BatchPrefix, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListBatchPrefixQueryDto } from './dto/list-batch-prefix-query.dto';
import { SaveBatchPrefixDto } from './dto/save-batch-prefix.dto';
import {
  BatchPrefixDeleteResult,
  BatchPrefixErrorDetail,
  BatchPrefixListItem,
  BatchPrefixListMeta,
  BatchPrefixPayload,
} from './types/batch-prefix-api.types';
import { resolvePagination, runConfiguredGridQuery, runMasterListQuery } from 'src/common/utils/module-list.utils';
import {
  DEFAULT_ACTOR,
  MasterWriteClient,
  hasOwnProperty,
  isPrismaErrorCode,
  throwOnUniqueConstraintError,
  throwMasterBadRequest,
  throwMasterConflict,
  throwMasterNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const BATCH_PREFIX_TABLE_NAME = 'batch prefix';
const BATCH_PREFIX_AUDIT_SCREEN_NAME = 'Batch Prefix';

type BatchPrefixWriteClient = MasterWriteClient;

@Injectable()
export class BatchPrefixService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveBatchPrefixDto: SaveBatchPrefixDto): Promise<BatchPrefixPayload> {
    if (saveBatchPrefixDto.id) {
      return this.updateBatchPrefix(saveBatchPrefixDto);
    }
    return this.createBatchPrefix(saveBatchPrefixDto);
  }

  async list(
    queryDto: ListBatchPrefixQueryDto,
  ): Promise<ConfiguredGridListResult<BatchPrefixListItem, BatchPrefixListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.BatchPrefixWhereInput = {};
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { prefixUsed: { contains: search, mode: 'insensitive' } },
        { createdBy: { contains: search, mode: 'insensitive' } },
        { modifiedBy: { contains: search, mode: 'insensitive' } },
      ];
    }
    return runMasterListQuery({ page, limit }, {
      configuredGridFn: () => runConfiguredGridQuery<BatchPrefixListItem>(
        this.configuredGridSqlService,
        { tableName: BATCH_PREFIX_TABLE_NAME, alias: 'batch_prefix_grid', search: queryDto.search, page, limit, skip },
      ),
      countFn: () => this.prisma.batchPrefix.count({ where }),
      findManyFn: () => this.prisma.batchPrefix.findMany({
        where,
        orderBy: [{ prefixUsed: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      toItemFn: (record) => this.toPayload(record),
      loadStylesFn: () => this.configuredGridSqlService.loadPrimaryGridStyles(BATCH_PREFIX_TABLE_NAME),
    });
  }

  async getById(id: string): Promise<BatchPrefixPayload> {
    const record = await this.prisma.batchPrefix.findUnique({ where: { id } });
    if (!record) {
      this.throwNotFound(id);
    }
    return this.toPayload(record);
  }

  async delete(id: string): Promise<BatchPrefixDeleteResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.batchPrefix.findUnique({ where: { id } });
        if (!existing) {
          this.throwNotFound(id);
        }
        await tx.batchPrefix.delete({ where: { id } });
        await this.auditLogService.logEntityChange(
          {
            action: 'cancel',
            tableName: BATCH_PREFIX_TABLE_NAME,
            screenName: BATCH_PREFIX_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: id,
            displayName: this.buildDisplayName(existing),
            originalRecord: this.toPayload(existing),
            modifiedRecord: null,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Batch prefix deleted',
          },
          tx,
        );
        return { id, deleted: true };
      });
    } catch (error: unknown) {
      this.handleDeleteError(error, id);
      throw error;
    }
  }

  private async createBatchPrefix(saveBatchPrefixDto: SaveBatchPrefixDto): Promise<BatchPrefixPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const prefixUsed = this.normalizeRequiredPrefix(saveBatchPrefixDto.prefixUsed);
        const syncDate = this.parseNullableDate(saveBatchPrefixDto.syncDate, 'syncDate');
        await this.ensurePrefixIsUnique(tx, prefixUsed);
        const now = new Date();
        const data: Prisma.BatchPrefixUncheckedCreateInput = {
          prefixUsed,
          syncDate: syncDate ?? null,
          createdBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          createdOn: now,
        };
        const created = await tx.batchPrefix.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: BATCH_PREFIX_TABLE_NAME,
            screenName: BATCH_PREFIX_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.id,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Batch prefix created',
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

  private async updateBatchPrefix(saveBatchPrefixDto: SaveBatchPrefixDto): Promise<BatchPrefixPayload> {
    const id = saveBatchPrefixDto.id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.batchPrefix.findUnique({ where: { id } });
        if (!existing) {
          this.throwNotFound(id);
        }
        const prefixUsed = this.normalizeRequiredPrefix(saveBatchPrefixDto.prefixUsed);
        await this.ensurePrefixIsUnique(tx, prefixUsed, id);
        const data: Prisma.BatchPrefixUncheckedUpdateInput = {
          prefixUsed,
          modifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          modifiedOn: new Date(),
        };
        if (hasOwnProperty(saveBatchPrefixDto, 'syncDate')) {
          const syncDate = this.parseNullableDate(saveBatchPrefixDto.syncDate, 'syncDate');
          data.syncDate = syncDate ?? null;
        }
        const updated = await tx.batchPrefix.update({ where: { id }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BATCH_PREFIX_TABLE_NAME,
            screenName: BATCH_PREFIX_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: id,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Batch prefix updated',
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

  private async ensurePrefixIsUnique(
    tx: BatchPrefixWriteClient,
    prefixUsed: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.batchPrefix.findFirst({
      where: {
        prefixUsed: { equals: prefixUsed, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throwMasterConflict<BatchPrefixErrorDetail>('Batch prefix already exists', [
        { field: 'prefixUsed', message: 'Duplicate prefixUsed is not allowed' },
      ]);
    }
  }

  private normalizeRequiredPrefix(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throwMasterBadRequest<BatchPrefixErrorDetail>('Validation failed', [
        { field: 'prefixUsed', message: 'prefixUsed must not be empty' },
      ]);
    }
    return trimmed;
  }

  private parseNullableDate(value: string | null | undefined, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throwMasterBadRequest<BatchPrefixErrorDetail>('Validation failed', [
        { field, message: `${field} must be a valid ISO-8601 date-time` },
      ]);
    }
    return parsed;
  }

  private toPayload(record: BatchPrefix): BatchPrefixPayload {
    return {
      id: record.id,
      prefixUsed: record.prefixUsed,
      syncDate: record.syncDate ? record.syncDate.toISOString() : null,
      createdBy: record.createdBy,
      createdOn: record.createdOn ? record.createdOn.toISOString() : null,
      modifiedBy: record.modifiedBy,
      modifiedOn: record.modifiedOn ? record.modifiedOn.toISOString() : null,
    };
  }

  private buildDisplayName(record: Pick<BatchPrefix, 'id' | 'prefixUsed'>): string {
    return record.prefixUsed?.trim() || record.id;
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<BatchPrefixErrorDetail>(error, 'Batch prefix already exists', [
      { field: 'prefixUsed', message: 'Duplicate prefixUsed is not allowed' },
    ]);
  }

  private handleDeleteError(error: unknown, id: string): void {
    if (isPrismaErrorCode(error, 'P2025')) {
      this.throwNotFound(id);
    }
  }

  private throwNotFound(id: string): never {
    throwMasterNotFound<BatchPrefixErrorDetail>('Batch prefix not found', 'id', `No batch prefix found with id ${id}`);
  }
}
