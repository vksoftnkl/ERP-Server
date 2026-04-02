import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const UI_TABLE_COLUMNS_TABLE_NAME = 'ui_table_columns';
const UI_TABLE_COLUMNS_AUDIT_SCREEN_NAME = 'UI Table Columns';

type UiTableColumnsWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UiTableColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
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
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.uiTblClmId !== undefined ||
      queryDto.uiTblClmNo !== undefined ||
      queryDto.uiTblClmTableId !== undefined ||
      queryDto.uiTblClmIsActive !== undefined ||
      queryDto.uiTblClmColumnVisibility !== undefined ||
      queryDto.uiTblClmColumnFocus !== undefined ||
      queryDto.uiTblClmColumnNecessity !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.UitableColumnsWhereInput = {
      uiTblClmIsDeleted: false,
    };

    if (queryDto.uiTblClmId !== undefined) {
      where.uiTblClmId = this.parseBigIntId('uiTblClmId', queryDto.uiTblClmId);
    }

    if (queryDto.uiTblClmNo !== undefined) {
      where.uiTblClmNo = this.parseBigIntId('uiTblClmNo', queryDto.uiTblClmNo);
    }

    if (queryDto.uiTblClmTableId !== undefined) {
      where.uiTblClmTableId = this.parseBigIntId('uiTblClmTableId', queryDto.uiTblClmTableId);
    }

    if (queryDto.uiTblClmIsActive !== undefined) {
      where.uiTblClmIsActive = queryDto.uiTblClmIsActive;
    }

    if (queryDto.uiTblClmColumnVisibility !== undefined) {
      where.uiTblClmColumnVisibility = queryDto.uiTblClmColumnVisibility;
    }

    if (queryDto.uiTblClmColumnFocus !== undefined) {
      where.uiTblClmColumnFocus = queryDto.uiTblClmColumnFocus;
    }

    if (queryDto.uiTblClmColumnNecessity !== undefined) {
      where.uiTblClmColumnNecessity = queryDto.uiTblClmColumnNecessity;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [{ uiTblClmName: { contains: search, mode: 'insensitive' } }];
    }

    const [total, records] = await Promise.all([
      this.prisma.uitableColumns.count({ where }),
      this.prisma.uitableColumns.findMany({
        where,
        orderBy: [{ uiTblClmColumnPosition: 'asc' }, { uiTblClmId: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<UiTableColumnListItem, UiTableColumnListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: UI_TABLE_COLUMNS_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      UI_TABLE_COLUMNS_TABLE_NAME,
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
      tableName: UI_TABLE_COLUMNS_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for UI table columns', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }

    try {
      const result = await this.configuredGridSqlService.runPagedQuery<UiTableColumnListItem>({
        baseSql: validation.normalizedSql,
        alias: 'ui_table_columns_grid',
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
      this.throwBadRequest('Invalid grid_sql configuration for UI table columns', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for ui_table_columns',
        },
      ]);
    }
  }

  async getById(uiTblClmId: string): Promise<UiTableColumnPayload> {
    const parsedUiTblClmId = this.parseBigIntId('uiTblClmId', uiTblClmId);

    const record = await this.prisma.uitableColumns.findFirst({
      where: {
        uiTblClmId: parsedUiTblClmId,
        uiTblClmIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(uiTblClmId);
    }

    return this.toPayload(record);
  }

  async softDelete(uiTblClmId: string): Promise<{ uiTblClmId: string; deleted: true }> {
    const parsedUiTblClmId = this.parseBigIntId('uiTblClmId', uiTblClmId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.uitableColumns.findFirst({
        where: {
          uiTblClmId: parsedUiTblClmId,
          uiTblClmIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(uiTblClmId);
      }

      const modifiedOn = new Date();
      const result = await tx.uitableColumns.updateMany({
        where: {
          uiTblClmId: parsedUiTblClmId,
          uiTblClmIsDeleted: false,
        },
        data: {
          uiTblClmIsDeleted: true,
          uiTblClmIsActive: false,
          uiTblClmModifiedOn: modifiedOn,
          uiTblClmModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(uiTblClmId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        uiTblClmIsDeleted: true,
        uiTblClmIsActive: false,
        uiTblClmModifiedOn: modifiedOn,
        uiTblClmModifiedBy: DEFAULT_ACTOR,
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
          userId: DEFAULT_ACTOR,
          notes: 'UI table column soft deleted',
        },
        tx,
      );

      return {
        uiTblClmId,
        deleted: true,
      };
    });
  }

  private async createUiTableColumn(
    saveUiTableColumnDto: SaveUiTableColumnDto,
  ): Promise<UiTableColumnPayload> {
    const normalizedName = this.normalizeRequiredName(saveUiTableColumnDto.uiTblClmName);
    const parsedUiTblClmNo = this.parseNullableBigIntId('uiTblClmNo', saveUiTableColumnDto.uiTblClmNo);
    const parsedUiTblClmTableId = this.parseNullableBigIntId(
      'uiTblClmTableId',
      saveUiTableColumnDto.uiTblClmTableId,
    );
    const now = new Date();
    const createdBy = this.resolveActor(saveUiTableColumnDto.uiTblClmCreatedBy);
    const modifiedBy = this.resolveActor(saveUiTableColumnDto.uiTblClmModifiedBy, createdBy);
    const data: Prisma.UitableColumnsUncheckedCreateInput = {
      uiTblClmName: normalizedName,
      uiTblClmCreatedOn: now,
      uiTblClmCreatedBy: createdBy,
      uiTblClmModifiedOn: now,
      uiTblClmModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveUiTableColumnDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureUiTableExists(
          parsedUiTblClmTableId,
          saveUiTableColumnDto.uiTblClmTableId,
          tx,
        );
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
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateUiTableColumn(
    saveUiTableColumnDto: SaveUiTableColumnDto,
  ): Promise<UiTableColumnPayload> {
    const uiTblClmId = saveUiTableColumnDto.uiTblClmId!;
    const parsedUiTblClmId = this.parseBigIntId('uiTblClmId', uiTblClmId);
    const parsedUiTblClmNo = this.parseNullableBigIntId('uiTblClmNo', saveUiTableColumnDto.uiTblClmNo);
    const parsedUiTblClmTableId = this.parseNullableBigIntId(
      'uiTblClmTableId',
      saveUiTableColumnDto.uiTblClmTableId,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.uitableColumns.findFirst({
          where: {
            uiTblClmId: parsedUiTblClmId,
            uiTblClmIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(uiTblClmId);
        }

        const normalizedName = this.normalizeRequiredName(saveUiTableColumnDto.uiTblClmName);
        const data: Prisma.UitableColumnsUncheckedUpdateInput = {
          uiTblClmName: normalizedName,
          uiTblClmModifiedOn: new Date(),
          uiTblClmModifiedBy: this.resolveActor(saveUiTableColumnDto.uiTblClmModifiedBy),
        };
        await this.ensureUiTableExists(
          parsedUiTblClmTableId,
          saveUiTableColumnDto.uiTblClmTableId,
          tx,
        );
        this.applyOptionalFields(data, saveUiTableColumnDto);
        this.assignUiTableColumnNo(data, parsedUiTblClmNo);
        this.assignUiTableColumnTableId(data, parsedUiTblClmTableId);

        const updated = await tx.uitableColumns.update({
          where: {
            uiTblClmId: parsedUiTblClmId,
          },
          data,
        });
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
            userId: this.resolveActor(saveUiTableColumnDto.uiTblClmModifiedBy),
            notes: 'UI table column updated',
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

  private applyOptionalFields(
    data:
      | Prisma.UitableColumnsUncheckedCreateInput
      | Prisma.UitableColumnsUncheckedUpdateInput,
    saveUiTableColumnDto: SaveUiTableColumnDto,
  ): void {
    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmColumnWidth')) {
      data.uiTblClmColumnWidth = saveUiTableColumnDto.uiTblClmColumnWidth;
    }

    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmColumnVisibility')) {
      data.uiTblClmColumnVisibility = saveUiTableColumnDto.uiTblClmColumnVisibility;
    }

    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmColumnFocus')) {
      data.uiTblClmColumnFocus = saveUiTableColumnDto.uiTblClmColumnFocus;
    }

    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmColumnPosition')) {
      data.uiTblClmColumnPosition = saveUiTableColumnDto.uiTblClmColumnPosition;
    }

    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmColumnNecessity')) {
      data.uiTblClmColumnNecessity = saveUiTableColumnDto.uiTblClmColumnNecessity;
    }

    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmNextColumn')) {
      data.uiTblClmNextColumn = saveUiTableColumnDto.uiTblClmNextColumn;
    }

    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmPreviousColumn')) {
      data.uiTblClmPreviousColumn = saveUiTableColumnDto.uiTblClmPreviousColumn;
    }

    if (this.hasOwnProperty(saveUiTableColumnDto, 'uiTblClmIsActive')) {
      data.uiTblClmIsActive = saveUiTableColumnDto.uiTblClmIsActive;
    }
  }

  private assignUiTableColumnTableId(
    data:
      | Prisma.UitableColumnsUncheckedCreateInput
      | Prisma.UitableColumnsUncheckedUpdateInput,
    uiTblClmTableId: bigint | null | undefined,
  ): void {
    if (uiTblClmTableId !== undefined) {
      data.uiTblClmTableId = uiTblClmTableId;
    }
  }

  private assignUiTableColumnNo(
    data:
      | Prisma.UitableColumnsUncheckedCreateInput
      | Prisma.UitableColumnsUncheckedUpdateInput,
    uiTblClmNo: bigint | null | undefined,
  ): void {
    if (uiTblClmNo !== undefined && uiTblClmNo !== null) {
      data.uiTblClmNo = uiTblClmNo;
    }
  }

  private async ensureUiTableExists(
    uiTblClmTableId: bigint | null | undefined,
    rawUiTblClmTableId: string | null | undefined,
    tx: UiTableColumnsWriteClient = this.prisma,
  ): Promise<void> {
    if (uiTblClmTableId === undefined || uiTblClmTableId === null) {
      return;
    }

    const uiTable = await tx.uitable.findFirst({
      where: {
        uiTblId: uiTblClmTableId,
        uiTblIsDeleted: false,
      },
      select: {
        uiTblId: true,
      },
    });

    if (!uiTable) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'uiTblClmTableId',
          message: `No active UI table found with id ${rawUiTblClmTableId}`,
        },
      ]);
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'uiTblClmName',
          message: 'uiTblClmName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: UitableColumns): UiTableColumnPayload {
    return {
      uiTblClmId: record.uiTblClmId.toString(),
      uiTblClmNo: record.uiTblClmNo?.toString() ?? '',
      uiTblClmName: record.uiTblClmName,
      uiTblClmTableId: record.uiTblClmTableId?.toString() ?? null,
      uiTblClmColumnWidth: this.toNullableNumber(record.uiTblClmColumnWidth),
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

  private toNullableNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    if (!value) {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
  }

  private resolveDisplayName(uiTblClmName: string | null, uiTblClmId: string): string {
    return uiTblClmName?.trim() || `UI Table Column ${uiTblClmId}`;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('UI table column already exists', [
          {
            field: 'uiTblClmName',
            message: 'Duplicate uiTblClmName is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'uiTblClmTableId',
            message: 'Referenced UI table does not exist',
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

  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2003';
  }

  private throwNotFound(uiTblClmId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('UI table column not found', [
        {
          field: 'uiTblClmId',
          message: `No active UI table column found with id ${uiTblClmId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: UiTableColumnErrorDetail[]): never {
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

  private parseNullableBigIntId(
    field: string,
    value: string | null | undefined,
  ): bigint | null | undefined {
    if (value === undefined || value === null) {
      return value;
    }

    return this.parseBigIntId(field, value);
  }

  private buildErrorResponse(
    message: string,
    errors: UiTableColumnErrorDetail[] = [],
  ): UiTableColumnErrorResponse {
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
