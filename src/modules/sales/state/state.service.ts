import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StateMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListStateQueryDto } from './dto/list-state-query.dto';
import { SaveStateDto } from './dto/save-state.dto';
import {
  StateErrorDetail,
  StateErrorResponse,
  StateListItem,
  StateListMeta,
  StatePayload,
} from './types/state-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const STATE_TABLE_NAME = 'state_master';
const STATE_AUDIT_SCREEN_NAME = 'State Master';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;

type StateWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class StateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveStateDto: SaveStateDto): Promise<StatePayload> {
    if (saveStateDto.stmId) {
      return this.updateState(saveStateDto);
    }

    return this.createState(saveStateDto);
  }

  async list(
    queryDto: ListStateQueryDto,
  ): Promise<{ items: StateListItem[]; meta: StateListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.stmIsActive !== undefined || Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.StateMasterWhereInput = {
      stmIsDeleted: false,
    };

    if (queryDto.stmIsActive !== undefined) {
      where.stmIsActive = queryDto.stmIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { stmName: { contains: search, mode: 'insensitive' } },
        { stmAlias: { contains: search, mode: 'insensitive' } },
        { stmShort: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.stateMaster.count({ where }),
      this.prisma.stateMaster.findMany({
        where,
        orderBy: [{ stmName: 'asc' }, { stmId: 'asc' }],
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
    page: any,
    limit: any,
    skip: any,
  ): Promise<{ items: StateListItem[]; meta: StateListMeta } | null> {
    const configuredGrid = await this.prisma.gridDetails.findFirst({
      where: {
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
          contains: STATE_TABLE_NAME,
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
      const countSql = `SELECT COUNT(*)::bigint AS total FROM (${baseSql}) AS state_grid`;
      const rowsSql = `SELECT * FROM (${baseSql}) AS state_grid LIMIT $1 OFFSET $2`;
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(countSql),
        this.prisma.$queryRawUnsafe<StateListItem[]>(rowsSql, limit, skip),
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
      this.throwBadRequest('Invalid grid_sql configuration for state list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }

    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for state list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }

    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for state list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }

    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for state list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }

    if (!/\bstate_master\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for state list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference state_master table',
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

  async getById(stmId: string): Promise<StatePayload> {
    const record = await this.prisma.stateMaster.findFirst({
      where: {
        stmId,
        stmIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(stmId);
    }

    return this.toPayload(record);
  }

  async softDelete(stmId: string): Promise<{ stmId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stateMaster.findFirst({
        where: {
          stmId,
          stmIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(stmId);
      }

      const cityCount = await tx.cityMaster.count({
        where: {
          ctmStateId: stmId,
          ctmIsDeleted: false,
        },
      });

      if (cityCount > 0) {
        this.throwBadRequest('Cannot delete state with active cities', [
          {
            field: 'stmId',
            message: `State ${stmId} is used by ${cityCount} city(s).`,
          },
        ]);
      }

      const modifiedOn = new Date();
      const result = await tx.stateMaster.updateMany({
        where: {
          stmId,
          stmIsDeleted: false,
        },
        data: {
          stmIsDeleted: true,
          stmIsActive: false,
          stmModifiedOn: modifiedOn,
          stmModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(stmId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        stmIsDeleted: true,
        stmIsActive: false,
        stmModifiedOn: modifiedOn,
        stmModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: STATE_TABLE_NAME,
          screenName: STATE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: stmId,
          displayName: existing.stmName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'State soft deleted',
        },
        tx,
      );

      return {
        stmId,
        deleted: true,
      };
    });
  }

  private async createState(saveStateDto: SaveStateDto): Promise<StatePayload> {
    const normalizedName = this.normalizeRequiredName(saveStateDto.stmName);
    const now = new Date();
    const createdBy = this.resolveActor(saveStateDto.stmCreatedBy);
    const modifiedBy = this.resolveActor(saveStateDto.stmModifiedBy, createdBy);
    const data: Prisma.StateMasterUncheckedCreateInput = {
      stmName: normalizedName,
      stmCreatedOn: now,
      stmCreatedBy: createdBy,
      stmModifiedOn: now,
      stmModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveStateDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureNameIsUnique(tx, normalizedName);

        const created = await tx.stateMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: STATE_TABLE_NAME,
            screenName: STATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.stmId,
            displayName: payload.stmName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'State created',
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

  private async updateState(saveStateDto: SaveStateDto): Promise<StatePayload> {
    const stmId = saveStateDto.stmId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.stateMaster.findFirst({
          where: {
            stmId,
            stmIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(stmId);
        }

        const normalizedName = this.normalizeRequiredName(saveStateDto.stmName);
        await this.ensureNameIsUnique(tx, normalizedName, stmId);

        const data: Prisma.StateMasterUncheckedUpdateInput = {
          stmName: normalizedName,
          stmModifiedOn: new Date(),
          stmModifiedBy: this.resolveActor(saveStateDto.stmModifiedBy),
        };
        this.applyOptionalFields(data, saveStateDto);

        const updated = await tx.stateMaster.update({
          where: {
            stmId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: STATE_TABLE_NAME,
            screenName: STATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: stmId,
            displayName: payload.stmName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.stmModifiedBy,
            notes: 'State updated',
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

  private async ensureNameIsUnique(
    tx: StateWriteClient,
    stateName: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.stateMaster.findFirst({
      where: {
        stmIsDeleted: false,
        stmName: {
          equals: stateName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              stmId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        stmId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('State name already exists', [
          {
            field: 'stmName',
            message: 'Duplicate state name is not allowed',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.StateMasterUncheckedCreateInput | Prisma.StateMasterUncheckedUpdateInput,
    saveStateDto: SaveStateDto,
  ): void {
    if (this.hasOwnProperty(saveStateDto, 'stmAlias')) {
      data.stmAlias = saveStateDto.stmAlias;
    }

    if (this.hasOwnProperty(saveStateDto, 'stmShort')) {
      data.stmShort = saveStateDto.stmShort;
    }

    if (this.hasOwnProperty(saveStateDto, 'stmOrder')) {
      data.stmOrder = saveStateDto.stmOrder;
    }

    if (this.hasOwnProperty(saveStateDto, 'stmIsActive')) {
      data.stmIsActive = saveStateDto.stmIsActive;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'stmName',
          message: 'stmName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: StateMaster): StatePayload {
    return {
      stmId: record.stmId,
      stmName: record.stmName,
      stmAlias: record.stmAlias,
      stmShort: record.stmShort,
      stmOrder: this.toNumber(record.stmOrder),
      stmIsActive: record.stmIsActive,
      stmIsDeleted: record.stmIsDeleted,
      stmSyncDate: record.stmSyncDate ? record.stmSyncDate.toISOString() : null,
      stmCreatedOn: record.stmCreatedOn.toISOString(),
      stmCreatedBy: record.stmCreatedBy,
      stmModifiedOn: record.stmModifiedOn.toISOString(),
      stmModifiedBy: record.stmModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
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
        this.buildErrorResponse('State already exists', [
          {
            field: 'stmName',
            message: 'Duplicate stmName is not allowed',
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

  private throwNotFound(stmId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('State not found', [
        {
          field: 'stmId',
          message: `No active state found with id ${stmId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: StateErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(message: string, errors: StateErrorDetail[] = []): StateErrorResponse {
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
