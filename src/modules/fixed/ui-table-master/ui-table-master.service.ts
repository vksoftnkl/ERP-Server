import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
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

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const UI_TABLE_MASTER_TABLE_NAME = 'ui_tables';
const UI_TABLE_MASTER_AUDIT_SCREEN_NAME = 'UI Table Master';

type UiTableMasterWriteClient = Prisma.TransactionClient | PrismaService;

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
  ): Promise<{ items: UiTableMasterListItem[]; meta: UiTableMasterListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.uiTblEditable !== undefined ||
      queryDto.uiTblIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.UitableWhereInput = {
      uiTblIsDeleted: false,
    };

    if (queryDto.uiTblEditable !== undefined) {
      where.uiTblEditable = queryDto.uiTblEditable;
    }

    if (queryDto.uiTblIsActive !== undefined) {
      where.uiTblIsActive = queryDto.uiTblIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [{ uiTblName: { contains: search, mode: 'insensitive' } }];
    }

    const [total, records] = await Promise.all([
      this.prisma.uitable.count({ where }),
      this.prisma.uitable.findMany({
        where,
        orderBy: [{ uiTblName: 'asc' }, { uiTblId: 'asc' }],
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
  ): Promise<{ items: UiTableMasterListItem[]; meta: UiTableMasterListMeta } | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: UI_TABLE_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      UI_TABLE_MASTER_TABLE_NAME,
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
      tableName: UI_TABLE_MASTER_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for UI table master', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }

    try {
      const result = await this.configuredGridSqlService.runPagedQuery<UiTableMasterListItem>({
        baseSql: validation.normalizedSql,
        alias: 'ui_table_master_grid',
        limit,
        skip,
      });

      return {
        items: result.items,
        meta: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
        },
      };
    } catch {
      this.throwBadRequest('Invalid grid_sql configuration for UI table master', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for ui_tables',
        },
      ]);
    }
  }

  async getById(uiTblId: string): Promise<UiTableMasterPayload> {
    const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);

    const record = await this.prisma.uitable.findFirst({
      where: {
        uiTblId: parsedUiTableId,
        uiTblIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(uiTblId);
    }

    return this.toPayload(record);
  }

  async softDelete(uiTblId: string): Promise<{ uiTblId: string; deleted: true }> {
    const parsedUiTableId = this.parseBigIntId('uiTblId', uiTblId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.uitable.findFirst({
        where: {
          uiTblId: parsedUiTableId,
          uiTblIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(uiTblId);
      }

      const modifiedOn = new Date();
      const result = await tx.uitable.updateMany({
        where: {
          uiTblId: parsedUiTableId,
          uiTblIsDeleted: false,
        },
        data: {
          uiTblIsDeleted: true,
          uiTblIsActive: false,
          uiTblModifiedOn: modifiedOn,
          uiTblModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(uiTblId);
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

      return {
        uiTblId,
        deleted: true,
      };
    });
  }

  private async createUiTable(
    saveUiTableMasterDto: SaveUiTableMasterDto,
  ): Promise<UiTableMasterPayload> {
    const normalizedName = this.normalizeRequiredName(saveUiTableMasterDto.uiTblName);
    const now = new Date();
    const createdBy = this.resolveActor(saveUiTableMasterDto.uiTblCreatedBy);
    const modifiedBy = this.resolveActor(saveUiTableMasterDto.uiTblModifiedBy, createdBy);
    const data: Prisma.UitableUncheckedCreateInput = {
      uiTblName: normalizedName,
      uiTblCreatedOn: now,
      uiTblCreatedBy: createdBy,
      uiTblModifiedOn: now,
      uiTblModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveUiTableMasterDto);

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
      this.handleWriteError(error);
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
          where: {
            uiTblId: parsedUiTableId,
            uiTblIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(uiTblId);
        }

        const normalizedName = this.normalizeRequiredName(saveUiTableMasterDto.uiTblName);
        await this.ensureNameIsUnique(tx, normalizedName, parsedUiTableId);

        const data: Prisma.UitableUncheckedUpdateInput = {
          uiTblName: normalizedName,
          uiTblModifiedOn: new Date(),
          uiTblModifiedBy: this.resolveActor(saveUiTableMasterDto.uiTblModifiedBy),
        };
        this.applyOptionalFields(data, saveUiTableMasterDto);

        const updated = await tx.uitable.update({
          where: {
            uiTblId: parsedUiTableId,
          },
          data,
        });
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
            userId: this.resolveActor(saveUiTableMasterDto.uiTblModifiedBy),
            notes: 'UI table updated',
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
    tx: UiTableMasterWriteClient,
    uiTblName: string,
    excludeId?: bigint,
  ): Promise<void> {
    const existing = await tx.uitable.findFirst({
      where: {
        uiTblIsDeleted: false,
        uiTblName: {
          equals: uiTblName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              uiTblId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        uiTblId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('UI table name already exists', [
          {
            field: 'uiTblName',
            message: 'Duplicate uiTblName is not allowed',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.UitableUncheckedCreateInput | Prisma.UitableUncheckedUpdateInput,
    saveUiTableMasterDto: SaveUiTableMasterDto,
  ): void {
    if (this.hasOwnProperty(saveUiTableMasterDto, 'uiTblEditable')) {
      data.uiTblEditable = saveUiTableMasterDto.uiTblEditable;
    }

    if (this.hasOwnProperty(saveUiTableMasterDto, 'uiTblIsActive')) {
      data.uiTblIsActive = saveUiTableMasterDto.uiTblIsActive;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'uiTblName',
          message: 'uiTblName must not be empty',
        },
      ]);
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

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    if (!value) {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
  }

  private resolveDisplayName(uiTblName: string | null, uiTblId: string): string {
    return uiTblName?.trim() || `UI Table ${uiTblId}`;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('UI table already exists', [
          {
            field: 'uiTblName',
            message: 'Duplicate uiTblName is not allowed',
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

  private throwNotFound(uiTblId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('UI table not found', [
        {
          field: 'uiTblId',
          message: `No active UI table found with id ${uiTblId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: UiTableMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private parseBigIntId(field: string, value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a numeric id`,
        },
      ]);
    }

    return BigInt(normalized);
  }

  private buildErrorResponse(
    message: string,
    errors: UiTableMasterErrorDetail[] = [],
  ): UiTableMasterErrorResponse {
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
