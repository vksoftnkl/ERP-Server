import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const STATE_CODE_MASTER_TABLE_NAME = 'state codes';
const STATE_CODE_MASTER_AUDIT_SCREEN_NAME = 'State Code Master';

type StateCodeMasterWriteClient = Prisma.TransactionClient | PrismaService;

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
      where: {
        stateCode,
      },
      select: {
        stateCode: true,
      },
    });

    if (existing) {
      return this.updateStateCode(saveStateCodeMasterDto, stateCode);
    }

    return this.createStateCode(saveStateCodeMasterDto, stateCode);
  }

  async list(
    queryDto: ListStateCodeMasterQueryDto,
  ): Promise<ConfiguredGridListResult<StateCodeMasterListItem, StateCodeMasterListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.isActive !== undefined ||
      queryDto.stateUt !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.StateCodeWhereInput = {
      isDeleted: false,
    };

    if (queryDto.isActive !== undefined) {
      where.isActive = queryDto.isActive;
    }

    if (queryDto.stateUt !== undefined) {
      where.stateUt = queryDto.stateUt;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { stateCode: { contains: search, mode: 'insensitive' } },
        { stateName: { contains: search, mode: 'insensitive' } },
        { tinCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.stateCode.count({ where }),
      this.prisma.stateCode.findMany({
        where,
        orderBy: [{ stateName: 'asc' }, { stateCode: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<StateCodeMasterListItem, StateCodeMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: STATE_CODE_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      STATE_CODE_MASTER_TABLE_NAME,
    );
    const configuredGrid = primaryConfiguredGrids[0];
    if (!configuredGrid) {
      return null;
    }
    const rawGridSql = configuredGrid.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }

    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: rawGridSql,
      tableName: STATE_CODE_MASTER_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for state code master', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }

    try {
      const result = await this.configuredGridSqlService.runPagedQuery<StateCodeMasterListItem>({
        baseSql: validation.normalizedSql,
        alias: 'state_code_master_grid',
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
      this.throwBadRequest('Invalid grid_sql configuration for state code master', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for state_codes',
        },
      ]);
    }
  }

  async getById(stateCodeValue: string): Promise<StateCodeMasterPayload> {
    const stateCode = this.normalizeStateCode(stateCodeValue);
    const record = await this.prisma.stateCode.findFirst({
      where: {
        stateCode,
        isDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(stateCode);
    }

    return this.toPayload(record);
  }

  async softDelete(stateCodeValue: string): Promise<{ stateCode: string; deleted: true }> {
    const stateCode = this.normalizeStateCode(stateCodeValue);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stateCode.findFirst({
        where: {
          stateCode,
          isDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(stateCode);
      }

      const modifiedOn = new Date();
      const result = await tx.stateCode.updateMany({
        where: {
          stateCode,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          isActive: false,
          modifiedOn,
          modifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(stateCode);
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

      return {
        stateCode,
        deleted: true,
      };
    });
  }

  private async createStateCode(
    saveStateCodeMasterDto: SaveStateCodeMasterDto,
    stateCode: string,
  ): Promise<StateCodeMasterPayload> {
    const normalizedName = this.normalizeRequiredText(
      saveStateCodeMasterDto.stateName,
      'stateName',
    );
    const now = new Date();
    const createdBy = this.resolveActor(saveStateCodeMasterDto.createdBy);
    const modifiedBy = this.resolveActor(saveStateCodeMasterDto.modifiedBy, createdBy);
    const data: Prisma.StateCodeUncheckedCreateInput = {
      stateCode,
      stateName: normalizedName,
      createdOn: now,
      createdBy,
      modifiedOn: now,
      modifiedBy,
    };
    this.applyOptionalFields(data, saveStateCodeMasterDto);

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
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateStateCode(
    saveStateCodeMasterDto: SaveStateCodeMasterDto,
    stateCode: string,
  ): Promise<StateCodeMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.stateCode.findUnique({
          where: {
            stateCode,
          },
        });

        if (!existing) {
          this.throwNotFound(stateCode);
        }

        const normalizedName = this.normalizeRequiredText(
          saveStateCodeMasterDto.stateName,
          'stateName',
        );

        await this.ensureStateNameIsUnique(tx, normalizedName, stateCode);

        const data: Prisma.StateCodeUncheckedUpdateInput = {
          stateName: normalizedName,
          isDeleted: false,
          modifiedOn: new Date(),
          modifiedBy: this.resolveActor(saveStateCodeMasterDto.modifiedBy),
        };
        this.applyOptionalFields(data, saveStateCodeMasterDto);

        const updated = await tx.stateCode.update({
          where: {
            stateCode,
          },
          data,
        });
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
            userId: this.resolveActor(saveStateCodeMasterDto.modifiedBy),
            notes: existing.isDeleted ? 'State code restored and updated' : 'State code updated',
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

  private async ensureStateNameIsUnique(
    tx: StateCodeMasterWriteClient,
    stateName: string,
    excludeCode?: string,
  ): Promise<void> {
    const existing = await tx.stateCode.findFirst({
      where: {
        isDeleted: false,
        stateName: {
          equals: stateName,
          mode: 'insensitive',
        },
        ...(excludeCode
          ? {
              stateCode: {
                not: excludeCode,
              },
            }
          : {}),
      },
      select: {
        stateCode: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('State name already exists', [
          {
            field: 'stateName',
            message: 'Duplicate stateName is not allowed',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.StateCodeUncheckedCreateInput | Prisma.StateCodeUncheckedUpdateInput,
    saveStateCodeMasterDto: SaveStateCodeMasterDto,
  ): void {
    if (this.hasOwnProperty(saveStateCodeMasterDto, 'stateUt')) {
      data.stateUt = saveStateCodeMasterDto.stateUt;
    }

    if (this.hasOwnProperty(saveStateCodeMasterDto, 'tinCode')) {
      data.tinCode = saveStateCodeMasterDto.tinCode;
    }

    if (this.hasOwnProperty(saveStateCodeMasterDto, 'isActive')) {
      data.isActive = saveStateCodeMasterDto.isActive;
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

  private normalizeStateCode(value: string, fieldName = 'stateCode'): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized || normalized.length !== 2) {
      this.throwBadRequest('Validation failed', [
        {
          field: fieldName,
          message: `${fieldName} must be a 2-character code`,
        },
      ]);
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
        this.buildErrorResponse('State code already exists', [
          {
            field: 'stateCode',
            message: 'Duplicate stateCode is not allowed',
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

  private throwNotFound(stateCode: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('State code not found', [
        {
          field: 'stateCode',
          message: `No active state code found with code ${stateCode}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: StateCodeMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: StateCodeMasterErrorDetail[] = [],
  ): StateCodeMasterErrorResponse {
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
