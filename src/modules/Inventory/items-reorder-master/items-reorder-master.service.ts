import { Injectable } from '@nestjs/common';
import { ItemReorder, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { GetItemReorderQueryDto } from './dto/get-item-reorder-query.dto';
import { SaveItemReorderDto } from './dto/save-item-reorder.dto';
import {
  ItemReorderDeleteResult,
  ItemReorderErrorDetail,
  ItemReorderListItem,
  ItemReorderListMeta,
  ItemReorderPayload,
} from './types/item-reorder-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from 'src/common/utils/module-service.utils';
import type { InventoryWriteClient } from 'src/common/utils/module-service.utils';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const ITEM_REORDER_TABLE_NAME = 'item reorders';
const ITEM_REORDER_AUDIT_SCREEN_NAME = 'Item Reorder Master';

@Injectable()
export class ItemsReorderMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(
    saveItemReorderDto: SaveItemReorderDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemReorderPayload>;
  async save(
    saveItemReorderDto: SaveItemReorderDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemReorderPayload[]>;
  async save(
    saveItemReorderDto: SaveItemReorderDto | SaveItemReorderDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemReorderPayload | ItemReorderPayload[]>;
  /**
   * A non-null `ir_unit_id` must hold an `iuc_id` from item_unit_conversion, not
   * a raw unit_id — the column is a FK to item_unit_conversion(iuc_id). NULL
   * still means "the global rule" (no unit scoping).
   *
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own (see ItemsMasterService.saveComposite).
   */
  async save(
    saveItemReorderDto: SaveItemReorderDto | SaveItemReorderDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemReorderPayload | ItemReorderPayload[]> {
    const saveItems = Array.isArray(saveItemReorderDto) ? saveItemReorderDto : [saveItemReorderDto];
    const saveAll = async (client: Prisma.TransactionClient) => {
      const savedItems: ItemReorderPayload[] = [];
      for (const saveItem of saveItems) {
        savedItems.push(await this.saveItemReorder(client, saveItem));
      }
      return savedItems;
    };
    try {
      const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
      return Array.isArray(saveItemReorderDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async list(
    queryDto: GetItemReorderQueryDto,
  ): Promise<ConfiguredGridListResult<ItemReorderListItem, ItemReorderListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.ItemReorderWhereInput = {
      irIsDeleted: false,
      ...(queryDto.ir_item_id !== undefined && { irItemId: queryDto.ir_item_id }),
      ...(queryDto.ir_branch_id !== undefined && { irBranchId: queryDto.ir_branch_id }),
      ...(queryDto.ir_unit_id !== undefined && { irUcUnitId: queryDto.ir_unit_id }),
      ...(queryDto.ir_godown_id !== undefined && { irGodownId: queryDto.ir_godown_id }),
      ...(queryDto.ir_is_active !== undefined && { irIsActive: queryDto.ir_is_active }),
    };
    return runInventoryListQuery<ItemReorder, ItemReorderListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<ItemReorderListItem>(this.configuredGridSqlService, {
            tableName: ITEM_REORDER_TABLE_NAME,
            alias: 'item_reorder_grid',
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.itemReorder.count({ where }),
        findManyFn: () =>
          this.prisma.itemReorder.findMany({
            where,
            // ir_sl_no is the reorder row's own display order; where it ties
            // (both default 0), the row id keeps the result stable.
            orderBy: [{ irItemId: 'asc' }, { irSlNo: 'asc' }, { irId: 'asc' }],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(irId: string): Promise<ItemReorderPayload> {
    const record = await this.prisma.itemReorder.findFirst({
      where: { irId, irIsDeleted: false },
    });
    if (!record) {
      throwInventoryNotFound<ItemReorderErrorDetail>(
        'Item reorder not found',
        'ir_id',
        `No active item reorder found with id ${irId}`,
      );
    }
    return this.toPayload(record);
  }
  async findByItemId(
    itemId: string,
    client: InventoryWriteClient = this.prisma,
  ): Promise<ItemReorderPayload[]> {
    const records = await client.itemReorder.findMany({
      where: { irItemId: itemId, irIsDeleted: false },
      orderBy: [{ irSlNo: 'asc' }, { irId: 'asc' }],
    });
    return records.map((record) => this.toPayload(record));
  }
  async findIdsByItemId(itemId: string, isDeleted: boolean): Promise<string[]> {
    const records = await this.prisma.itemReorder.findMany({
      where: { irItemId: itemId, irIsDeleted: isDeleted },
      select: { irId: true },
    });
    return records.map((record) => record.irId);
  }

  async toggleDelete(irId: string, tx?: Prisma.TransactionClient): Promise<ItemReorderDeleteResult>;
  async toggleDelete(
    irId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemReorderDeleteResult[]>;
  async toggleDelete(
    irId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemReorderDeleteResult | ItemReorderDeleteResult[]>;
  async toggleDelete(
    irId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemReorderDeleteResult | ItemReorderDeleteResult[]> {
    const toggleIds = Array.isArray(irId) ? irId : [irId];
    const toggleAll = async (client: Prisma.TransactionClient) => {
      const toggledItems: ItemReorderDeleteResult[] = [];
      for (const toggleId of toggleIds) {
        toggledItems.push(await this.toggleDeleteItemReorder(client, toggleId));
      }
      return toggledItems;
    };

    const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);

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

  private async toggleDeleteItemReorder(
    tx: Prisma.TransactionClient,
    irId: string,
  ): Promise<ItemReorderDeleteResult> {
    // Find regardless of current deleted state
    const existing = await tx.itemReorder.findFirst({
      where: { irId },
    });
    if (!existing) {
      throwInventoryNotFound<ItemReorderErrorDetail>(
        'Item reorder not found',
        'ir_id',
        `No item reorder found with id ${irId}`,
      );
    }

    const wasDeleted = existing.irIsDeleted;
    const nextDeleted = !wasDeleted;
    const modifiedOn = new Date();
    const modifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    // Guarded update: only flips if state hasn't changed since the read
    const result = await tx.itemReorder.updateMany({
      where: { irId, irIsDeleted: wasDeleted },
      data: { irIsDeleted: nextDeleted, irModifiedOn: modifiedOn, irModifiedBy: modifiedBy },
    });
    if (result.count === 0) {
      throwInventoryNotFound<ItemReorderErrorDetail>(
        'Item reorder not found',
        'ir_id',
        `No item reorder found with id ${irId}`,
      );
    }

    const originalRecord = this.toPayload(existing);
    const modifiedRecord = this.toPayload({
      ...existing,
      irIsDeleted: nextDeleted,
      irModifiedOn: modifiedOn,
      irModifiedBy: modifiedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: nextDeleted ? 'cancel' : 'update',
        tableName: ITEM_REORDER_TABLE_NAME,
        screenName: ITEM_REORDER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: irId,
        displayName: this.buildDisplayName(existing),
        originalRecord,
        modifiedRecord,
        userId: modifiedBy,
        notes: nextDeleted ? 'Item reorder soft deleted' : 'Item reorder restored',
      },
      tx,
    );

    return { ir_id: irId, deleted: nextDeleted };
  }

  private async createItemReorder(
    tx: Prisma.TransactionClient,
    saveItemReorderDto: SaveItemReorderDto,
  ): Promise<ItemReorderPayload> {
    this.validateReorderRange(saveItemReorderDto);

    const now = new Date();
    const createdBy = resolveActor(saveItemReorderDto.ir_created_by, this.requestContextService.getUserId());
    const modifiedBy = resolveActor(saveItemReorderDto.ir_modified_by, createdBy);
    const data: Prisma.ItemReorderUncheckedCreateInput = {
      irItemId: saveItemReorderDto.ir_item_id,
      irUcUnitId: saveItemReorderDto.ir_unit_id ?? null,
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
      where: { irId, irIsDeleted: false },
    });
    if (!existing) {
      throwInventoryNotFound<ItemReorderErrorDetail>(
        'Item reorder not found',
        'ir_id',
        `No active item reorder found with id ${irId}`,
      );
    }

    const data: Prisma.ItemReorderUncheckedUpdateInput = {
      irItemId: saveItemReorderDto.ir_item_id,
      irUcUnitId: saveItemReorderDto.ir_unit_id ?? null,
      irModifiedOn: new Date(),
      irModifiedBy: resolveActor(saveItemReorderDto.ir_modified_by, this.requestContextService.getUserId()),
    };
    this.applyOptionalFields(data, saveItemReorderDto);

    const updated = await tx.itemReorder.update({ where: { irId }, data });

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
        userId: payload.ir_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        notes: 'Item reorder updated',
      },
      tx,
    );

    return payload;
  }
  private applyOptionalFields(
    data: Prisma.ItemReorderUncheckedCreateInput | Prisma.ItemReorderUncheckedUpdateInput,
    saveItemReorderDto: SaveItemReorderDto,
  ): void {
    if (hasOwnProperty(saveItemReorderDto, 'ir_branch_id'))
      data.irBranchId = saveItemReorderDto.ir_branch_id;
    if (hasOwnProperty(saveItemReorderDto, 'ir_godown_id'))
      data.irGodownId = saveItemReorderDto.ir_godown_id;
    if (hasOwnProperty(saveItemReorderDto, 'ir_sl_no'))
      data.irSlNo = saveItemReorderDto.ir_sl_no;
    if (hasOwnProperty(saveItemReorderDto, 'ir_min_level'))
      data.irMinLevel = saveItemReorderDto.ir_min_level;
    if (hasOwnProperty(saveItemReorderDto, 'ir_max_level'))
      data.irMaxLevel = saveItemReorderDto.ir_max_level;
    if (hasOwnProperty(saveItemReorderDto, 'ir_reorder_level'))
      data.irReorderLevel = saveItemReorderDto.ir_reorder_level;
    if (hasOwnProperty(saveItemReorderDto, 'ir_reorder_qty'))
      data.irReorderQty = saveItemReorderDto.ir_reorder_qty;
    if (hasOwnProperty(saveItemReorderDto, 'ir_lead_time_days'))
      data.irLeadTimeDays = saveItemReorderDto.ir_lead_time_days;
    if (hasOwnProperty(saveItemReorderDto, 'ir_review_cycle_days'))
      data.irReviewCycleDays = saveItemReorderDto.ir_review_cycle_days;
    if (hasOwnProperty(saveItemReorderDto, 'ir_reorder_days'))
      data.irReorderDays = saveItemReorderDto.ir_reorder_days;
    if (hasOwnProperty(saveItemReorderDto, 'ir_expiry_buffer_days'))
      data.irExpiryBufferDays = saveItemReorderDto.ir_expiry_buffer_days;
    if (hasOwnProperty(saveItemReorderDto, 'ir_reorder_type'))
      data.irReorderType = saveItemReorderDto.ir_reorder_type;
    if (hasOwnProperty(saveItemReorderDto, 'ir_is_active'))
      data.irIsActive = saveItemReorderDto.ir_is_active;
    if (hasOwnProperty(saveItemReorderDto, 'ir_remarks'))
      data.irRemarks = saveItemReorderDto.ir_remarks;
  }

  private validateReorderRange(saveItemReorderDto: SaveItemReorderDto): void {
    const minLevel = saveItemReorderDto.ir_min_level;
    const maxLevel = saveItemReorderDto.ir_max_level;
    if (minLevel !== undefined && maxLevel !== undefined && minLevel > maxLevel) {
      throwInventoryBadRequest<ItemReorderErrorDetail>('Validation failed', [
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
      ir_unit_id: record.irUcUnitId,
      ir_godown_id: record.irGodownId,
      ir_sl_no: record.irSlNo,
      ir_min_level: toNumber(record.irMinLevel),
      ir_max_level: toNumber(record.irMaxLevel),
      ir_reorder_level: toNumber(record.irReorderLevel),
      ir_reorder_qty: toNumber(record.irReorderQty),
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

  private buildDisplayName(record: ItemReorder): string {
    const unitSegment = record.irUcUnitId ?? 'NO_UNIT';
    const godownSegment = record.irGodownId ?? 'GLOBAL';
    return `${record.irItemId}:${unitSegment}:${godownSegment}`;
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemReorderErrorDetail>(error, 'Item reorder already exists', [
      { field: 'ir_item_id', message: 'Duplicate item + unit + godown combination is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemReorderErrorDetail>('Invalid relation reference', [
        { field: 'ir_item_id', message: 'Referenced item/unit does not exist' },
      ]);
    }
  }
}
