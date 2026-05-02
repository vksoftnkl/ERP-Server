import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemPriceMaster, ItemUnitConversion, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemUnitConversionQueryDto } from './dto/list-item-unit-conversion-query.dto';
import { ListItemPriceQueryDto } from './dto/list-item-price-query.dto';
import { SaveItemUnitConversionDto } from './dto/save-item-unit-conversion.dto';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import {
  ItemPriceDeleteResult,
  ItemPriceErrorDetail,
  ItemPriceErrorResponse,
  ItemPriceListItem,
  ItemPriceListMeta,
  ItemPricePayload,
  ItemUnitConversionDeleteResult,
  ItemUnitConversionListItem,
  ItemUnitConversionListMeta,
  ItemUnitConversionPayload,
} from './types/item-price-api.types';
const DEFAULT_AUDIT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
const ITEM_UNIT_CONVERSION_TABLE_NAME = 'item_unit_conversion';
const ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME = 'Item Unit Conversion Master';
type ItemUnitConversionSnapshot = Pick<
  ItemUnitConversion,
  | 'iucBaseUnitId'
  | 'iucToBaseFactor'
  | 'iucUnitSlno'
  | 'iucUnitFactor'
  | 'iucIsDefaultUnit'
  | 'iucIsBaseUnit'
  | 'iucIsBigUnit'
  | 'iucUomRemarks'
>;
type EffectiveItemUnitConversionRow = {
  saveIndex?: number;
  iucId?: string;
  unitId: string;
  baseUnitId: string;
  unitSlno: number;
  toBaseFactor?: number;
  unitFactor?: number;
  isBaseUnit: boolean;
};
@Injectable()
export class ItemsPriceMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveItemPriceDto: SaveItemPriceDto): Promise<ItemPricePayload>;
  async save(saveItemPriceDto: SaveItemPriceDto[]): Promise<ItemPricePayload[]>;
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
  ): Promise<ItemPricePayload | ItemPricePayload[]>;
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
  ): Promise<ItemPricePayload | ItemPricePayload[]> {
    const saveItems = Array.isArray(saveItemPriceDto) ? saveItemPriceDto : [saveItemPriceDto];
    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const savedItems: ItemPricePayload[] = [];
        for (const saveItem of saveItems) {
          savedItems.push(await this.saveItemPrice(tx, saveItem));
        }
        return savedItems;
      });
      return Array.isArray(saveItemPriceDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async saveItemUnitConversions(
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): Promise<ItemUnitConversionPayload>;
  async saveItemUnitConversions(
    saveItemUnitConversionDto: SaveItemUnitConversionDto[],
  ): Promise<ItemUnitConversionPayload[]>;
  async saveItemUnitConversions(
    saveItemUnitConversionDto: SaveItemUnitConversionDto | SaveItemUnitConversionDto[],
  ): Promise<ItemUnitConversionPayload | ItemUnitConversionPayload[]>;
  async saveItemUnitConversions(
    saveItemUnitConversionDto: SaveItemUnitConversionDto | SaveItemUnitConversionDto[],
  ): Promise<ItemUnitConversionPayload | ItemUnitConversionPayload[]> {
    const saveItems = Array.isArray(saveItemUnitConversionDto)
      ? saveItemUnitConversionDto
      : [saveItemUnitConversionDto];
    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const baseUnitNormalizedSaveItems = await this.normalizeItemUnitConversionBaseUnits(
          tx,
          saveItems,
        );
        for (const saveItem of baseUnitNormalizedSaveItems) {
          this.validateItemUnitConversion(saveItem);
        }
        const normalizedSaveItems = await this.normalizeItemUnitConversionFactors(
          tx,
          baseUnitNormalizedSaveItems,
        );
        const savedItems: ItemUnitConversionPayload[] = [];
        for (const saveItem of normalizedSaveItems) {
          savedItems.push(await this.saveItemUnitConversion(tx, saveItem));
        }
        return savedItems;
      });
      return Array.isArray(saveItemUnitConversionDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleItemUnitConversionWriteError(error);
      throw error;
    }
  }
  async list(
    queryDto: ListItemPriceQueryDto,
  ): Promise<ConfiguredGridListResult<ItemPriceListItem, ItemPriceListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.ipm_company_id !== undefined ||
      queryDto.ipm_branch_id !== undefined ||
      queryDto.ipm_item_id !== undefined ||
      queryDto.ipm_unit_id !== undefined ||
      queryDto.ipm_godown_id !== undefined ||
      queryDto.ipm_base_unit_id !== undefined ||
      queryDto.ipm_profit_type !== undefined ||
      queryDto.ipm_is_active !== undefined ||
      queryDto.ipm_is_deleted !== undefined;
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.itemPriceMaster.count({ where }),
      this.prisma.itemPriceMaster.findMany({
        where,
        orderBy: [{ ipmItemId: 'asc' }, { ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
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
  async listItemUnitConversions(
    queryDto: ListItemUnitConversionQueryDto,
  ): Promise<ConfiguredGridListResult<ItemUnitConversionListItem, ItemUnitConversionListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.iuc_company_id !== undefined ||
      queryDto.iuc_item_id !== undefined ||
      queryDto.iuc_unit_id !== undefined ||
      queryDto.iuc_base_unit_id !== undefined ||
      queryDto.iuc_is_default_unit !== undefined ||
      queryDto.iuc_is_base_unit !== undefined ||
      queryDto.iuc_is_big_unit !== undefined ||
      queryDto.iuc_is_active !== undefined ||
      queryDto.iuc_is_deleted !== undefined;
    if (!hasStructuredFilters) {
      const configuredList = await this.listItemUnitConversionsFromConfiguredGridSql(
        queryDto.search,
        page,
        limit,
        skip,
      );
      if (configuredList) {
        return configuredList;
      }
    }
    const where = this.buildItemUnitConversionListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.itemUnitConversion.count({ where }),
      this.prisma.itemUnitConversion.findMany({
        where,
        orderBy: [{ iucItemId: 'asc' }, { iucUnitSlno: 'asc' }, { iucId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);
    return {
      items: records.map((record) => this.toItemUnitConversionPayload(record)),
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
  ): Promise<ConfiguredGridListResult<ItemPriceListItem, ItemPriceListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_PRICE_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_PRICE_TABLE_NAME,
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
        tableName: ITEM_PRICE_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemPriceListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_price_grid',
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
  private async listItemUnitConversionsFromConfiguredGridSql(
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<
    ConfiguredGridListResult<ItemUnitConversionListItem, ItemUnitConversionListMeta> | null
  > {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_UNIT_CONVERSION_TABLE_NAME,
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
        tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result =
          await this.configuredGridSqlService.runPagedQuery<ItemUnitConversionListItem>({
            baseSql: validation.normalizedSql,
            alias: 'item_unit_conversion_grid',
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
  async getById(ipmId: string): Promise<ItemPricePayload> {
    const record = await this.prisma.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(ipmId);
    }
    return this.toPayload(record);
  }
  async getItemUnitConversionById(iucId: string): Promise<ItemUnitConversionPayload> {
    const record = await this.prisma.itemUnitConversion.findFirst({
      where: {
        iucId,
        iucIsDeleted: false,
      },
    });
    if (!record) {
      this.throwItemUnitConversionNotFound(iucId);
    }
    return this.toItemUnitConversionPayload(record);
  }
  async delete(ipmId: string): Promise<ItemPriceDeleteResult>;
  async delete(ipmId: string[]): Promise<ItemPriceDeleteResult[]>;
  async delete(ipmId: string | string[]): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]>;
  async delete(ipmId: string | string[]): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]> {
    const deleteIds = Array.isArray(ipmId) ? ipmId : [ipmId];
    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const deletedItems: ItemPriceDeleteResult[] = [];
        for (const deleteId of deleteIds) {
          deletedItems.push(await this.deleteItemPrice(tx, deleteId));
        }
        return deletedItems;
      });
      return Array.isArray(ipmId) ? results : results[0];
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }
  async deleteItemUnitConversions(iucId: string): Promise<ItemUnitConversionDeleteResult>;
  async deleteItemUnitConversions(iucId: string[]): Promise<ItemUnitConversionDeleteResult[]>;
  async deleteItemUnitConversions(
    iucId: string | string[],
  ): Promise<ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]>;
  async deleteItemUnitConversions(
    iucId: string | string[],
  ): Promise<ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]> {
    const deleteIds = Array.isArray(iucId) ? iucId : [iucId];
    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const deletedItems: ItemUnitConversionDeleteResult[] = [];
        for (const deleteId of deleteIds) {
          deletedItems.push(await this.deleteItemUnitConversion(tx, deleteId));
        }
        return deletedItems;
      });
      return Array.isArray(iucId) ? results : results[0];
    } catch (error: unknown) {
      this.handleItemUnitConversionDeleteError(error);
      throw error;
    }
  }
  private async saveItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    if (saveItemPriceDto.ipm_id) {
      return this.updateItemPrice(tx, saveItemPriceDto);
    }
    return this.createItemPrice(tx, saveItemPriceDto);
  }
  private async deleteItemPrice(
    tx: Prisma.TransactionClient,
    ipmId: string,
  ): Promise<ItemPriceDeleteResult> {
    const existing = await tx.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwNotFound(ipmId);
    }
    const deletedOn = new Date();
    const updated = await tx.itemPriceMaster.update({
      where: {
        ipmId,
      },
      data: {
        ipmIsDeleted: true,
        ipmUpdatedOn: deletedOn,
      },
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmId,
        displayName: this.buildDisplayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(updated),
        userId: this.resolveAuditActor(updated.ipmUpdatedBy),
        notes: 'Item price soft deleted',
      },
      tx,
    );
    return {
      ipm_id: ipmId,
      deleted: true,
    };
  }
  private async saveItemUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): Promise<ItemUnitConversionPayload> {
    if (saveItemUnitConversionDto.iuc_id) {
      return this.updateItemUnitConversion(tx, saveItemUnitConversionDto);
    }
    return this.createItemUnitConversion(tx, saveItemUnitConversionDto);
  }
  private async createItemUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): Promise<ItemUnitConversionPayload> {
    this.validateItemUnitConversion(saveItemUnitConversionDto);
    const now = new Date();
    const createdBy = this.resolveRecordActor(saveItemUnitConversionDto.iuc_created_by);
    const updatedBy =
      this.resolveRecordActor(saveItemUnitConversionDto.iuc_updated_by) ?? createdBy;
    const baseUnitId =
      saveItemUnitConversionDto.iuc_base_unit_id ?? saveItemUnitConversionDto.iuc_unit_id;
    const data: Prisma.ItemUnitConversionUncheckedCreateInput = {
      iucCompanyId: saveItemUnitConversionDto.iuc_company_id,
      iucItemId: saveItemUnitConversionDto.iuc_item_id,
      iucUnitId: saveItemUnitConversionDto.iuc_unit_id,
      iucBaseUnitId: baseUnitId,
      iucCreatedOn: now,
      iucCreatedBy: createdBy,
      iucUpdatedOn: now,
      iucUpdatedBy: updatedBy,
    };
    this.applyItemUnitConversionOptionalFields(data, saveItemUnitConversionDto);
    const created = await tx.itemUnitConversion.create({ data });
    const payload = this.toItemUnitConversionPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
        screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.iuc_id,
        displayName: this.buildItemUnitConversionDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: this.resolveAuditActor(createdBy),
        notes: 'Item unit conversion created',
      },
      tx,
    );
    return payload;
  }
  private async updateItemUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): Promise<ItemUnitConversionPayload> {
    this.validateItemUnitConversion(saveItemUnitConversionDto);

    const iucId = saveItemUnitConversionDto.iuc_id!;
    const existing = await tx.itemUnitConversion.findFirst({
      where: {
        iucId,
        iucIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwItemUnitConversionNotFound(iucId);
    }
    const baseUnitId =
      saveItemUnitConversionDto.iuc_base_unit_id ?? existing.iucBaseUnitId;
    const data: Prisma.ItemUnitConversionUncheckedUpdateInput = {
      iucCompanyId: saveItemUnitConversionDto.iuc_company_id,
      iucItemId: saveItemUnitConversionDto.iuc_item_id,
      iucUnitId: saveItemUnitConversionDto.iuc_unit_id,
      iucBaseUnitId: baseUnitId,
      iucUpdatedOn: new Date(),
    };
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_updated_by')) {
      data.iucUpdatedBy = this.resolveRecordActor(saveItemUnitConversionDto.iuc_updated_by);
    }
    this.applyItemUnitConversionOptionalFields(data, saveItemUnitConversionDto);
    const updated = await tx.itemUnitConversion.update({
      where: {
        iucId,
      },
      data,
    });
    const payload = this.toItemUnitConversionPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
        screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iucId,
        displayName: this.buildItemUnitConversionDisplayName(updated),
        originalRecord: this.toItemUnitConversionPayload(existing),
        modifiedRecord: payload,
        userId: this.resolveAuditActor(payload.iuc_updated_by),
        notes: 'Item unit conversion updated',
      },
      tx,
    );

    return payload;
  }
  private async deleteItemUnitConversion(
    tx: Prisma.TransactionClient,
    iucId: string,
  ): Promise<ItemUnitConversionDeleteResult> {
    const existing = await tx.itemUnitConversion.findFirst({
      where: {
        iucId,
        iucIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwItemUnitConversionNotFound(iucId);
    }
    const deletedOn = new Date();
    const updated = await tx.itemUnitConversion.update({
      where: {
        iucId,
      },
      data: {
        iucIsDeleted: true,
        iucUpdatedOn: deletedOn,
      },
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
        screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iucId,
        displayName: this.buildItemUnitConversionDisplayName(existing),
        originalRecord: this.toItemUnitConversionPayload(existing),
        modifiedRecord: this.toItemUnitConversionPayload(updated),
        userId: this.resolveAuditActor(updated.iucUpdatedBy),
        notes: 'Item unit conversion soft deleted',
      },
      tx,
    );
    return {
      iuc_id: iucId,
      deleted: true,
    };
  }
  private async createItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'ipm_profit_type',
          message: 'ipm_profit_type is required',
        },
      ]);
    }
    const unitConversion = await this.syncUnitConversionFromItemPriceInput(tx, saveItemPriceDto);
    const now = new Date();
    const createdBy = this.resolveRecordActor(saveItemPriceDto.ipm_created_by);
    const updatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by) ?? createdBy;
    const data: Prisma.ItemPriceMasterUncheckedCreateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUnitId: saveItemPriceDto.ipm_unit_id,
      ipmGodownId: saveItemPriceDto.ipm_godown_id,
      ipmProfitType: profitType,
      ipmCreatedOn: now,
      ipmCreatedBy: createdBy,
      ipmUpdatedOn: now,
      ipmUpdatedBy: updatedBy,
    };
    this.applyOptionalFields(data, saveItemPriceDto);
    this.applyUnitConversionFields(data, unitConversion, saveItemPriceDto);
    const created = await tx.itemPriceMaster.create({ data });
    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ipm_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: this.resolveAuditActor(createdBy),
        notes: 'Item price created',
      },
      tx,
    );
    return payload;
  }
  private async updateItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    const ipmId = saveItemPriceDto.ipm_id!;
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'ipm_profit_type',
          message: 'ipm_profit_type cannot be empty',
        },
      ]);
    }
    const existing = await tx.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });
    if (!existing) {
      this.throwNotFound(ipmId);
    }
    const unitConversion = await this.syncUnitConversionFromItemPriceInput(tx, saveItemPriceDto);
    const data: Prisma.ItemPriceMasterUncheckedUpdateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUnitId: saveItemPriceDto.ipm_unit_id,
      ipmGodownId: saveItemPriceDto.ipm_godown_id,
      ipmProfitType: profitType,
      ipmUpdatedOn: new Date(),
    };
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_updated_by')) {
      data.ipmUpdatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by);
    }
    this.applyOptionalFields(data, saveItemPriceDto);
    this.applyUnitConversionFields(data, unitConversion, saveItemPriceDto);
    const updated = await tx.itemPriceMaster.update({
      where: {
        ipmId,
      },
      data,
    });
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: this.resolveAuditActor(payload.ipm_updated_by),
        notes: 'Item price updated',
      },
      tx,
    );
    return payload;
  }
  private buildListWhere(queryDto: ListItemPriceQueryDto): Prisma.ItemPriceMasterWhereInput {
    const where: Prisma.ItemPriceMasterWhereInput = {
      ipmIsDeleted: queryDto.ipm_is_deleted ?? false,
    };
    if (queryDto.ipm_company_id !== undefined) {
      where.ipmCompanyId = queryDto.ipm_company_id;
    }
    if (queryDto.ipm_branch_id !== undefined) {
      where.ipmBranchId = queryDto.ipm_branch_id;
    }
    if (queryDto.ipm_item_id !== undefined) {
      where.ipmItemId = queryDto.ipm_item_id;
    }
    if (queryDto.ipm_unit_id !== undefined) {
      where.ipmUnitId = queryDto.ipm_unit_id;
    }
    if (queryDto.ipm_godown_id !== undefined) {
      where.ipmGodownId = queryDto.ipm_godown_id;
    }
    if (queryDto.ipm_base_unit_id !== undefined) {
      where.ipmBaseUnitId = queryDto.ipm_base_unit_id;
    }
    if (queryDto.ipm_profit_type !== undefined) {
      where.ipmProfitType = queryDto.ipm_profit_type;
    }
    if (queryDto.ipm_is_active !== undefined) {
      where.ipmIsActive = queryDto.ipm_is_active;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { ipmProfitType: { contains: search, mode: 'insensitive' } },
        { ipmUomRemarks: { contains: search, mode: 'insensitive' } },
        { ipmCostRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }
  private buildItemUnitConversionListWhere(
    queryDto: ListItemUnitConversionQueryDto,
  ): Prisma.ItemUnitConversionWhereInput {
    const where: Prisma.ItemUnitConversionWhereInput = {
      iucIsDeleted: queryDto.iuc_is_deleted ?? false,
    };
    if (queryDto.iuc_company_id !== undefined) {
      where.iucCompanyId = queryDto.iuc_company_id;
    }
    if (queryDto.iuc_item_id !== undefined) {
      where.iucItemId = queryDto.iuc_item_id;
    }
    if (queryDto.iuc_unit_id !== undefined) {
      where.iucUnitId = queryDto.iuc_unit_id;
    }
    if (queryDto.iuc_base_unit_id !== undefined) {
      where.iucBaseUnitId = queryDto.iuc_base_unit_id;
    }
    if (queryDto.iuc_is_default_unit !== undefined) {
      where.iucIsDefaultUnit = queryDto.iuc_is_default_unit;
    }
    if (queryDto.iuc_is_base_unit !== undefined) {
      where.iucIsBaseUnit = queryDto.iuc_is_base_unit;
    }
    if (queryDto.iuc_is_big_unit !== undefined) {
      where.iucIsBigUnit = queryDto.iuc_is_big_unit;
    }
    if (queryDto.iuc_is_active !== undefined) {
      where.iucIsActive = queryDto.iuc_is_active;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [{ iucUomRemarks: { contains: search, mode: 'insensitive' } }];
    }
    return where;
  }
  private validateItemUnitConversion(saveItemUnitConversionDto: SaveItemUnitConversionDto): void {
    const factor = saveItemUnitConversionDto.iuc_to_base_factor;
    const unitFactor =
      saveItemUnitConversionDto.iuc_unit_factor ?? saveItemUnitConversionDto.iul_unit_factor;
    const resolvedBaseUnitId =
      saveItemUnitConversionDto.iuc_base_unit_id ?? saveItemUnitConversionDto.iuc_unit_id;
    if (factor !== undefined && factor <= 0) {
      this.throwItemUnitConversionBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'iuc_to_base_factor',
          message: 'iuc_to_base_factor must be greater than 0',
        },
      ]);
    }
    if (unitFactor !== undefined && unitFactor <= 0) {
      this.throwItemUnitConversionBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'iuc_unit_factor',
          message: 'iuc_unit_factor must be greater than 0',
        },
      ]);
    }
    const uomWeight = saveItemUnitConversionDto.iuc_uom_weight;
    if (uomWeight !== undefined && uomWeight < 0) {
      this.throwItemUnitConversionBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'iuc_uom_weight',
          message: 'iuc_uom_weight cannot be negative',
        },
      ]);
    }
    if (saveItemUnitConversionDto.iuc_is_base_unit !== true) {
      return;
    }
    if (saveItemUnitConversionDto.iuc_unit_id !== resolvedBaseUnitId) {
      this.throwItemUnitConversionBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'iuc_unit_id',
          message: 'Base unit conversion row must use the selected base unit as iuc_unit_id',
        },
      ]);
    }
    // if (factor !== undefined && factor !== 1) {
    //   this.throwItemUnitConversionBadRequest(VALIDATION_FAILED_MESSAGE, [
    //     {
    //       field: 'iuc_to_base_factor',
    //       message: 'Base unit conversion row must use iuc_to_base_factor = 1',
    //     },
    //   ]);
    // }
    // Do not force iuc_unit_factor = 1 for base row.
    // Base unit may be first, middle, or last row in the chain.
  }
  private async normalizeItemUnitConversionBaseUnits(
    tx: Prisma.TransactionClient,
    saveItems: SaveItemUnitConversionDto[],
  ): Promise<SaveItemUnitConversionDto[]> {
    const inferredBaseUnitIds = new Map<string, string>();
    for (const saveItem of saveItems) {
      if (saveItem.iuc_base_unit_id) {
        inferredBaseUnitIds.set(saveItem.iuc_item_id, saveItem.iuc_base_unit_id);
        continue;
      }
      if (saveItem.iuc_is_base_unit === true) {
        inferredBaseUnitIds.set(saveItem.iuc_item_id, saveItem.iuc_unit_id);
      }
    }
    for (const saveItem of saveItems) {
      if (saveItem.iuc_base_unit_id || inferredBaseUnitIds.has(saveItem.iuc_item_id)) {
        continue;
      }
      const persistedBaseUnitId = await this.resolvePersistedItemUnitConversionBaseUnitId(
        tx,
        saveItem.iuc_id,
        saveItem.iuc_item_id,
      );
      inferredBaseUnitIds.set(
        saveItem.iuc_item_id,
        persistedBaseUnitId ?? saveItem.iuc_unit_id,
      );
    }
    return saveItems.map((saveItem) =>
      saveItem.iuc_base_unit_id
        ? saveItem
        : {
            ...saveItem,
            iuc_base_unit_id:
              inferredBaseUnitIds.get(saveItem.iuc_item_id) ?? saveItem.iuc_unit_id,
          },
    );
  }
  private async normalizeItemUnitConversionFactors(
    tx: Prisma.TransactionClient,
    saveItems: SaveItemUnitConversionDto[],
  ): Promise<SaveItemUnitConversionDto[]> {
    if (saveItems.length === 0) {
      return saveItems;
    }
    const normalizedItems = [...saveItems];
    const saveItemsByItemId = new Map<
      string,
      Array<{ index: number; item: SaveItemUnitConversionDto }>
    >();
    saveItems.forEach((saveItem, index) => {
      const existingEntries = saveItemsByItemId.get(saveItem.iuc_item_id) ?? [];
      existingEntries.push({ index, item: saveItem });
      saveItemsByItemId.set(saveItem.iuc_item_id, existingEntries);
    });
    for (const [itemId, indexedSaveItems] of saveItemsByItemId.entries()) {
      const persistedRows = await tx.itemUnitConversion.findMany({
        where: {
          iucItemId: itemId,
          iucIsDeleted: false,
        },
        orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
      });
      const effectiveRows: EffectiveItemUnitConversionRow[] = persistedRows.map((row) => ({
        iucId: row.iucId,
        unitId: row.iucUnitId,
        baseUnitId: row.iucBaseUnitId,
        unitSlno: row.iucUnitSlno,
        toBaseFactor: this.toPositiveFactor(row.iucToBaseFactor),
        unitFactor: this.toPositiveFactor(row.iucUnitFactor),
        isBaseUnit: row.iucIsBaseUnit,
      }));
      for (const { index, item } of indexedSaveItems) {
        const nextRow: EffectiveItemUnitConversionRow = {
          saveIndex: index,
          iucId: item.iuc_id,
          unitId: item.iuc_unit_id,
          baseUnitId: item.iuc_base_unit_id ?? item.iuc_unit_id,
          unitSlno: item.iuc_unit_slno ?? 0,
          toBaseFactor: this.toPositiveFactor(item.iuc_to_base_factor),
          unitFactor: this.toPositiveFactor(item.iuc_unit_factor ?? item.iul_unit_factor),
          isBaseUnit:
            item.iuc_is_base_unit === true ||
            (item.iuc_base_unit_id ?? item.iuc_unit_id) === item.iuc_unit_id,
        };
        const existingIndex = effectiveRows.findIndex((row) =>
          item.iuc_id ? row.iucId === item.iuc_id : row.unitId === item.iuc_unit_id,
        );
        if (existingIndex >= 0) {
          effectiveRows[existingIndex] = {
            ...effectiveRows[existingIndex],
            ...nextRow,
          };
        } else {
          effectiveRows.push(nextRow);
        }
      }
      if (effectiveRows.length === 0) {
        continue;
      }
      effectiveRows.sort((left, right) => {
        if (left.unitSlno !== right.unitSlno) {
          return left.unitSlno - right.unitSlno;
        }
        return left.unitId.localeCompare(right.unitId);
      });

      const resolvedBaseUnitId =
        indexedSaveItems.find(({ item }) => item.iuc_is_base_unit === true)?.item.iuc_unit_id ??
        effectiveRows.find((row) => row.isBaseUnit)?.unitId ??
        effectiveRows[0].baseUnitId ??
        effectiveRows[0].unitId;

      for (const row of effectiveRows) {
        row.baseUnitId = resolvedBaseUnitId;
        row.isBaseUnit = row.unitId === resolvedBaseUnitId;
      }

      const cumulativeByUnitId = new Map<string, number>();

      for (let i = 0; i < effectiveRows.length; i++) {
        const row = effectiveRows[i];

        if (i === 0) {
          row.unitFactor = 1;
          cumulativeByUnitId.set(row.unitId, 1);
          continue;
        }

        const previousRow = effectiveRows[i - 1];
        const resolvedUnitFactor = this.resolveChainUnitFactor(previousRow, row);

        row.unitFactor = resolvedUnitFactor;

        const previousCumulative = cumulativeByUnitId.get(previousRow.unitId)!;
        const currentCumulative = this.roundFactor(previousCumulative * resolvedUnitFactor);
        cumulativeByUnitId.set(row.unitId, currentCumulative);
      }

      const baseCumulative = cumulativeByUnitId.get(resolvedBaseUnitId);
      if (!baseCumulative) {
        this.throwItemUnitConversionBadRequest(VALIDATION_FAILED_MESSAGE, [
          {
            field: 'iuc_base_unit_id',
            message: 'Unable to resolve base unit cumulative factor',
          },
        ]);
      }

      for (const row of effectiveRows) {
        const rowCumulative = cumulativeByUnitId.get(row.unitId)!;
        row.toBaseFactor = this.roundFactor(baseCumulative / rowCumulative);
      }

      for (const row of effectiveRows) {
        if (row.saveIndex === undefined) {
          continue;
        }

        const saveItem = normalizedItems[row.saveIndex];
        normalizedItems[row.saveIndex] = {
          ...saveItem,
          iuc_base_unit_id: resolvedBaseUnitId,
          iuc_unit_slno: row.unitSlno,
          iuc_to_base_factor: row.toBaseFactor,
          iuc_unit_factor: row.unitFactor,
          iul_unit_factor: row.unitFactor,
          iuc_is_base_unit: row.isBaseUnit,
        };
      }
    }
    return normalizedItems;
  }
  private resolveChainUnitFactor(
    previousRow: EffectiveItemUnitConversionRow,
    currentRow: EffectiveItemUnitConversionRow,
  ): number {
    const explicitUnitFactor = this.toPositiveFactor(currentRow.unitFactor);
    if (explicitUnitFactor !== undefined) {
      return this.roundFactor(explicitUnitFactor);
    }
    const previousToBaseFactor = this.toPositiveFactor(previousRow.toBaseFactor);
    const currentToBaseFactor = this.toPositiveFactor(currentRow.toBaseFactor);
    if (
      previousToBaseFactor !== undefined &&
      currentToBaseFactor !== undefined &&
      currentToBaseFactor > 0
    ) {
      return this.roundFactor(previousToBaseFactor / currentToBaseFactor);
    }
    this.throwItemUnitConversionBadRequest(VALIDATION_FAILED_MESSAGE, [
      {
        field: 'iuc_unit_factor',
        message: `Missing iuc_unit_factor for unit row ${currentRow.unitId}`,
      },
    ]);
  }
  private roundFactor(value: number, scale = 9): number {
    return Number(value.toFixed(scale));
  }
  private toPositiveFactor(value: Prisma.Decimal | number | null | undefined): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }
    return parsed;
  }
  private async resolvePersistedItemUnitConversionBaseUnitId(
    tx: Prisma.TransactionClient,
    iucId: string | undefined,
    itemId: string,
  ): Promise<string | undefined> {
    if (iucId) {
      const existingRecord = await tx.itemUnitConversion.findFirst({
        where: {
          iucId,
          iucIsDeleted: false,
        },
      });
      if (existingRecord?.iucBaseUnitId) {
        return existingRecord.iucBaseUnitId;
      }
    }
    const baseRow = await tx.itemUnitConversion.findFirst({
      where: {
        iucItemId: itemId,
        iucIsBaseUnit: true,
        iucIsDeleted: false,
      },
    });
    if (baseRow?.iucBaseUnitId) {
      return baseRow.iucBaseUnitId;
    }
    const existingRow = await tx.itemUnitConversion.findFirst({
      where: {
        iucItemId: itemId,
        iucIsDeleted: false,
      },
    });
    if (existingRow?.iucBaseUnitId) {
      return existingRow.iucBaseUnitId;
    }
    const item = await tx.itemMaster.findFirst({
      where: {
        itemId,
        itemIsDeleted: false,
      },
      select: {
        itemBaseUnitId: true,
      },
    });
    return item?.itemBaseUnitId ?? undefined;
  }
  private async syncUnitConversionFromItemPriceInput(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemUnitConversionSnapshot> {
    const explicitUnitFactor = this.toPositiveFactor(saveItemPriceDto.ipm_unit_factor);
    if (explicitUnitFactor === undefined) {
      return this.resolveUnitConversion(tx, saveItemPriceDto);
    }
    const persistedRows = await tx.itemUnitConversion.findMany({
      where: {
        iucItemId: saveItemPriceDto.ipm_item_id,
        iucIsDeleted: false,
      },
      orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
    });
    if (persistedRows.length === 0) {
      return this.buildFallbackUnitConversionSnapshot(saveItemPriceDto);
    }
    type ChainRow = {
      iucId: string;
      unitId: string;
      baseUnitId: string;
      unitSlno: number;
      unitFactor: number;
      toBaseFactor: number;
      isBaseUnit: boolean;
      isDefaultUnit: boolean;
      isBigUnit: boolean;
      uomRemarks: string | null;
      cumulative: number;
      companyId: string;
    };
    const chainRows: ChainRow[] = persistedRows.map((row) => ({
      iucId: row.iucId,
      unitId: row.iucUnitId,
      baseUnitId: row.iucBaseUnitId,
      unitSlno: row.iucUnitSlno,
      unitFactor: this.toPositiveFactor(row.iucUnitFactor) ?? 1,
      toBaseFactor: this.toPositiveFactor(row.iucToBaseFactor) ?? 1,
      isBaseUnit: row.iucIsBaseUnit,
      isDefaultUnit: row.iucIsDefaultUnit,
      isBigUnit: row.iucIsBigUnit,
      uomRemarks: row.iucUomRemarks,
      cumulative: 1,
      companyId: row.iucCompanyId,
    }));
    if (
      saveItemPriceDto.ipm_company_id !== undefined &&
      saveItemPriceDto.ipm_company_id !== null
    ) {
      const wrongCompanyRow = chainRows.find(
        (row) => row.companyId !== saveItemPriceDto.ipm_company_id,
      );
      if (wrongCompanyRow) {
        this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
          {
            field: 'ipm_company_id',
            message:
              'ipm_company_id must match the company configured on the selected item unit conversion',
          },
        ]);
      }
    }
    const targetRow = chainRows.find((row) => row.unitId === saveItemPriceDto.ipm_unit_id);
    if (!targetRow) {
      return this.buildFallbackUnitConversionSnapshot(saveItemPriceDto);
    }
    if (saveItemPriceDto.ipm_unit_slno !== undefined) {
      targetRow.unitSlno = saveItemPriceDto.ipm_unit_slno;
    }
    chainRows.sort((left, right) => {
      if (left.unitSlno !== right.unitSlno) {
        return left.unitSlno - right.unitSlno;
      }
      return left.unitId.localeCompare(right.unitId);
    });
    const resolvedBaseUnitId =
      saveItemPriceDto.ipm_base_unit_id ??
      (saveItemPriceDto.ipm_is_base_unit === true ? saveItemPriceDto.ipm_unit_id : undefined) ??
      chainRows.find((row) => row.isBaseUnit)?.unitId ??
      chainRows[0].baseUnitId ??
      chainRows[0].unitId;
    for (const row of chainRows) {
      row.baseUnitId = resolvedBaseUnitId;
      row.isBaseUnit = row.unitId === resolvedBaseUnitId;
    }
    for (let i = 0; i < chainRows.length; i++) {
      const row = chainRows[i];
      if (i === 0) {
        row.unitFactor = 1;
        row.cumulative = 1;
        continue;
      }
      if (row.unitId === saveItemPriceDto.ipm_unit_id) {
        row.unitFactor = explicitUnitFactor;
      }
      const previousRow = chainRows[i - 1];
      row.cumulative = this.roundFactor(previousRow.cumulative * row.unitFactor);
    }
    const baseRow = chainRows.find((row) => row.unitId === resolvedBaseUnitId);
    if (!baseRow) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'ipm_base_unit_id',
          message: 'Unable to resolve base unit for item price conversion',
        },
      ]);
    }
    for (const row of chainRows) {
      row.toBaseFactor = this.roundFactor(baseRow.cumulative / row.cumulative);
    }
    const actor =
      this.resolveRecordActor(saveItemPriceDto.ipm_updated_by) ??
      this.resolveRecordActor(saveItemPriceDto.ipm_created_by);
    const now = new Date();
    for (const row of chainRows) {
      await tx.itemUnitConversion.update({
        where: {
          iucId: row.iucId,
        },
        data: {
          iucBaseUnitId: row.baseUnitId,
          iucUnitSlno: row.unitSlno,
          iucUnitFactor: row.unitFactor,
          iucToBaseFactor: row.toBaseFactor,
          iucIsBaseUnit: row.isBaseUnit,
          iucUpdatedOn: now,
          ...(actor ? { iucUpdatedBy: actor } : {}),
        },
      });
    }
    const selectedRow = chainRows.find((row) => row.unitId === saveItemPriceDto.ipm_unit_id)!;
    return {
      iucBaseUnitId: selectedRow.baseUnitId,
      iucToBaseFactor: new Prisma.Decimal(selectedRow.toBaseFactor),
      iucUnitSlno: selectedRow.unitSlno,
      iucUnitFactor: new Prisma.Decimal(selectedRow.unitFactor),
      iucIsDefaultUnit: selectedRow.isDefaultUnit,
      iucIsBaseUnit: selectedRow.isBaseUnit,
      iucIsBigUnit: selectedRow.isBigUnit,
      iucUomRemarks: selectedRow.uomRemarks,
    };
  }
  private async resolveUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemUnitConversionSnapshot> {
    const unitConversion = await tx.itemUnitConversion.findFirst({
      where: {
        iucItemId: saveItemPriceDto.ipm_item_id,
        iucUnitId: saveItemPriceDto.ipm_unit_id,
        iucIsActive: true,
        iucIsDeleted: false,
      },
    });
    if (!unitConversion) {
      return this.buildFallbackUnitConversionSnapshot(saveItemPriceDto);
    }
    if (
      saveItemPriceDto.ipm_company_id !== undefined &&
      saveItemPriceDto.ipm_company_id !== null &&
      saveItemPriceDto.ipm_company_id !== unitConversion.iucCompanyId
    ) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'ipm_company_id',
          message: 'ipm_company_id must match the company configured on the selected item unit conversion',
        },
      ]);
    }
    return unitConversion;
  }
  private buildFallbackUnitConversionSnapshot(
    saveItemPriceDto: SaveItemPriceDto,
  ): ItemUnitConversionSnapshot {
    const resolvedBaseUnitId =
      saveItemPriceDto.ipm_base_unit_id ?? saveItemPriceDto.ipm_unit_id;
    const isBaseUnit =
      saveItemPriceDto.ipm_is_base_unit ?? resolvedBaseUnitId === saveItemPriceDto.ipm_unit_id;
    // only unit_factor defaults to 1
    const unitFactor =
      this.toPositiveFactor(saveItemPriceDto.ipm_unit_factor) ?? 1;
    // do NOT force to_base_factor = 1
    const toBaseFactor =
      this.toPositiveFactor(saveItemPriceDto.ipm_to_base_factor) ??
      this.toPositiveFactor(saveItemPriceDto.ipm_unit_factor) ??
      1;
    return {
      iucBaseUnitId: resolvedBaseUnitId,
      iucToBaseFactor: new Prisma.Decimal(toBaseFactor),
      iucUnitSlno: saveItemPriceDto.ipm_unit_slno ?? 0,
      iucUnitFactor: new Prisma.Decimal(unitFactor),
      iucIsDefaultUnit: saveItemPriceDto.ipm_is_default_unit ?? false,
      iucIsBaseUnit: isBaseUnit,
      iucIsBigUnit: saveItemPriceDto.ipm_is_big_unit ?? false,
      iucUomRemarks: saveItemPriceDto.ipm_uom_remarks ?? null,
    };
  }
  private applyUnitConversionFields(
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    unitConversion: ItemUnitConversionSnapshot,
    saveItemPriceDto: SaveItemPriceDto,
  ): void {
    data.ipmBaseUnitId = unitConversion.iucBaseUnitId;
    data.ipmToBaseFactor = unitConversion.iucToBaseFactor;
    data.ipmUnitSlno = unitConversion.iucUnitSlno;
    data.ipmUnitFactor = unitConversion.iucUnitFactor;
    data.ipmIsDefaultUnit = unitConversion.iucIsDefaultUnit;
    data.ipmIsBigUnit = unitConversion.iucIsBigUnit;
    data.ipmIsBaseUnit = unitConversion.iucIsBaseUnit;
    if (!this.hasOwnProperty(saveItemPriceDto, 'ipm_uom_remarks')) {
      data.ipmUomRemarks = unitConversion.iucUomRemarks;
    }
  }
  private applyItemUnitConversionOptionalFields(
    data:
      | Prisma.ItemUnitConversionUncheckedCreateInput
      | Prisma.ItemUnitConversionUncheckedUpdateInput,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): void {
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_to_base_factor')) {
      data.iucToBaseFactor = saveItemUnitConversionDto.iuc_to_base_factor;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_unit_slno')) {
      data.iucUnitSlno = saveItemUnitConversionDto.iuc_unit_slno;
    }
    const hasUnitFactor =
      this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_unit_factor') ||
      this.hasOwnProperty(saveItemUnitConversionDto, 'iul_unit_factor');
    const unitFactor =
      saveItemUnitConversionDto.iuc_unit_factor ?? saveItemUnitConversionDto.iul_unit_factor;
    if (hasUnitFactor && unitFactor !== undefined) {
      data.iucUnitFactor = unitFactor;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_default_unit')) {
      data.iucIsDefaultUnit = saveItemUnitConversionDto.iuc_is_default_unit;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_base_unit')) {
      data.iucIsBaseUnit = saveItemUnitConversionDto.iuc_is_base_unit;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_big_unit')) {
      data.iucIsBigUnit = saveItemUnitConversionDto.iuc_is_big_unit;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_uom_weight')) {
      data.iucUomWeight = saveItemUnitConversionDto.iuc_uom_weight;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_uom_remarks')) {
      data.iucUomRemarks = saveItemUnitConversionDto.iuc_uom_remarks;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_active')) {
      data.iucIsActive = saveItemUnitConversionDto.iuc_is_active;
    }
    if (this.hasOwnProperty(saveItemUnitConversionDto, 'iuc_sync_date')) {
      data.iucSyncDate = this.parseOptionalDate(
        saveItemUnitConversionDto.iuc_sync_date,
        'iuc_sync_date',
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    saveItemPriceDto: SaveItemPriceDto,
  ): void {
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_company_id')) {
      data.ipmCompanyId = saveItemPriceDto.ipm_company_id;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_branch_id')) {
      data.ipmBranchId = saveItemPriceDto.ipm_branch_id;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_base_unit_id')) {
      data.ipmBaseUnitId = saveItemPriceDto.ipm_base_unit_id;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_to_base_factor')) {
      data.ipmToBaseFactor = saveItemPriceDto.ipm_to_base_factor;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_unit_slno')) {
      data.ipmUnitSlno = saveItemPriceDto.ipm_unit_slno;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_unit_factor')) {
      data.ipmUnitFactor = saveItemPriceDto.ipm_unit_factor;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_default_unit')) {
      data.ipmIsDefaultUnit = saveItemPriceDto.ipm_is_default_unit;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_big_unit')) {
      data.ipmIsBigUnit = saveItemPriceDto.ipm_is_big_unit;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_base_unit')) {
      data.ipmIsBaseUnit = saveItemPriceDto.ipm_is_base_unit;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_cost_price')) {
      data.ipmCostPrice = saveItemPriceDto.ipm_cost_price;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_cost_wot')) {
      data.ipmCostWot = saveItemPriceDto.ipm_cost_wot;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_a')) {
      data.ipmSalesPriceA = saveItemPriceDto.ipm_sales_price_a;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_b')) {
      data.ipmSalesPriceB = saveItemPriceDto.ipm_sales_price_b;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_c')) {
      data.ipmSalesPriceC = saveItemPriceDto.ipm_sales_price_c;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_d')) {
      data.ipmSalesPriceD = saveItemPriceDto.ipm_sales_price_d;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_a_wot')) {
      data.ipmPriceAWot = saveItemPriceDto.ipm_price_a_wot;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_b_wot')) {
      data.ipmPriceBWot = saveItemPriceDto.ipm_price_b_wot;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_c_wot')) {
      data.ipmPriceCWot = saveItemPriceDto.ipm_price_c_wot;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_d_wot')) {
      data.ipmPriceDWot = saveItemPriceDto.ipm_price_d_wot;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_a_markup_perc')) {
      data.ipmPriceAMarkupPerc = saveItemPriceDto.ipm_price_a_markup_perc;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_b_markup_perc')) {
      data.ipmPriceBMarkupPerc = saveItemPriceDto.ipm_price_b_markup_perc;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_c_markup_perc')) {
      data.ipmPriceCMarkupPerc = saveItemPriceDto.ipm_price_c_markup_perc;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_price_d_markup_perc')) {
      data.ipmPriceDMarkupPerc = saveItemPriceDto.ipm_price_d_markup_perc;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_max_price')) {
      data.ipmMaxPrice = saveItemPriceDto.ipm_max_price;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_min_price')) {
      data.ipmMinPrice = saveItemPriceDto.ipm_min_price;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_disc_perc')) {
      data.ipmDiscPerc = saveItemPriceDto.ipm_disc_perc;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_disc_qty')) {
      data.ipmDiscQty = saveItemPriceDto.ipm_disc_qty;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_addl_cess')) {
      data.ipmAddlCess = saveItemPriceDto.ipm_addl_cess;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_round_off')) {
      data.ipmRoundOff = saveItemPriceDto.ipm_round_off;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_loading_charge')) {
      data.ipmLoadingCharge = saveItemPriceDto.ipm_loading_charge;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_freight_charge')) {
      data.ipmFreightCharge = saveItemPriceDto.ipm_freight_charge;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_loyalty_points')) {
      data.ipmLoyaltyPoints = saveItemPriceDto.ipm_loyalty_points;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_uom_remarks')) {
      data.ipmUomRemarks = saveItemPriceDto.ipm_uom_remarks;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_cost_remarks')) {
      data.ipmCostRemarks = saveItemPriceDto.ipm_cost_remarks;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_is_active')) {
      data.ipmIsActive = saveItemPriceDto.ipm_is_active;
    }
    if (this.hasOwnProperty(saveItemPriceDto, 'ipm_sync_date')) {
      data.ipmSyncDate = this.parseOptionalDate(saveItemPriceDto.ipm_sync_date, 'ipm_sync_date');
    }
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
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: fieldName,
          message: `${fieldName} must be a valid date`,
        },
      ]);
    }
    return parsedDate;
  }
  private toPayload(record: ItemPriceMaster): ItemPricePayload {
    return {
      ipm_id: record.ipmId,
      ipm_company_id: record.ipmCompanyId,
      ipm_branch_id: record.ipmBranchId,
      ipm_item_id: record.ipmItemId,
      ipm_unit_id: record.ipmUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_base_unit_id: record.ipmBaseUnitId,
      ipm_to_base_factor: this.toNumber(record.ipmToBaseFactor),
      ipm_unit_slno: record.ipmUnitSlno,
      ipm_unit_factor: this.toNumber(record.ipmUnitFactor),
      ipm_is_default_unit: record.ipmIsDefaultUnit,
      ipm_is_big_unit: record.ipmIsBigUnit,
      ipm_is_base_unit: record.ipmIsBaseUnit,
      ipm_cost_price: this.toNumber(record.ipmCostPrice),
      ipm_cost_wot: this.toNumber(record.ipmCostWot),
      ipm_sales_price_a: this.toNumber(record.ipmSalesPriceA),
      ipm_sales_price_b: this.toNumber(record.ipmSalesPriceB),
      ipm_sales_price_c: this.toNumber(record.ipmSalesPriceC),
      ipm_sales_price_d: this.toNumber(record.ipmSalesPriceD),
      ipm_price_a_wot: this.toNumber(record.ipmPriceAWot),
      ipm_price_b_wot: this.toNumber(record.ipmPriceBWot),
      ipm_price_c_wot: this.toNumber(record.ipmPriceCWot),
      ipm_price_d_wot: this.toNumber(record.ipmPriceDWot),
      ipm_price_a_markup_perc: this.toNumber(record.ipmPriceAMarkupPerc),
      ipm_price_b_markup_perc: this.toNumber(record.ipmPriceBMarkupPerc),
      ipm_price_c_markup_perc: this.toNumber(record.ipmPriceCMarkupPerc),
      ipm_price_d_markup_perc: this.toNumber(record.ipmPriceDMarkupPerc),
      ipm_max_price: this.toNumber(record.ipmMaxPrice),
      ipm_min_price: this.toNumber(record.ipmMinPrice),
      ipm_disc_perc: this.toNumber(record.ipmDiscPerc),
      ipm_disc_qty: this.toNumber(record.ipmDiscQty),
      ipm_addl_cess: this.toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: this.toNumber(record.ipmRoundOff),
      ipm_loading_charge: this.toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: this.toNumber(record.ipmFreightCharge),
      ipm_loyalty_points: this.toNumber(record.ipmLoyaltyPoints),
      ipm_uom_remarks: record.ipmUomRemarks,
      ipm_cost_remarks: record.ipmCostRemarks,
      ipm_is_active: record.ipmIsActive,
      ipm_is_deleted: record.ipmIsDeleted,
      ipm_sync_date: record.ipmSyncDate ? record.ipmSyncDate.toISOString() : null,
      ipm_created_on: record.ipmCreatedOn.toISOString(),
      ipm_created_by: record.ipmCreatedBy,
      ipm_updated_on: record.ipmUpdatedOn ? record.ipmUpdatedOn.toISOString() : null,
      ipm_updated_by: record.ipmUpdatedBy,
    };
  }
  private toItemUnitConversionPayload(record: ItemUnitConversion): ItemUnitConversionPayload {
    return {
      iuc_id: record.iucId,
      iuc_company_id: record.iucCompanyId,
      iuc_item_id: record.iucItemId,
      iuc_unit_id: record.iucUnitId,
      iuc_base_unit_id: record.iucBaseUnitId,
      iuc_to_base_factor: this.toNumber(record.iucToBaseFactor),
      iuc_unit_slno: record.iucUnitSlno,
      iuc_unit_factor: this.toNumber(record.iucUnitFactor),
      iuc_is_default_unit: record.iucIsDefaultUnit,
      iuc_is_base_unit: record.iucIsBaseUnit,
      iuc_is_big_unit: record.iucIsBigUnit,
      iuc_uom_weight: this.toNumber(record.iucUomWeight),
      iuc_uom_remarks: record.iucUomRemarks,
      iuc_is_active: record.iucIsActive,
      iuc_is_deleted: record.iucIsDeleted,
      iuc_sync_date: record.iucSyncDate ? record.iucSyncDate.toISOString() : null,
      iuc_created_on: record.iucCreatedOn.toISOString(),
      iuc_created_by: record.iucCreatedBy,
      iuc_updated_on: record.iucUpdatedOn ? record.iucUpdatedOn.toISOString() : null,
      iuc_updated_by: record.iucUpdatedBy,
    };
  }
  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  private buildDisplayName(record: ItemPriceMaster): string {
    const branchSegment = record.ipmBranchId ?? 'NO_BRANCH';
    return `${record.ipmItemId}:${record.ipmUnitId}:${branchSegment}:${record.ipmGodownId}`;
  }
  private buildItemUnitConversionDisplayName(record: ItemUnitConversion): string {
    return `${record.iucItemId}:${record.iucUnitId}:${record.iucBaseUnitId}`;
  }
  private resolveRecordActor(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed || null;
  }
  private resolveAuditActor(value: string | null | undefined, fallback = DEFAULT_AUDIT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item price already exists', [
          {
            field: 'ipm_item_id',
            message: 'Duplicate item price configuration is not allowed',
          },
        ]),
      );
    }
    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'request',
            message: 'Referenced company, branch, item, unit, base unit, or godown does not exist',
          },
        ]),
      );
    }
  }
  private handleItemUnitConversionWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildItemUnitConversionErrorResponse('Item unit conversion already exists', [
          {
            field: 'iuc_unit_id',
            message:
              'Duplicate item unit conversion, default-unit, or base-unit configuration is not allowed',
          },
        ]),
      );
    }
    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildItemUnitConversionErrorResponse('Invalid relation reference', [
          {
            field: 'request',
            message: 'Referenced company, item, unit, or base unit does not exist',
          },
        ]),
      );
    }
  }
  private handleDeleteError(error: unknown): void {
    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Cannot delete item price', [
          {
            field: 'ipm_id',
            message: 'Item price is referenced by related records',
          },
        ]),
      );
    }
  }
  private handleItemUnitConversionDeleteError(error: unknown): void {
    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildItemUnitConversionErrorResponse('Cannot delete item unit conversion', [
          {
            field: 'iuc_id',
            message: 'Item unit conversion is referenced by related records',
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
  private throwNotFound(ipmId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item price not found', [
        {
          field: 'ipm_id',
          message: `No item price found with id ${ipmId}`,
        },
      ]),
    );
  }
  private throwItemUnitConversionNotFound(iucId: string): never {
    throw new NotFoundException(
      this.buildItemUnitConversionErrorResponse('Item unit conversion not found', [
        {
          field: 'iuc_id',
          message: `No item unit conversion found with id ${iucId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: ItemPriceErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private throwItemUnitConversionBadRequest(
    message: string,
    errors: ItemPriceErrorDetail[],
  ): never {
    throw new BadRequestException(this.buildItemUnitConversionErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: ItemPriceErrorDetail[] = [],
  ): ItemPriceErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
  private buildItemUnitConversionErrorResponse(
    message: string,
    errors: ItemPriceErrorDetail[] = [],
  ): ItemPriceErrorResponse {
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
