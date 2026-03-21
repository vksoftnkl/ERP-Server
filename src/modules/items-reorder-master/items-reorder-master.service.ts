import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemReorder, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemReorderQueryDto } from './dto/list-item-reorder-query.dto';
import { SaveItemReorderDto } from './dto/save-item-reorder.dto';
import {
  ItemReorderDeleteResult,
  ItemReorderErrorDetail,
  ItemReorderErrorResponse,
  ItemReorderListItem,
  ItemReorderListMeta,
  ItemReorderPayload,
} from './types/item-reorder-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const ITEM_REORDER_TABLE_NAME = 'item_reorders';
const ITEM_REORDER_AUDIT_SCREEN_NAME = 'Item Reorder Master';

@Injectable()
export class ItemsReorderMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveItemReorderDto: SaveItemReorderDto): Promise<ItemReorderPayload>;
  async save(saveItemReorderDto: SaveItemReorderDto[]): Promise<ItemReorderPayload[]>;
  async save(
    saveItemReorderDto: SaveItemReorderDto | SaveItemReorderDto[],
  ): Promise<ItemReorderPayload | ItemReorderPayload[]>;
  async save(
    saveItemReorderDto: SaveItemReorderDto | SaveItemReorderDto[],
  ): Promise<ItemReorderPayload | ItemReorderPayload[]> {
    const saveItems = Array.isArray(saveItemReorderDto) ? saveItemReorderDto : [saveItemReorderDto];

    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const savedItems: ItemReorderPayload[] = [];

        for (const saveItem of saveItems) {
          savedItems.push(await this.saveItemReorder(tx, saveItem));
        }

        return savedItems;
      });

      return Array.isArray(saveItemReorderDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  async list(
    queryDto: ListItemReorderQueryDto,
  ): Promise<{ items: ItemReorderListItem[]; meta: ItemReorderListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.ir_branch_id !== undefined ||
      queryDto.ir_item_id !== undefined ||
      queryDto.ir_unit_id !== undefined ||
      queryDto.ir_godown_id !== undefined ||
      queryDto.ir_reorder_type !== undefined ||
      queryDto.ir_is_active !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.itemReorder.count({ where }),
      this.prisma.itemReorder.findMany({
        where,
        orderBy: [{ irItemId: 'asc' }, { irId: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<ItemReorderListItem, ItemReorderListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_REORDER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_REORDER_TABLE_NAME,
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
        tableName: ITEM_REORDER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemReorderListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_reorder_grid',
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

  async getById(irId: string): Promise<ItemReorderPayload> {
    const record = await this.prisma.itemReorder.findFirst({
      where: {
        irId,
        irIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(irId);
    }

    return this.toPayload(record);
  }

  async softDelete(irId: string): Promise<ItemReorderDeleteResult>;
  async softDelete(irId: string[]): Promise<ItemReorderDeleteResult[]>;
  async softDelete(
    irId: string | string[],
  ): Promise<ItemReorderDeleteResult | ItemReorderDeleteResult[]>;
  async softDelete(
    irId: string | string[],
  ): Promise<ItemReorderDeleteResult | ItemReorderDeleteResult[]> {
    const deleteIds = Array.isArray(irId) ? irId : [irId];

    const results = await this.prisma.$transaction(async (tx) => {
      const deletedItems: ItemReorderDeleteResult[] = [];

      for (const deleteId of deleteIds) {
        deletedItems.push(await this.softDeleteItemReorder(tx, deleteId));
      }

      return deletedItems;
    });

    return Array.isArray(irId) ? results : results[0];
  }

  private async saveItemReorder(
    tx: Prisma.TransactionClient,
    saveItemReorderDto: SaveItemReorderDto,
  ): Promise<ItemReorderPayload> {
    if (saveItemReorderDto.ir_id) {
      return this.updateItemReorder(tx, saveItemReorderDto);
    }

    return this.createItemReorder(tx, saveItemReorderDto);
  }

  private async softDeleteItemReorder(
    tx: Prisma.TransactionClient,
    irId: string,
  ): Promise<ItemReorderDeleteResult> {
    const existing = await tx.itemReorder.findFirst({
      where: {
        irId,
        irIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwNotFound(irId);
    }

    const modifiedOn = new Date();
    const modifiedBy = DEFAULT_ACTOR;
    const result = await tx.itemReorder.updateMany({
      where: {
        irId,
        irIsDeleted: false,
      },
      data: {
        irIsDeleted: true,
        irModifiedOn: modifiedOn,
        irModifiedBy: modifiedBy,
      },
    });
    if (result.count === 0) {
      this.throwNotFound(irId);
    }

    const originalRecord = this.toPayload(existing);
    const modifiedRecord = this.toPayload({
      ...existing,
      irIsDeleted: true,
      irModifiedOn: modifiedOn,
      irModifiedBy: modifiedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: ITEM_REORDER_TABLE_NAME,
        screenName: ITEM_REORDER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: irId,
        displayName: this.buildDisplayName(existing),
        originalRecord,
        modifiedRecord,
        userId: modifiedBy,
        notes: 'Item reorder soft deleted',
      },
      tx,
    );

    return {
      ir_id: irId,
      deleted: true,
    };
  }

  private async createItemReorder(
    tx: Prisma.TransactionClient,
    saveItemReorderDto: SaveItemReorderDto,
  ): Promise<ItemReorderPayload> {
    this.validateReorderRange(saveItemReorderDto);

    const now = new Date();
    const createdBy = this.resolveActor(saveItemReorderDto.ir_created_by);
    const modifiedBy = this.resolveActor(saveItemReorderDto.ir_modified_by, createdBy);
    const data: Prisma.ItemReorderUncheckedCreateInput = {
      irItemId: saveItemReorderDto.ir_item_id,
      irUnitId: saveItemReorderDto.ir_unit_id,
      irCreatedOn: now,
      irCreatedBy: createdBy,
      irModifiedOn: now,
      irModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveItemReorderDto);

    const created = await tx.itemReorder.create({ data });
    const payload = this.toPayload(created);

    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_REORDER_TABLE_NAME,
        screenName: ITEM_REORDER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ir_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: createdBy,
        notes: 'Item reorder created',
      },
      tx,
    );

    return payload;
  }

  private async updateItemReorder(
    tx: Prisma.TransactionClient,
    saveItemReorderDto: SaveItemReorderDto,
  ): Promise<ItemReorderPayload> {
    const irId = saveItemReorderDto.ir_id!;
    this.validateReorderRange(saveItemReorderDto);

    const existing = await tx.itemReorder.findFirst({
      where: {
        irId,
        irIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwNotFound(irId);
    }

    const data: Prisma.ItemReorderUncheckedUpdateInput = {
      irItemId: saveItemReorderDto.ir_item_id,
      irUnitId: saveItemReorderDto.ir_unit_id,
      irModifiedOn: new Date(),
      irModifiedBy: this.resolveActor(saveItemReorderDto.ir_modified_by),
    };
    this.applyOptionalFields(data, saveItemReorderDto);

    const updated = await tx.itemReorder.update({
      where: {
        irId,
      },
      data,
    });

    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_REORDER_TABLE_NAME,
        screenName: ITEM_REORDER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: irId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: payload.ir_modified_by ?? DEFAULT_ACTOR,
        notes: 'Item reorder updated',
      },
      tx,
    );

    return payload;
  }

  private buildListWhere(queryDto: ListItemReorderQueryDto): Prisma.ItemReorderWhereInput {
    const where: Prisma.ItemReorderWhereInput = {
      irIsDeleted: false,
    };

    if (queryDto.ir_branch_id !== undefined) {
      where.irBranchId = queryDto.ir_branch_id;
    }

    if (queryDto.ir_item_id !== undefined) {
      where.irItemId = queryDto.ir_item_id;
    }

    if (queryDto.ir_unit_id !== undefined) {
      where.irUnitId = queryDto.ir_unit_id;
    }

    if (queryDto.ir_godown_id !== undefined) {
      where.irGodownId = queryDto.ir_godown_id;
    }

    if (queryDto.ir_reorder_type !== undefined) {
      where.irReorderType = queryDto.ir_reorder_type;
    }

    if (queryDto.ir_is_active !== undefined) {
      where.irIsActive = queryDto.ir_is_active;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { irReorderType: { contains: search, mode: 'insensitive' } },
        { irRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private applyOptionalFields(
    data: Prisma.ItemReorderUncheckedCreateInput | Prisma.ItemReorderUncheckedUpdateInput,
    saveItemReorderDto: SaveItemReorderDto,
  ): void {
    if (this.hasOwnProperty(saveItemReorderDto, 'ir_branch_id')) {
      data.irBranchId = saveItemReorderDto.ir_branch_id;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_godown_id')) {
      data.irGodownId = saveItemReorderDto.ir_godown_id;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_min_level')) {
      data.irMinLevel = saveItemReorderDto.ir_min_level;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_max_level')) {
      data.irMaxLevel = saveItemReorderDto.ir_max_level;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_reorder_level')) {
      data.irReorderLevel = saveItemReorderDto.ir_reorder_level;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_reorder_qty')) {
      data.irReorderQty = saveItemReorderDto.ir_reorder_qty;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_lead_time_days')) {
      data.irLeadTimeDays = saveItemReorderDto.ir_lead_time_days;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_review_cycle_days')) {
      data.irReviewCycleDays = saveItemReorderDto.ir_review_cycle_days;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_reorder_days')) {
      data.irReorderDays = saveItemReorderDto.ir_reorder_days;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_expiry_buffer_days')) {
      data.irExpiryBufferDays = saveItemReorderDto.ir_expiry_buffer_days;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_reorder_type')) {
      data.irReorderType = saveItemReorderDto.ir_reorder_type;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_is_active')) {
      data.irIsActive = saveItemReorderDto.ir_is_active;
    }

    if (this.hasOwnProperty(saveItemReorderDto, 'ir_remarks')) {
      data.irRemarks = saveItemReorderDto.ir_remarks;
    }
  }

  private validateReorderRange(saveItemReorderDto: SaveItemReorderDto): void {
    const minLevel = saveItemReorderDto.ir_min_level;
    const maxLevel = saveItemReorderDto.ir_max_level;
    if (minLevel !== undefined && maxLevel !== undefined && minLevel > maxLevel) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'ir_max_level',
          message: 'ir_max_level must be greater than or equal to ir_min_level',
        },
      ]);
    }
  }

  private toPayload(record: ItemReorder): ItemReorderPayload {
    return {
      ir_id: record.irId,
      ir_branch_id: record.irBranchId,
      ir_item_id: record.irItemId,
      ir_unit_id: record.irUnitId,
      ir_godown_id: record.irGodownId,
      ir_min_level: this.toNumber(record.irMinLevel),
      ir_max_level: this.toNumber(record.irMaxLevel),
      ir_reorder_level: this.toNumber(record.irReorderLevel),
      ir_reorder_qty: this.toNumber(record.irReorderQty),
      ir_lead_time_days: record.irLeadTimeDays,
      ir_review_cycle_days: record.irReviewCycleDays,
      ir_reorder_days: record.irReorderDays,
      ir_expiry_buffer_days: record.irExpiryBufferDays,
      ir_reorder_type: record.irReorderType,
      ir_is_active: record.irIsActive,
      ir_is_deleted: record.irIsDeleted,
      ir_remarks: record.irRemarks,
      ir_created_on: record.irCreatedOn.toISOString(),
      ir_created_by: record.irCreatedBy,
      ir_modified_on: record.irModifiedOn.toISOString(),
      ir_modified_by: record.irModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private buildDisplayName(record: ItemReorder): string {
    const godownSegment = record.irGodownId ?? 'GLOBAL';
    return `${record.irItemId}:${record.irUnitId}:${godownSegment}`;
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item reorder already exists', [
          {
            field: 'ir_item_id',
            message: 'Duplicate item + unit + godown combination is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'ir_item_id',
            message: 'Referenced item/unit does not exist',
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

  private throwNotFound(irId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item reorder not found', [
        {
          field: 'ir_id',
          message: `No active item reorder found with id ${irId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemReorderErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemReorderErrorDetail[] = [],
  ): ItemReorderErrorResponse {
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
