import { Injectable } from '@nestjs/common';
import { ItemQtyPrice, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { GetItemQtyPriceQueryDto } from './dto/get-item-qty-price-query.dto';
import { SaveItemQtyPriceDto } from './dto/save-item-qty-price.dto';
import {
  ItemQtyPriceDeleteResult,
  ItemQtyPriceErrorDetail,
  ItemQtyPriceListItem,
  ItemQtyPriceListMeta,
  ItemQtyPricePayload,
} from './types/item-qty-price-api.types';
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
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const ITEM_QTY_PRICE_TABLE_NAME = 'item qty price';
const ITEM_QTY_PRICE_AUDIT_SCREEN_NAME = 'Item Qty Price Master';

// Joins that resolve the foreign-key ids to their display names for the GET
// responses. iqp_item_unit_id holds an iuc_id, so the unit name is reached
// through item_unit_conversion -> unit.
const ITEM_QTY_PRICE_INCLUDE = {
  item: { select: { itemNameEn: true } },
  itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
  company: { select: { compName: true } },
  branch: { select: { brName: true } },
  priceLevel: { select: { iplName: true } },
  party: { select: { cusName: true } },
} satisfies Prisma.ItemQtyPriceInclude;

// toPayload also runs on plain rows (create/update/delete audit trail) where the
// joins above are absent, so every relation is optional here.
type ItemQtyPriceWithNames = ItemQtyPrice & {
  item?: { itemNameEn: string } | null;
  itemUnitConversion?: { unit: { unit_name: string } | null } | null;
  company?: { compName: string } | null;
  branch?: { brName: string } | null;
  priceLevel?: { iplName: string } | null;
  party?: { cusName: string | null } | null;
};

@Injectable()
export class ItemsQtyPriceMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPricePayload>;
  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPricePayload[]>;
  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto | SaveItemQtyPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPricePayload | ItemQtyPricePayload[]>;
  /**
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own.
   */
  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto | SaveItemQtyPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPricePayload | ItemQtyPricePayload[]> {
    const saveItems = Array.isArray(saveItemQtyPriceDto)
      ? saveItemQtyPriceDto
      : [saveItemQtyPriceDto];
    const saveAll = async (client: Prisma.TransactionClient) => {
      const savedItems: ItemQtyPricePayload[] = [];
      for (const saveItem of saveItems) {
        savedItems.push(await this.saveItemQtyPrice(client, saveItem));
      }
      return savedItems;
    };
    try {
      const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
      return Array.isArray(saveItemQtyPriceDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  async list(
    queryDto: GetItemQtyPriceQueryDto,
  ): Promise<ConfiguredGridListResult<ItemQtyPriceListItem, ItemQtyPriceListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.ItemQtyPriceWhereInput = {
      iqpIsDeleted: false,
      ...(queryDto.iqp_item_id !== undefined && { iqpItemId: queryDto.iqp_item_id }),
      ...(queryDto.iqp_item_unit_id !== undefined && { iqpItemUnitId: queryDto.iqp_item_unit_id }),
      ...(queryDto.iqp_company_id !== undefined && { iqpCompanyId: queryDto.iqp_company_id }),
      ...(queryDto.iqp_branch_id !== undefined && { iqpBranchId: queryDto.iqp_branch_id }),
      ...(queryDto.iqp_party_id !== undefined && { iqpPartyId: queryDto.iqp_party_id }),
      ...(queryDto.iqp_price_level !== undefined && { iqpPriceLevel: queryDto.iqp_price_level }),
      ...(queryDto.iqp_is_active !== undefined && { iqpIsActive: queryDto.iqp_is_active }),
    };
    return runInventoryListQuery<ItemQtyPriceWithNames, ItemQtyPriceListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<ItemQtyPriceListItem>(this.configuredGridSqlService, {
            tableName: ITEM_QTY_PRICE_TABLE_NAME,
            alias: 'item_qty_price_grid',
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.itemQtyPrice.count({ where }),
        findManyFn: () =>
          this.prisma.itemQtyPrice.findMany({
            where,
            include: ITEM_QTY_PRICE_INCLUDE,
            // Group a slab ladder by item + unit, then order low → high by lower
            // bound; iqp_id keeps ties stable.
            orderBy: [
              { iqpItemId: 'asc' },
              { iqpItemUnitId: 'asc' },
              { iqpFromQty: 'asc' },
              { iqpId: 'asc' },
            ],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(iqpId: string): Promise<ItemQtyPricePayload> {
    const record = await this.prisma.itemQtyPrice.findFirst({
      where: { iqpId, iqpIsDeleted: false },
      include: ITEM_QTY_PRICE_INCLUDE,
    });
    if (!record) {
      this.throwNotFound(iqpId);
    }
    return this.toPayload(record);
  }

  async toggleDelete(
    iqpId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult>;
  async toggleDelete(
    iqpId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult[]>;
  async toggleDelete(
    iqpId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]>;
  async toggleDelete(
    iqpId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]> {
    const toggleIds = Array.isArray(iqpId) ? iqpId : [iqpId];
    const toggleAll = async (client: Prisma.TransactionClient) => {
      const toggledItems: ItemQtyPriceDeleteResult[] = [];
      for (const toggleId of toggleIds) {
        toggledItems.push(await this.toggleDeleteItemQtyPrice(client, toggleId));
      }
      return toggledItems;
    };

    const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);

    return Array.isArray(iqpId) ? results : results[0];
  }

  private async saveItemQtyPrice(
    tx: Prisma.TransactionClient,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): Promise<ItemQtyPricePayload> {
    if (saveItemQtyPriceDto.iqp_id) {
      return this.updateItemQtyPrice(tx, saveItemQtyPriceDto);
    }
    return this.createItemQtyPrice(tx, saveItemQtyPriceDto);
  }

  private async toggleDeleteItemQtyPrice(
    tx: Prisma.TransactionClient,
    iqpId: string,
  ): Promise<ItemQtyPriceDeleteResult> {
    // Find regardless of current deleted state so a delete can be undone.
    const existing = await tx.itemQtyPrice.findFirst({
      where: { iqpId },
      include: ITEM_QTY_PRICE_INCLUDE,
    });
    if (!existing) {
      this.throwNotFound(iqpId);
    }

    const wasDeleted = existing.iqpIsDeleted;
    const nextDeleted = !wasDeleted;
    const modifiedOn = new Date();
    const modifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    // Guarded update: only flips if state hasn't changed since the read.
    const result = await tx.itemQtyPrice.updateMany({
      where: { iqpId, iqpIsDeleted: wasDeleted },
      data: { iqpIsDeleted: nextDeleted, iqpModifiedOn: modifiedOn, iqpModifiedBy: modifiedBy },
    });
    if (result.count === 0) {
      this.throwNotFound(iqpId);
    }

    const originalRecord = this.toPayload(existing);
    const modifiedRecord = this.toPayload({
      ...existing,
      iqpIsDeleted: nextDeleted,
      iqpModifiedOn: modifiedOn,
      iqpModifiedBy: modifiedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: nextDeleted ? 'cancel' : 'update',
        tableName: ITEM_QTY_PRICE_TABLE_NAME,
        screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iqpId,
        displayName: this.buildDisplayName(existing),
        originalRecord,
        modifiedRecord,
        userId: modifiedBy,
        notes: nextDeleted ? 'Item qty price soft deleted' : 'Item qty price restored',
      },
      tx,
    );

    return { iqp_id: iqpId, deleted: nextDeleted };
  }

  private async createItemQtyPrice(
    tx: Prisma.TransactionClient,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): Promise<ItemQtyPricePayload> {
    const effectiveFrom = this.parseRequiredDate(
      saveItemQtyPriceDto.iqp_effective_from,
      'iqp_effective_from',
    );
    const effectiveTo =
      this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null;
    this.validateDateRange(effectiveFrom, effectiveTo);
    this.validateQtyRange(
      saveItemQtyPriceDto.iqp_from_qty ?? 0,
      saveItemQtyPriceDto.iqp_to_qty ?? null,
    );

    const now = new Date();
    const createdBy = resolveActor(
      saveItemQtyPriceDto.iqp_created_by,
      this.requestContextService.getUserId(),
    );   
    const data: Prisma.ItemQtyPriceUncheckedCreateInput = {
      iqpItemId: saveItemQtyPriceDto.iqp_item_id,
      iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
      iqpEffectiveFrom: effectiveFrom,
      iqpCreatedOn: now,
      iqpCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveItemQtyPriceDto);
    const created = await tx.itemQtyPrice.create({ data, include: ITEM_QTY_PRICE_INCLUDE });
    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_QTY_PRICE_TABLE_NAME,
        screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.iqp_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: createdBy,
        notes: 'Item qty price created',
      },
      tx,
    );
    return payload;
  }
  private async updateItemQtyPrice(
    tx: Prisma.TransactionClient,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): Promise<ItemQtyPricePayload> {
    const iqpId = saveItemQtyPriceDto.iqp_id!;
    const existing = await tx.itemQtyPrice.findFirst({
      where: { iqpId, iqpIsDeleted: false },
      include: ITEM_QTY_PRICE_INCLUDE,
    });
    if (!existing) {
      this.throwNotFound(iqpId);
    }
    const nextEffectiveFrom = this.parseRequiredDate(
      saveItemQtyPriceDto.iqp_effective_from,
      'iqp_effective_from',
    );
    const nextEffectiveTo = hasOwnProperty(saveItemQtyPriceDto, 'iqp_effective_to')
      ? (this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null)
      : existing.iqpEffectiveTo;
    this.validateDateRange(nextEffectiveFrom, nextEffectiveTo);
    const nextFromQty = hasOwnProperty(saveItemQtyPriceDto, 'iqp_from_qty')
      ? (saveItemQtyPriceDto.iqp_from_qty ?? 0)
      : toNumber(existing.iqpFromQty);
    const nextToQty = hasOwnProperty(saveItemQtyPriceDto, 'iqp_to_qty')
      ? (saveItemQtyPriceDto.iqp_to_qty ?? null)
      : toNullableNumber(existing.iqpToQty);
    this.validateQtyRange(nextFromQty, nextToQty);
    const data: Prisma.ItemQtyPriceUncheckedUpdateInput = {
      iqpItemId: saveItemQtyPriceDto.iqp_item_id,
      iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
      iqpEffectiveFrom: nextEffectiveFrom,
      iqpModifiedOn: new Date(),
      iqpModifiedBy: resolveActor(
        saveItemQtyPriceDto.iqp_modified_by,
        this.requestContextService.getUserId(),
      ),
    };
    this.applyOptionalFields(data, saveItemQtyPriceDto);
    const updated = await tx.itemQtyPrice.update({
      where: { iqpId },
      data,
      include: ITEM_QTY_PRICE_INCLUDE,
    });
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_QTY_PRICE_TABLE_NAME,
        screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iqpId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: payload.iqp_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        notes: 'Item qty price updated',
      },
      tx,
    );
    return payload;
  }
  private applyOptionalFields(
    data: Prisma.ItemQtyPriceUncheckedCreateInput | Prisma.ItemQtyPriceUncheckedUpdateInput,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): void {
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_company_id'))
      data.iqpCompanyId = saveItemQtyPriceDto.iqp_company_id;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_branch_id'))
      data.iqpBranchId = saveItemQtyPriceDto.iqp_branch_id;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_party_id'))
      data.iqpPartyId = saveItemQtyPriceDto.iqp_party_id;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_price_level'))
      data.iqpPriceLevel = saveItemQtyPriceDto.iqp_price_level;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_from_qty'))
      data.iqpFromQty = saveItemQtyPriceDto.iqp_from_qty;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_to_qty'))
      data.iqpToQty = saveItemQtyPriceDto.iqp_to_qty;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_price_mode'))
      data.iqpPriceMode = saveItemQtyPriceDto.iqp_price_mode;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_disc_pct'))
      data.iqpDiscPct = saveItemQtyPriceDto.iqp_disc_pct;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_flat_off'))
      data.iqpFlatOff = saveItemQtyPriceDto.iqp_flat_off;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_price'))
      data.iqpPrice = saveItemQtyPriceDto.iqp_price;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_is_tax_incl'))
      data.iqpIsTaxIncl = saveItemQtyPriceDto.iqp_is_tax_incl;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_effective_to'))
      data.iqpEffectiveTo = this.parseOptionalDate(
        saveItemQtyPriceDto.iqp_effective_to,
        'iqp_effective_to',
      );
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_is_active'))
      data.iqpIsActive = saveItemQtyPriceDto.iqp_is_active;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_sync_date'))
      data.iqpSyncDate = this.parseOptionalDate(saveItemQtyPriceDto.iqp_sync_date, 'iqp_sync_date');
  }
  private validateDateRange(effectiveFrom: Date, effectiveTo: Date | null): void {
    if (!effectiveTo) {
      return;
    }
    if (effectiveFrom.getTime() > effectiveTo.getTime()) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: 'iqp_effective_to',
          message: 'iqp_effective_to must be greater than or equal to iqp_effective_from',
        },
      ]);
    }
  }
  private validateQtyRange(fromQty: number, toQty: number | null): void {
    if (toQty === null) {
      return;
    }
    // iqp_to_qty is an exclusive upper bound, so it must sit strictly above the
    // inclusive lower bound.
    if (fromQty >= toQty) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: 'iqp_to_qty',
          message: 'iqp_to_qty must be greater than iqp_from_qty',
        },
      ]);
    }
  }
  private parseRequiredDate(value: string, fieldName: string): Date {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        { field: fieldName, message: `${fieldName} must be a valid date` },
      ]);
    }
    return parsedDate;
  }
  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        { field: fieldName, message: `${fieldName} must be a valid date` },
      ]);
    }
    return parsedDate;
  }
  private toPayload(record: ItemQtyPriceWithNames): ItemQtyPricePayload {
    return {
      iqp_id: record.iqpId,
      iqp_company_id: record.iqpCompanyId,
      iqp_branch_id: record.iqpBranchId,
      iqp_party_id: record.iqpPartyId,
      iqp_price_level: record.iqpPriceLevel,
      iqp_item_id: record.iqpItemId,
      iqp_item_unit_id: record.iqpItemUnitId,
      iqp_from_qty: toNumber(record.iqpFromQty),
      iqp_to_qty: toNullableNumber(record.iqpToQty),
      iqp_price_mode: record.iqpPriceMode,
      iqp_disc_pct: toNullableNumber(record.iqpDiscPct),
      iqp_flat_off: toNullableNumber(record.iqpFlatOff),
      iqp_price: toNullableNumber(record.iqpPrice),
      iqp_is_tax_incl: record.iqpIsTaxIncl,
      iqp_effective_from: record.iqpEffectiveFrom?.toISOString(),
      iqp_effective_to: record.iqpEffectiveTo ? record.iqpEffectiveTo.toISOString() : null,
      iqp_is_active: record.iqpIsActive,
      iqp_is_deleted: record.iqpIsDeleted,
      iqp_sync_date: record.iqpSyncDate ? record.iqpSyncDate.toISOString() : null,
      iqp_created_on: record.iqpCreatedOn.toISOString(),
      iqp_created_by: record.iqpCreatedBy,
      iqp_modified_on: record.iqpModifiedOn.toISOString(),
      iqp_modified_by: record.iqpModifiedBy,
      // Resolved foreign-key display names (only populated on the GET/save paths
      // that join the relations; null on plain audit-trail rows).
      iqp_item_name: record.item?.itemNameEn ?? null,
      iqp_unit_name: record.itemUnitConversion?.unit?.unit_name ?? null,
      iqp_company_name: record.company?.compName ?? null,
      iqp_branch_name: record.branch?.brName ?? null,
      iqp_price_level_name: record.priceLevel?.iplName ?? null,
      iqp_party_name: record.party?.cusName ?? null,
    };
  }
  private buildDisplayName(record: ItemQtyPrice): string {
    const levelSegment = record.iqpPriceLevel ?? 'ALL';
    const upperSegment = record.iqpToQty !== null ? toNumber(record.iqpToQty) : 'ABOVE';
    return `${record.iqpItemId}:${record.iqpItemUnitId}:L${levelSegment}:[${toNumber(record.iqpFromQty)}-${upperSegment})`;
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemQtyPriceErrorDetail>(error, 'Item qty price already exists', [
      { field: 'iqp_item_id', message: 'Duplicate qty price slab is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Invalid relation reference', [
        {
          field: 'iqp_item_id',
          message: 'Referenced item, unit, company, branch, or party does not exist',
        },
      ]);
    }
  }
  private throwNotFound(iqpId: string): never {
    throwInventoryNotFound<ItemQtyPriceErrorDetail>(
      'Item qty price not found',
      'iqp_id',
      `No item qty price found with id ${iqpId}`,
    );
  }
}