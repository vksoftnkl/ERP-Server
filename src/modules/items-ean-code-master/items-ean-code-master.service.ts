import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemEanCode, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemEanCodeQueryDto } from './dto/list-item-ean-code-query.dto';
import { SaveItemEanCodeDto } from './dto/save-item-ean-code.dto';
import {
  ItemEanCodeDeleteResult,
  ItemEanCodeErrorDetail,
  ItemEanCodeErrorResponse,
  ItemEanCodeListItem,
  ItemEanCodeListMeta,
  ItemEanCodePayload,
} from './types/item-ean-code-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ITEM_EAN_CODE_TABLE_NAME = 'item_ean_codes';
const ITEM_EAN_CODE_AUDIT_SCREEN_NAME = 'Item EAN Code Master';

@Injectable()
export class ItemsEanCodeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveItemEanCodeDto: SaveItemEanCodeDto): Promise<ItemEanCodePayload>;
  async save(saveItemEanCodeDto: SaveItemEanCodeDto[]): Promise<ItemEanCodePayload[]>;
  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto | SaveItemEanCodeDto[],
  ): Promise<ItemEanCodePayload | ItemEanCodePayload[]>;
  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto | SaveItemEanCodeDto[],
  ): Promise<ItemEanCodePayload | ItemEanCodePayload[]> {
    const saveItems = Array.isArray(saveItemEanCodeDto) ? saveItemEanCodeDto : [saveItemEanCodeDto];

    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const savedItems: ItemEanCodePayload[] = [];

        for (const saveItem of saveItems) {
          savedItems.push(await this.saveItemEanCode(tx, saveItem));
        }

        return savedItems;
      });

      return Array.isArray(saveItemEanCodeDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  async list(
    queryDto: ListItemEanCodeQueryDto,
  ): Promise<ConfiguredGridListResult<ItemEanCodeListItem, ItemEanCodeListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.ean_item_id !== undefined ||
      queryDto.ean_unit_id !== undefined ||
      queryDto.ean_godown_id !== undefined ||
      queryDto.ean_is_active !== undefined ||
      queryDto.ean_is_default !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.itemEanCode.count({ where }),
      this.prisma.itemEanCode.findMany({
        where,
        orderBy: [{ eanCode: 'asc' }, { eanId: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<ItemEanCodeListItem, ItemEanCodeListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_EAN_CODE_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_EAN_CODE_TABLE_NAME,
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
        tableName: ITEM_EAN_CODE_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemEanCodeListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_ean_code_grid',
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

  async getById(eanId: string): Promise<ItemEanCodePayload> {
    const record = await this.prisma.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(eanId);
    }

    return this.toPayload(record);
  }

  async softDelete(eanId: string): Promise<ItemEanCodeDeleteResult>;
  async softDelete(eanId: string[]): Promise<ItemEanCodeDeleteResult[]>;
  async softDelete(
    eanId: string | string[],
  ): Promise<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]>;
  async softDelete(
    eanId: string | string[],
  ): Promise<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]> {
    const deleteIds = Array.isArray(eanId) ? eanId : [eanId];

    const results = await this.prisma.$transaction(async (tx) => {
      const deletedItems: ItemEanCodeDeleteResult[] = [];

      for (const deleteId of deleteIds) {
        deletedItems.push(await this.softDeleteItemEanCode(tx, deleteId));
      }

      return deletedItems;
    });

    return Array.isArray(eanId) ? results : results[0];
  }

  private async saveItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    if (saveItemEanCodeDto.ean_id) {
      return this.updateItemEanCode(tx, saveItemEanCodeDto);
    }

    return this.createItemEanCode(tx, saveItemEanCodeDto);
  }

  private async softDeleteItemEanCode(
    tx: Prisma.TransactionClient,
    eanId: string,
  ): Promise<ItemEanCodeDeleteResult> {
    const existing = await tx.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwNotFound(eanId);
    }

    const modifiedOn = new Date();
    const modifiedBy = DEFAULT_ACTOR;
    const result = await tx.itemEanCode.updateMany({
      where: {
        eanId,
        eanIsDeleted: false,
      },
      data: {
        eanIsDeleted: true,
        eanModifiedOn: modifiedOn,
        eanModifiedBy: modifiedBy,
      },
    });
    if (result.count === 0) {
      this.throwNotFound(eanId);
    }

    const originalRecord = this.toPayload(existing);
    const modifiedRecord = this.toPayload({
      ...existing,
      eanIsDeleted: true,
      eanModifiedOn: modifiedOn,
      eanModifiedBy: modifiedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: eanId,
        displayName: existing.eanCode,
        originalRecord,
        modifiedRecord,
        userId: modifiedBy,
        notes: 'Item EAN code soft deleted',
      },
      tx,
    );

    return {
      ean_id: eanId,
      deleted: true,
    };
  }

  private async createItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    const eanCode = saveItemEanCodeDto.ean_code?.trim();
    if (!eanCode) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ean_code',
          message: 'ean_code is required',
        },
      ]);
    }

    const now = new Date();
    const createdBy = this.resolveActor(saveItemEanCodeDto.ean_created_by);
    const modifiedBy = this.resolveActor(saveItemEanCodeDto.ean_modified_by, createdBy);
    const data: Prisma.ItemEanCodeUncheckedCreateInput = {
      eanItemId: saveItemEanCodeDto.ean_item_id,
      eanUnitId: saveItemEanCodeDto.ean_unit_id,
      eanCode,
      eanCreatedOn: now,
      eanCreatedBy: createdBy,
      eanModifiedOn: now,
      eanModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveItemEanCodeDto);

    const created = await tx.itemEanCode.create({ data });
    await this.enforceSingleDefaultInScope(tx, created, created.eanModifiedBy ?? modifiedBy);

    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ean_id,
        displayName: payload.ean_code,
        originalRecord: null,
        modifiedRecord: payload,
        userId: createdBy,
        notes: 'Item EAN code created',
      },
      tx,
    );

    return payload;
  }

  private async updateItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    const eanId = saveItemEanCodeDto.ean_id!;

    const existing = await tx.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwNotFound(eanId);
    }

    const eanCode = saveItemEanCodeDto.ean_code?.trim();
    if (!eanCode) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ean_code',
          message: 'ean_code cannot be empty',
        },
      ]);
    }

    const data: Prisma.ItemEanCodeUncheckedUpdateInput = {
      eanItemId: saveItemEanCodeDto.ean_item_id,
      eanUnitId: saveItemEanCodeDto.ean_unit_id,
      eanCode,
      eanModifiedOn: new Date(),
      eanModifiedBy: this.resolveActor(saveItemEanCodeDto.ean_modified_by),
    };
    this.applyOptionalFields(data, saveItemEanCodeDto);

    const updated = await tx.itemEanCode.update({
      where: {
        eanId,
      },
      data,
    });

    await this.enforceSingleDefaultInScope(tx, updated, updated.eanModifiedBy ?? DEFAULT_ACTOR);

    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: eanId,
        displayName: payload.ean_code,
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: payload.ean_modified_by ?? DEFAULT_ACTOR,
        notes: 'Item EAN code updated',
      },
      tx,
    );

    return payload;
  }

  private buildListWhere(queryDto: ListItemEanCodeQueryDto): Prisma.ItemEanCodeWhereInput {
    const where: Prisma.ItemEanCodeWhereInput = {
      eanIsDeleted: false,
    };

    if (queryDto.ean_item_id !== undefined) {
      where.eanItemId = queryDto.ean_item_id;
    }

    if (queryDto.ean_unit_id !== undefined) {
      where.eanUnitId = queryDto.ean_unit_id;
    }

    if (queryDto.ean_godown_id !== undefined) {
      where.eanGodownId = queryDto.ean_godown_id;
    }

    if (queryDto.ean_is_active !== undefined) {
      where.eanIsActive = queryDto.ean_is_active;
    }

    if (queryDto.ean_is_default !== undefined) {
      where.eanIsDefault = queryDto.ean_is_default;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { eanCode: { contains: search, mode: 'insensitive' } },
        { eanRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private applyOptionalFields(
    data: Prisma.ItemEanCodeUncheckedCreateInput | Prisma.ItemEanCodeUncheckedUpdateInput,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): void {
    if (this.hasOwnProperty(saveItemEanCodeDto, 'ean_godown_id')) {
      data.eanGodownId = saveItemEanCodeDto.ean_godown_id;
    }

    if (this.hasOwnProperty(saveItemEanCodeDto, 'ean_is_default')) {
      data.eanIsDefault = saveItemEanCodeDto.ean_is_default;
    }

    if (this.hasOwnProperty(saveItemEanCodeDto, 'ean_is_active')) {
      data.eanIsActive = saveItemEanCodeDto.ean_is_active;
    }

    if (this.hasOwnProperty(saveItemEanCodeDto, 'ean_remarks')) {
      data.eanRemarks = saveItemEanCodeDto.ean_remarks;
    }
  }

  private async enforceSingleDefaultInScope(
    tx: Prisma.TransactionClient,
    record: ItemEanCode,
    actor: string,
  ): Promise<void> {
    if (!record.eanIsDefault) {
      return;
    }

    await tx.itemEanCode.updateMany({
      where: {
        eanItemId: record.eanItemId,
        eanUnitId: record.eanUnitId,
        eanGodownId: record.eanGodownId,
        eanIsDeleted: false,
        eanIsDefault: true,
        eanId: {
          not: record.eanId,
        },
      },
      data: {
        eanIsDefault: false,
        eanModifiedOn: new Date(),
        eanModifiedBy: actor,
      },
    });
  }

  private toPayload(record: ItemEanCode): ItemEanCodePayload {
    return {
      ean_id: record.eanId,
      ean_item_id: record.eanItemId,
      ean_unit_id: record.eanUnitId,
      ean_code: record.eanCode,
      ean_godown_id: record.eanGodownId,
      ean_is_default: record.eanIsDefault,
      ean_is_active: record.eanIsActive,
      ean_is_deleted: record.eanIsDeleted,
      ean_created_on: record.eanCreatedOn.toISOString(),
      ean_created_by: record.eanCreatedBy,
      ean_modified_on: record.eanModifiedOn.toISOString(),
      ean_modified_by: record.eanModifiedBy,
      ean_remarks: record.eanRemarks,
    };
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('EAN code already exists', [
          {
            field: 'ean_code',
            message: 'Duplicate ean_code is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'ean_unit_id',
            message: 'Referenced relation does not exist',
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

  private throwNotFound(eanId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item EAN code not found', [
        {
          field: 'ean_id',
          message: `No active item EAN code found with id ${eanId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemEanCodeErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemEanCodeErrorDetail[] = [],
  ): ItemEanCodeErrorResponse {
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
