import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemQueryDto } from './dto/list-item-query.dto';
import { SaveItemDto } from './dto/save-item.dto';
import {
  ItemErrorDetail,
  ItemErrorResponse,
  ItemListItem,
  ItemListMeta,
  ItemPayload,
} from './types/item-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const ITEM_TABLE_NAME = 'item master';
const ITEM_AUDIT_SCREEN_NAME = 'Item Master';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
@Injectable()
export class ItemsMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) { }
  async save(saveItemDto: SaveItemDto): Promise<ItemPayload> {
    if (saveItemDto.item_id) {
      return this.updateItem(saveItemDto);
    }
    return this.createItem(saveItemDto);
  }
  async list(
    queryDto: ListItemQueryDto,
  ): Promise<ConfiguredGridListResult<ItemListItem, ItemListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.item_branch_id !== undefined ||
      queryDto.item_group_id !== undefined ||
      queryDto.item_category_id !== undefined ||
      queryDto.item_brand_id !== undefined ||
      queryDto.item_section_id !== undefined ||
      queryDto.item_base_unit_id !== undefined ||
      queryDto.item_default_tax_id !== undefined ||
      queryDto.item_stock_type !== undefined ||
      queryDto.item_is_active !== undefined ||
      queryDto.item_is_service !== undefined;
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    return this.listFromPrisma(queryDto, page, limit, skip);
  }
  private async listFromPrisma(
    queryDto: ListItemQueryDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<ItemListItem, ItemListMeta>> {
    const where = this.buildListWhere(queryDto);
    const [total, records, styles] = await Promise.all([
      this.prisma.itemMaster.count({ where }),
      this.prisma.itemMaster.findMany({
        where,
        orderBy: [{ itemSortOrder: 'asc' }, { itemNameEn: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(ITEM_TABLE_NAME),
    ]);
    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      ...(styles !== undefined && { styles }),
    };
  }
  private async listFromConfiguredGridSql(
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<ItemListItem, ItemListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_TABLE_NAME,
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
        tableName: ITEM_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_grid',
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
  async getById(itemId: string): Promise<ItemPayload> {
    const record = await this.prisma.itemMaster.findFirst({
      where: {
        itemId,
        itemIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(itemId);
    }
    return this.toPayload(record);
  }
  async softDelete(itemId: string): Promise<{ item_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.itemMaster.findFirst({
        where: {
          itemId,
          itemIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(itemId);
      }
      const modifiedOn = new Date();
      const modifiedBy = DEFAULT_ACTOR;
      const result = await tx.itemMaster.updateMany({
        where: {
          itemId,
          itemIsDeleted: false,
        },
        data: {
          itemIsDeleted: true,
          itemModifiedOn: modifiedOn,
          itemModifiedBy: modifiedBy,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(itemId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        itemIsDeleted: true,
        itemModifiedOn: modifiedOn,
        itemModifiedBy: modifiedBy,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_TABLE_NAME,
          screenName: ITEM_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: itemId,
          displayName: existing.itemNameEn,
          originalRecord,
          modifiedRecord,
          userId: modifiedBy,
          notes: 'Item soft deleted',
        },
        tx,
      );
      return {
        item_id: itemId,
        deleted: true,
      };
    });
  }
  private async createItem(saveItemDto: SaveItemDto): Promise<ItemPayload> {
    const itemNameEn = saveItemDto.item_name_en?.trim();
    if (!itemNameEn) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'item_name_en',
          message: 'item_name_en is required',
        },
      ]);
    }
    const now = new Date();
    const createdBy = this.resolveActor(saveItemDto.item_created_by);
    const modifiedBy = this.resolveActor(saveItemDto.item_modified_by, createdBy);
    const data: Prisma.ItemMasterUncheckedCreateInput = {
      itemCompanyId: saveItemDto.item_company_id,
      itemNameEn,
      itemGroupId: saveItemDto.item_group_id,
      itemBaseUnitId: saveItemDto.item_base_unit_id ?? null,
      itemPackingItemIds: saveItemDto.item_packing_item_ids ?? [],
      itemCreatedOn: now,
      itemCreatedBy: createdBy,
      itemModifiedOn: now,
      itemModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveItemDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.itemMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_TABLE_NAME,
            screenName: ITEM_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.item_id,
            displayName: payload.item_name_en,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Item created',
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
  private async updateItem(saveItemDto: SaveItemDto): Promise<ItemPayload> {
    const itemId = saveItemDto.item_id!;
    const itemNameEn = saveItemDto.item_name_en?.trim();
    if (!itemNameEn) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'item_name_en',
          message: 'item_name_en cannot be empty',
        },
      ]);
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemMaster.findFirst({
          where: {
            itemId,
            itemIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(itemId);
        }
        const data: Prisma.ItemMasterUncheckedUpdateInput = {
          itemNameEn,
          itemGroupId: saveItemDto.item_group_id,
          itemBaseUnitId: saveItemDto.item_base_unit_id ?? null,
          itemModifiedOn: new Date(),
          itemModifiedBy: this.resolveActor(saveItemDto.item_modified_by),
        };
        this.applyOptionalFields(data, saveItemDto);
        const updated = await tx.itemMaster.update({
          where: {
            itemId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_TABLE_NAME,
            screenName: ITEM_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: itemId,
            displayName: payload.item_name_en,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.item_modified_by ?? DEFAULT_ACTOR,
            notes: 'Item updated',
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
  private buildListWhere(queryDto: ListItemQueryDto): Prisma.ItemMasterWhereInput {
    const where: Prisma.ItemMasterWhereInput = {
      itemIsDeleted: false,
    };
    if (queryDto.item_branch_id !== undefined) {
      where.itemBranchId = queryDto.item_branch_id;
    }
    if (queryDto.item_group_id !== undefined) {
      where.itemGroupId = queryDto.item_group_id;
    }
    if (queryDto.item_category_id !== undefined) {
      where.itemCategoryId = queryDto.item_category_id;
    }
    if (queryDto.item_brand_id !== undefined) {
      where.itemBrandId = queryDto.item_brand_id;
    }
    if (queryDto.item_section_id !== undefined) {
      where.itemSectionId = queryDto.item_section_id;
    }
    if (queryDto.item_base_unit_id !== undefined) {
      where.itemBaseUnitId = queryDto.item_base_unit_id;
    }
    if (queryDto.item_default_tax_id !== undefined) {
      where.itemDefaultTaxId = queryDto.item_default_tax_id;
    }
    if (queryDto.item_stock_type !== undefined) {
      where.itemStockType = queryDto.item_stock_type;
    }
    if (queryDto.item_is_active !== undefined) {
      where.itemIsActive = queryDto.item_is_active;
    }
    if (queryDto.item_is_service !== undefined) {
      where.itemIsService = queryDto.item_is_service;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { itemNameEn: { contains: search, mode: 'insensitive' } },
        { itemCode: { contains: search, mode: 'insensitive' } },
        { itemSku: { contains: search, mode: 'insensitive' } },
        { itemAlias: { contains: search, mode: 'insensitive' } },
        { itemDefaultBarcode: { contains: search, mode: 'insensitive' } },
        { itemHsnCode: { contains: search, mode: 'insensitive' } },
        { itemNotes: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }
  private applyOptionalFields(
    data: Prisma.ItemMasterUncheckedCreateInput | Prisma.ItemMasterUncheckedUpdateInput,
    saveItemDto: SaveItemDto,
  ): void {
    if (this.hasOwnProperty(saveItemDto, 'item_company_id')) {
      data.itemCompanyId = saveItemDto.item_company_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_branch_id')) {
      data.itemBranchId = saveItemDto.item_branch_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_code')) {
      data.itemCode = saveItemDto.item_code;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_sku')) {
      data.itemSku = saveItemDto.item_sku;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_name_ta')) {
      data.itemNameTa = saveItemDto.item_name_ta;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_alias')) {
      data.itemAlias = saveItemDto.item_alias;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_stock_type')) {
      data.itemStockType = saveItemDto.item_stock_type;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_default_barcode')) {
      data.itemDefaultBarcode = saveItemDto.item_default_barcode;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_category_id')) {
      data.itemCategoryId = saveItemDto.item_category_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_brand_id')) {
      data.itemBrandId = saveItemDto.item_brand_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_section_id')) {
      data.itemSectionId = saveItemDto.item_section_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_company_category_id')) {
      data.itemCompanyCategoryId = saveItemDto.item_company_category_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_mfgr_id')) {
      data.itemMfgrId = saveItemDto.item_mfgr_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_supplier_id')) {
      data.itemSupplierId = saveItemDto.item_supplier_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_cust_group')) {
      data.itemCustGroup = saveItemDto.item_cust_group;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_is_service')) {
      data.itemIsService = saveItemDto.item_is_service;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_is_batch_based')) {
      data.itemIsBatchBased = saveItemDto.item_is_batch_based;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_is_expiry_item')) {
      data.itemIsExpiryItem = saveItemDto.item_is_expiry_item;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_expiry_days')) {
      data.itemExpiryDays = saveItemDto.item_expiry_days;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_intimate_before_days')) {
      data.itemIntimateBeforeDays = saveItemDto.item_intimate_before_days;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_allow_sales')) {
      data.itemAllowSales = saveItemDto.item_allow_sales;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_allow_sales_return')) {
      data.itemAllowSalesReturn = saveItemDto.item_allow_sales_return;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_purchase')) {
      data.itemAllowPurchase = saveItemDto.item_allow_purchase;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_po')) {
      data.itemAllowPo = saveItemDto.item_allow_po;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_so')) {
      data.itemAllowSo = saveItemDto.item_allow_so;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_neg_stock')) {
      data.itemAllowNegStock = saveItemDto.item_allow_neg_stock;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_negative_so')) {
      data.itemAllowNegativeSo = saveItemDto.item_allow_negative_so;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_price_list')) {
      data.itemPriceList = saveItemDto.item_price_list;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_weigh_scale')) {
      data.itemWeighScale = saveItemDto.item_weigh_scale;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_retail_item')) {
      data.itemRetailItem = saveItemDto.item_retail_item;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_is_kit')) {
      data.itemIsKit = saveItemDto.item_is_kit;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_auto_break')) {
      data.itemAutoBreak = saveItemDto.item_auto_break;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_auto_make')) {
      data.itemAutoMake = saveItemDto.item_auto_make;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_loyalty')) {
      data.itemAllowLoyalty = saveItemDto.item_allow_loyalty;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_promo')) {
      data.itemAllowPromo = saveItemDto.item_allow_promo;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_has_offer')) {
      data.itemHasOffer = saveItemDto.item_has_offer;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_damagable_product')) {
      data.itemDamagableProduct = saveItemDto.item_damagable_product;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_is_demand')) {
      data.itemIsDemand = saveItemDto.item_is_demand;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_loading')) {
      data.itemAllowLoading = saveItemDto.item_allow_loading;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_allow_freight')) {
      data.itemAllowFreight = saveItemDto.item_allow_freight;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_random_stock')) {
      data.itemRandomStock = saveItemDto.item_random_stock;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_barcode_sticker')) {
      data.itemBarcodeSticker = saveItemDto.item_barcode_sticker;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_barcode_sticker_id')) {
      data.itemBarcodeStickerId = saveItemDto.item_barcode_sticker_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_default_tax_id')) {
      data.itemDefaultTaxId = saveItemDto.item_default_tax_id;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_hsn_code')) {
      data.itemHsnCode = saveItemDto.item_hsn_code;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_batch_config')) {
      data.itemBatchConfig = saveItemDto.item_batch_config;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_sort_order')) {
      data.itemSortOrder = saveItemDto.item_sort_order;
    }

    if (this.hasOwnProperty(saveItemDto, 'item_photo')) {
      data.itemPhoto = this.decodePhoto(saveItemDto.item_photo);
    }
    if (this.hasOwnProperty(saveItemDto, 'item_image_url')) {
      data.itemImageUrl = saveItemDto.item_image_url;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_notes')) {
      data.itemNotes = saveItemDto.item_notes;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_storage_location')) {
      data.itemStorageLocation = saveItemDto.item_storage_location;
    }
    if (this.hasOwnProperty(saveItemDto, 'item_packing_item_ids')) {
      data.itemPackingItemIds = saveItemDto.item_packing_item_ids ?? [];
    }
    if (this.hasOwnProperty(saveItemDto, 'item_is_active')) {
      data.itemIsActive = saveItemDto.item_is_active;
    }
  }
  private decodePhoto(
    value: string | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const normalized = value.replace(/\s+/g, '');
    if (!normalized) {
      return null;
    }
    if (normalized.length % 4 !== 0 || !BASE64_PATTERN.test(normalized)) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'item_photo',
          message: 'item_photo must be a valid base64 string',
        },
      ]);
    }
    const bytes = Uint8Array.from(Buffer.from(normalized, 'base64'));
    return bytes;
  }
  private toPayload(record: ItemMaster): ItemPayload {
    return {
      item_id: record.itemId,
      item_company_id: record.itemCompanyId,
      item_branch_id: record.itemBranchId,
      item_code: record.itemCode,
      item_sku: record.itemSku,
      item_name_en: record.itemNameEn,
      item_name_ta: record.itemNameTa,
      item_alias: record.itemAlias,
      item_stock_type: record.itemStockType,
      item_default_barcode: record.itemDefaultBarcode,
      item_group_id: record.itemGroupId,
      item_category_id: record.itemCategoryId,
      item_brand_id: record.itemBrandId,
      item_section_id: record.itemSectionId,
      item_company_category_id: record.itemCompanyCategoryId,
      item_mfgr_id: record.itemMfgrId,
      item_supplier_id: record.itemSupplierId,
      item_cust_group: record.itemCustGroup,
      item_base_unit_id: record.itemBaseUnitId,
      item_is_service: record.itemIsService,
      item_is_batch_based: record.itemIsBatchBased,
      item_is_expiry_item: record.itemIsExpiryItem,
      item_expiry_days: record.itemExpiryDays,
      item_intimate_before_days: record.itemIntimateBeforeDays,
      item_allow_sales: record.itemAllowSales,
      item_allow_sales_return: record.itemAllowSalesReturn,
      item_allow_purchase: record.itemAllowPurchase,
      item_allow_po: record.itemAllowPo,
      item_allow_so: record.itemAllowSo,
      item_allow_neg_stock: record.itemAllowNegStock,
      item_allow_negative_so: record.itemAllowNegativeSo,
      item_price_list: record.itemPriceList,
      item_weigh_scale: record.itemWeighScale,
      item_retail_item: record.itemRetailItem,
      item_is_kit: record.itemIsKit,
      item_auto_break: record.itemAutoBreak,
      item_auto_make: record.itemAutoMake,
      item_allow_loyalty: record.itemAllowLoyalty,
      item_allow_promo: record.itemAllowPromo,
      item_has_offer: record.itemHasOffer,
      item_damagable_product: record.itemDamagableProduct,
      item_is_demand: record.itemIsDemand,
      item_allow_loading: record.itemAllowLoading,
      item_allow_freight: record.itemAllowFreight,
      item_random_stock: record.itemRandomStock,
      item_barcode_sticker: record.itemBarcodeSticker,
      item_barcode_sticker_id: record.itemBarcodeStickerId,
      item_default_tax_id: record.itemDefaultTaxId,
      item_hsn_code: record.itemHsnCode,
      item_batch_config: record.itemBatchConfig,
      item_sort_order: record.itemSortOrder,
      item_photo: record.itemPhoto ? Buffer.from(record.itemPhoto).toString('base64') : null,
      item_image_url: record.itemImageUrl,
      item_notes: record.itemNotes,
      item_storage_location: record.itemStorageLocation,
      item_packing_item_ids: record.itemPackingItemIds,
      item_is_active: record.itemIsActive,
      item_is_deleted: record.itemIsDeleted,
      item_created_on: record.itemCreatedOn.toISOString(),
      item_created_by: record.itemCreatedBy,
      item_modified_on: record.itemModifiedOn.toISOString(),
      item_modified_by: record.itemModifiedBy,
    };
  }
  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item already exists', [
          {
            field: 'item_name_en',
            message: 'Duplicate item_name_en is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'item_group_id',
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

  private throwNotFound(itemId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item not found', [
        {
          field: 'item_id',
          message: `No active item found with id ${itemId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(message: string, errors: ItemErrorDetail[] = []): ItemErrorResponse {
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
