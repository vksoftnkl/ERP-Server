import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  BatchPrefixErrorResponse,
  BatchPrefixListItem,
  BatchPrefixListMeta,
  BatchPrefixPayload,
} from './types/batch-prefix-api.types';
const DEFAULT_ACTOR = '00000000-0000-0000-0000-000000000000';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const BATCH_PREFIX_TABLE_NAME = 'batch prefix';
const BATCH_PREFIX_AUDIT_SCREEN_NAME = 'Batch Prefix';
type BatchPrefixWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class BatchPrefixService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
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
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    if (!queryDto.search?.trim()) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.BatchPrefixWhereInput = {};
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { prefixUsed: { contains: search, mode: 'insensitive' } },
        { createdBy: { contains: search, mode: 'insensitive' } },
        { modifiedBy: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.batchPrefix.count({ where }),
      this.prisma.batchPrefix.findMany({
        where,
        orderBy: [{ prefixUsed: 'asc' }, { id: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<BatchPrefixListItem, BatchPrefixListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: BATCH_PREFIX_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      BATCH_PREFIX_TABLE_NAME,
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
        tableName: BATCH_PREFIX_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result = await this.configuredGridSqlService.runPagedQuery<BatchPrefixListItem>({
          baseSql: validation.normalizedSql,
          alias: 'batch_prefix_grid',
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
  async getById(id: string): Promise<BatchPrefixPayload> {
    const record = await this.prisma.batchPrefix.findUnique({
      where: {
        id,
      },
    });
    if (!record) {
      this.throwNotFound(id);
    }
    return this.toPayload(record);
  }
  async delete(id: string): Promise<BatchPrefixDeleteResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.batchPrefix.findUnique({
          where: {
            id,
          },
        });
        if (!existing) {
          this.throwNotFound(id);
        }
        await tx.batchPrefix.delete({
          where: {
            id,
          },
        });
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
            userId: DEFAULT_ACTOR,
            notes: 'Batch prefix deleted',
          },
          tx,
        );
        return {
          id,
          deleted: true,
        };
      });
    } catch (error: unknown) {
      this.handleDeleteError(error, id);
      throw error;
    }
  }
  private async createBatchPrefix(
    saveBatchPrefixDto: SaveBatchPrefixDto,
  ): Promise<BatchPrefixPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const prefixUsed = this.normalizeRequiredPrefix(saveBatchPrefixDto.prefixUsed);
        const syncDate = this.parseNullableDate(saveBatchPrefixDto.syncDate, 'syncDate');
        await this.ensurePrefixIsUnique(tx, prefixUsed);
        const now = new Date();
        const data: Prisma.BatchPrefixUncheckedCreateInput = {
          prefixUsed,
          syncDate: syncDate ?? null,
          createdBy: DEFAULT_ACTOR,
          createdOn: now,
          modifiedBy: DEFAULT_ACTOR,
          modifiedOn: now,
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
            userId: DEFAULT_ACTOR,
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
  private async updateBatchPrefix(
    saveBatchPrefixDto: SaveBatchPrefixDto,
  ): Promise<BatchPrefixPayload> {
    const id = saveBatchPrefixDto.id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.batchPrefix.findUnique({
          where: {
            id,
          },
        });
        if (!existing) {
          this.throwNotFound(id);
        }
        const prefixUsed = this.normalizeRequiredPrefix(saveBatchPrefixDto.prefixUsed);
        await this.ensurePrefixIsUnique(tx, prefixUsed, id);
        const data: Prisma.BatchPrefixUncheckedUpdateInput = {
          prefixUsed,
          modifiedBy: DEFAULT_ACTOR,
          modifiedOn: new Date(),
        };
        if (this.hasOwnProperty(saveBatchPrefixDto, 'syncDate')) {
          const syncDate = this.parseNullableDate(saveBatchPrefixDto.syncDate, 'syncDate');
          data.syncDate = syncDate ?? null;
        }
        const updated = await tx.batchPrefix.update({
          where: {
            id,
          },
          data,
        });
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
            userId: DEFAULT_ACTOR,
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
        prefixUsed: {
          equals: prefixUsed,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              id: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });
    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Batch prefix already exists', [
          {
            field: 'prefixUsed',
            message: 'Duplicate prefixUsed is not allowed',
          },
        ]),
      );
    }
  }
  private normalizeRequiredPrefix(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'prefixUsed',
          message: 'prefixUsed must not be empty',
        },
      ]);
    }
    return trimmed;
  }
  private parseNullableDate(
    value: string | null | undefined,
    field: string,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid ISO-8601 date-time`,
        },
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
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Batch prefix already exists', [
          {
            field: 'prefixUsed',
            message: 'Duplicate prefixUsed is not allowed',
          },
        ]),
      );
    }
  }
  private handleDeleteError(error: unknown, id: string): void {
    if (this.isRecordNotFoundError(error)) {
      this.throwNotFound(id);
    }
  }
  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2002';
  }
  private isRecordNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2025';
  }
  private throwNotFound(id: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Batch prefix not found', [
        {
          field: 'id',
          message: `No batch prefix found with id ${id}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: BatchPrefixErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: BatchPrefixErrorDetail[] = [],
  ): BatchPrefixErrorResponse {
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
