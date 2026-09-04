"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsMasterService = void 0;
const common_1 = require("@nestjs/common");
const item_unit_conversion_service_1 = require("../item-unit-conversion/item-unit-conversion.service");
const items_price_master_service_1 = require("../items-price-master/items-price-master.service");
const items_ean_code_master_service_1 = require("../items-ean-code-master/items-ean-code-master.service");
const items_reorder_master_service_1 = require("../items-reorder-master/items-reorder-master.service");
const item_master_update_service_1 = require("./item-master-update.service");
const stock_track_policy_service_1 = require("../../stocks/stock-track-policy/stock-track-policy.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_2 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_TABLE_NAME = 'item master';
const ITEM_AUDIT_SCREEN_NAME = 'Item Master';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const COMPOSITE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
let ItemsMasterService = class ItemsMasterService {
    prisma;
    auditLogService;
    requestContextService;
    itemUnitConversionService;
    itemsPriceMasterService;
    itemsEanCodeMasterService;
    itemsReorderMasterService;
    itemMasterUpdateService;
    stockTrackPolicyService;
    constructor(prisma, auditLogService, requestContextService, itemUnitConversionService, itemsPriceMasterService, itemsEanCodeMasterService, itemsReorderMasterService, itemMasterUpdateService, stockTrackPolicyService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.itemUnitConversionService = itemUnitConversionService;
        this.itemsPriceMasterService = itemsPriceMasterService;
        this.itemsEanCodeMasterService = itemsEanCodeMasterService;
        this.itemsReorderMasterService = itemsReorderMasterService;
        this.itemMasterUpdateService = itemMasterUpdateService;
        this.stockTrackPolicyService = stockTrackPolicyService;
    }
    async save(saveItemDto, tx) {
        if (saveItemDto.item_id) {
            return this.updateItem(saveItemDto, tx);
        }
        return this.createItem(saveItemDto, tx);
    }
    async saveComposite(dto) {
        return this.prisma.$transaction(async (tx) => {
            const item = await this.save(dto, tx);
            const children = await this.itemMasterUpdateService.syncChildren(item.item_id, dto, tx);
            return { item, ...children };
        }, COMPOSITE_TRANSACTION_OPTIONS);
    }
    async getById(itemId) {
        const record = await this.prisma.itemMaster.findFirst({
            where: {
                itemId,
                itemIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_2.throwInventoryNotFound)('Item not found', 'item_id', `No active item found with id ${itemId}`);
        }
        return this.toPayload(record);
    }
    async getComposite(itemId) {
        const item = await this.getById(itemId);
        const [unit_conversions, prices, ean_codes, reorders] = await Promise.all([
            this.itemUnitConversionService.findByItemId(itemId),
            this.itemsPriceMasterService.findByItemId(itemId),
            this.itemsEanCodeMasterService.findByItemId(itemId),
            this.itemsReorderMasterService.findByItemId(itemId),
        ]);
        return this.resolveCompositeNames({ item, unit_conversions, prices, ean_codes, reorders });
    }
    async resolveCompositeNames(composite) {
        const { item, unit_conversions, prices, ean_codes, reorders } = composite;
        const collect = (...ids) => Array.from(new Set(ids.filter((id) => !!id)));
        const unitIdByConversionId = new Map(unit_conversions.map((r) => [r.iuc_id, r.iuc_unit_id]));
        const conversionUnitId = (iucId) => iucId ? (unitIdByConversionId.get(iucId) ?? null) : null;
        const companyIds = collect(item.item_company_id, ...prices.map((r) => r.ipm_company_id));
        const branchIds = collect(item.item_branch_id, ...prices.map((r) => r.ipm_branch_id), ...reorders.map((r) => r.ir_branch_id));
        const unitIds = collect(item.item_base_unit_id, ...unit_conversions.flatMap((r) => [r.iuc_unit_id, r.iuc_base_unit_id]), ...prices.map((r) => conversionUnitId(r.ipm_uc_unit_id)), ...ean_codes.map((r) => conversionUnitId(r.ean_unit_id)), ...reorders.map((r) => conversionUnitId(r.ir_unit_id)));
        const godownIds = collect(...prices.map((r) => r.ipm_godown_id), ...reorders.map((r) => r.ir_godown_id));
        const groupIds = collect(item.item_group_id);
        const categoryIds = collect(item.item_category_id);
        const brandIds = collect(item.item_brand_id);
        const sectionIds = collect(item.item_section_id);
        const supplierIds = collect(item.item_supplier_id);
        const custGroupIds = collect(item.item_cust_group);
        const taxIds = collect(item.item_default_tax_id);
        const [companies, branches, units, godowns, groups, categories, brands, sections, suppliers, custGroups, taxes] = await Promise.all([
            companyIds.length
                ? this.prisma.company.findMany({
                    where: { compId: { in: companyIds } },
                    select: { compId: true, compName: true },
                })
                : [],
            branchIds.length
                ? this.prisma.branchMaster.findMany({
                    where: { brId: { in: branchIds } },
                    select: { brId: true, brName: true },
                })
                : [],
            unitIds.length
                ? this.prisma.unit.findMany({
                    where: { unit_id: { in: unitIds } },
                    select: { unit_id: true, unit_name: true },
                })
                : [],
            godownIds.length
                ? this.prisma.godownLocation.findMany({
                    where: { gdlId: { in: godownIds } },
                    select: { gdlId: true, gdlName: true },
                })
                : [],
            groupIds.length
                ? this.prisma.itemGroupMaster.findMany({
                    where: { itgId: { in: groupIds } },
                    select: { itgId: true, itgName: true },
                })
                : [],
            categoryIds.length
                ? this.prisma.categoryMaster.findMany({
                    where: { categoryId: { in: categoryIds } },
                    select: { categoryId: true, categoryName: true },
                })
                : [],
            brandIds.length
                ? this.prisma.itemBrandMaster.findMany({
                    where: { brand_id: { in: brandIds } },
                    select: { brand_id: true, brand_name: true },
                })
                : [],
            sectionIds.length
                ? this.prisma.itemSectionMaster.findMany({
                    where: { secId: { in: sectionIds } },
                    select: { secId: true, secName: true },
                })
                : [],
            supplierIds.length
                ? this.prisma.supplier.findMany({
                    where: { supId: { in: supplierIds } },
                    select: { supId: true, supName: true },
                })
                : [],
            custGroupIds.length
                ? this.prisma.custGroup.findMany({
                    where: { cgrId: { in: custGroupIds } },
                    select: { cgrId: true, cgrName: true },
                })
                : [],
            taxIds.length
                ? this.prisma.itemTaxMaster.findMany({
                    where: { taxId: { in: taxIds } },
                    select: { taxId: true, taxName: true },
                })
                : [],
        ]);
        const companyName = new Map(companies.map((r) => [r.compId, r.compName]));
        const branchName = new Map(branches.map((r) => [r.brId, r.brName]));
        const unitName = new Map(units.map((r) => [r.unit_id, r.unit_name]));
        const godownName = new Map(godowns.map((r) => [r.gdlId, r.gdlName]));
        const groupName = new Map(groups.map((r) => [r.itgId, r.itgName]));
        const categoryName = new Map(categories.map((r) => [r.categoryId, r.categoryName]));
        const brandName = new Map(brands.map((r) => [r.brand_id, r.brand_name]));
        const sectionName = new Map(sections.map((r) => [r.secId, r.secName]));
        const supplierName = new Map(suppliers.map((r) => [r.supId, r.supName]));
        const custGroupName = new Map(custGroups.map((r) => [r.cgrId, r.cgrName]));
        const taxName = new Map(taxes.map((r) => [r.taxId, r.taxName]));
        const nameOf = (map, id) => id ? (map.get(id) ?? null) : null;
        return {
            item: {
                ...item,
                item_company_name: nameOf(companyName, item.item_company_id),
                item_branch_name: nameOf(branchName, item.item_branch_id),
                item_group_name: nameOf(groupName, item.item_group_id),
                item_category_name: nameOf(categoryName, item.item_category_id),
                item_brand_name: nameOf(brandName, item.item_brand_id),
                item_section_name: nameOf(sectionName, item.item_section_id),
                item_supplier_name: nameOf(supplierName, item.item_supplier_id),
                item_cust_group_name: nameOf(custGroupName, item.item_cust_group),
                item_base_unit_name: nameOf(unitName, item.item_base_unit_id),
                item_default_tax_name: nameOf(taxName, item.item_default_tax_id),
            },
            unit_conversions: unit_conversions.map((r) => ({
                ...r,
                iuc_unit_name: nameOf(unitName, r.iuc_unit_id),
                iuc_base_unit_name: nameOf(unitName, r.iuc_base_unit_id),
            })),
            prices: prices.map((r) => {
                const unitId = conversionUnitId(r.ipm_uc_unit_id);
                return {
                    ...r,
                    ipm_company_name: nameOf(companyName, r.ipm_company_id),
                    ipm_branch_name: nameOf(branchName, r.ipm_branch_id),
                    ipm_uc_unit_id: unitId ?? r.ipm_uc_unit_id,
                    ipm_unit_name: nameOf(unitName, unitId),
                    ipm_godown_name: nameOf(godownName, r.ipm_godown_id),
                };
            }),
            ean_codes: ean_codes.map((r) => {
                const unitId = conversionUnitId(r.ean_unit_id);
                return {
                    ...r,
                    ean_unit_id: unitId ?? r.ean_unit_id,
                    ean_unit_name: nameOf(unitName, unitId),
                };
            }),
            reorders: reorders.map((r) => {
                const unitId = conversionUnitId(r.ir_unit_id);
                return {
                    ...r,
                    ir_branch_name: nameOf(branchName, r.ir_branch_id),
                    ir_unit_id: unitId ?? r.ir_unit_id,
                    ir_unit_name: nameOf(unitName, unitId),
                    ir_godown_name: nameOf(godownName, r.ir_godown_id),
                };
            }),
        };
    }
    async listForBulkLoad(params) {
        const where = {
            itemIsDeleted: false,
            itemIsActive: true,
            ...(params.itemCompanyId ? { itemCompanyId: params.itemCompanyId } : {}),
            ...(params.itemBranchId ? { itemBranchId: params.itemBranchId } : {}),
            ...(params.itemGroupId ? { itemGroupId: params.itemGroupId } : {}),
            ...(params.itemBrandId ? { itemBrandId: params.itemBrandId } : {}),
            ...(params.itemSectionId ? { itemSectionId: params.itemSectionId } : {}),
            ...(params.itemCategoryId ? { itemCategoryId: params.itemCategoryId } : {}),
        };
        const items = await this.prisma.itemMaster.findMany({
            where,
            include: {
                prices: {
                    where: { ipmIsDeleted: false },
                    orderBy: [
                        { itemUnitConversion: { iucIsDefaultUnit: 'desc' } },
                        { ipmSlNo: 'asc' },
                        { itemUnitConversion: { iucUnitSlno: 'asc' } },
                        { ipmId: 'asc' },
                    ],
                    include: { itemUnitConversion: { include: { unit: true } }, godown: true },
                },
            },
            orderBy: { itemNameEn: 'asc' },
            take: params.limit ?? 500,
        });
        if (items.length === 0)
            return [];
        const taxIds = Array.from(new Set(items.map((i) => i.itemDefaultTaxId).filter((id) => id !== null)));
        const taxRecords = taxIds.length > 0
            ? await this.prisma.itemTaxMaster.findMany({ where: { taxId: { in: taxIds }, taxIsDeleted: false } })
            : [];
        const taxById = new Map(taxRecords.map((t) => [t.taxId, t]));
        return items.map((item) => {
            const p = (params.godownId
                ? item.prices.find((r) => r.ipmGodownId === params.godownId)
                : undefined)
                ?? item.prices.find((r) => r.itemUnitConversion.iucIsDefaultUnit)
                ?? item.prices[0]
                ?? null;
            const tax = item.itemDefaultTaxId ? (taxById.get(item.itemDefaultTaxId) ?? null) : null;
            const trackingType = item.itemBatchConfig === 1 ? 'MRP'
                : item.itemBatchConfig === 2 || item.itemIsBatchBased || item.itemIsExpiryItem ? 'BATCH'
                    : 'NONE';
            return {
                item_id: item.itemId,
                item_name: item.itemNameEn,
                item_code: item.itemCode,
                item_default_barcode: item.itemDefaultBarcode,
                item_base_unit_id: item.itemBaseUnitId,
                item_batch_config: item.itemBatchConfig,
                price_master_id: p?.ipmId ?? null,
                unit_id: p?.itemUnitConversion.iucUnitId ?? item.itemBaseUnitId ?? null,
                unit_name: p?.itemUnitConversion.unit.unit_name ?? null,
                base_unit_id: p?.itemUnitConversion.iucBaseUnitId ?? item.itemBaseUnitId ?? null,
                godown_id: p?.ipmGodownId ?? null,
                godown_name: p?.godown?.gdlName ?? null,
                to_base_factor: (0, module_service_utils_1.toNumber)(p?.itemUnitConversion.iucToBaseFactor ?? 0) || 1,
                cost_price: (0, module_service_utils_1.toNumber)(p?.ipmCostPrice ?? 0),
                cost_wot: (0, module_service_utils_1.toNumber)(p?.ipmCostWot ?? 0),
                mrp: (0, module_service_utils_1.toNumber)(p?.ipmMaxPrice ?? 0),
                min_price: (0, module_service_utils_1.toNumber)(p?.ipmMinPrice ?? 0),
                sales_price_a: (0, module_service_utils_1.toNumber)(p?.ipmSalesPriceA ?? 0),
                sales_price_b: (0, module_service_utils_1.toNumber)(p?.ipmSalesPriceB ?? 0),
                sales_price_c: (0, module_service_utils_1.toNumber)(p?.ipmSalesPriceC ?? 0),
                sales_price_d: (0, module_service_utils_1.toNumber)(p?.ipmSalesPriceD ?? 0),
                price_a_wot: (0, module_service_utils_1.toNumber)(p?.ipmPriceAWot ?? 0),
                price_b_wot: (0, module_service_utils_1.toNumber)(p?.ipmPriceBWot ?? 0),
                price_c_wot: (0, module_service_utils_1.toNumber)(p?.ipmPriceCWot ?? 0),
                price_d_wot: (0, module_service_utils_1.toNumber)(p?.ipmPriceDWot ?? 0),
                price_a_markup: (0, module_service_utils_1.toNumber)(p?.ipmPriceAMarkupPerc ?? 0),
                price_b_markup: (0, module_service_utils_1.toNumber)(p?.ipmPriceBMarkupPerc ?? 0),
                price_c_markup: (0, module_service_utils_1.toNumber)(p?.ipmPriceCMarkupPerc ?? 0),
                price_d_markup: (0, module_service_utils_1.toNumber)(p?.ipmPriceDMarkupPerc ?? 0),
                profit_type: p?.ipmProfitType ?? null,
                round_off: (0, module_service_utils_1.toNumber)(p?.ipmRoundOff ?? 0),
                tax_id: item.itemDefaultTaxId ?? null,
                tax_name: tax?.taxName ?? null,
                tax_perc: (0, module_service_utils_1.toNumber)(tax?.taxGstRateTotal ?? 0),
                cess_type: tax?.taxCessType ?? 'NONE',
                cess_perc: (0, module_service_utils_1.toNumber)(tax?.taxCessPerc ?? 0),
                cess_per_unit: (0, module_service_utils_1.toNumber)(tax?.taxCessUnit ?? 0),
                tracking_type: trackingType,
            };
        });
    }
    async toggleDelete(itemId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.itemMaster.findFirst({
                where: {
                    itemId,
                },
            });
            if (!existing) {
                (0, module_service_utils_2.throwInventoryNotFound)('Item not found', 'item_id', `No item found with id ${itemId}`);
            }
            const wasDeleted = existing.itemIsDeleted;
            const nextDeleted = !wasDeleted;
            const modifiedOn = new Date();
            const modifiedBy = this.requestContextService.getUserId() ?? module_service_utils_2.DEFAULT_ACTOR;
            const result = await tx.itemMaster.updateMany({
                where: {
                    itemId,
                    itemIsDeleted: wasDeleted,
                },
                data: {
                    itemIsDeleted: nextDeleted,
                    itemModifiedOn: modifiedOn,
                    itemModifiedBy: modifiedBy,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_2.throwInventoryNotFound)('Item not found', 'item_id', `No item found with id ${itemId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                itemIsDeleted: nextDeleted,
                itemModifiedOn: modifiedOn,
                itemModifiedBy: modifiedBy,
            });
            await this.auditLogService.logEntityChange({
                action: nextDeleted ? 'cancel' : 'update',
                tableName: ITEM_TABLE_NAME,
                screenName: ITEM_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: itemId,
                displayName: existing.itemNameEn,
                originalRecord,
                modifiedRecord,
                userId: modifiedBy,
                notes: nextDeleted ? 'Item soft deleted' : 'Item restored',
            }, tx);
            return {
                item_id: itemId,
                deleted: nextDeleted,
            };
        });
    }
    async toggleDeleteComposite(itemId) {
        const item = await this.toggleDelete(itemId);
        const wasDeleted = !item.deleted;
        const [unitConversionIds, priceIds, eanCodeIds, reorderIds] = await Promise.all([
            this.itemUnitConversionService.findIdsByItemId(itemId, wasDeleted),
            this.itemsPriceMasterService.findIdsByItemId(itemId, wasDeleted),
            this.itemsEanCodeMasterService.findIdsByItemId(itemId, wasDeleted),
            this.itemsReorderMasterService.findIdsByItemId(itemId, wasDeleted),
        ]);
        const [unit_conversions, prices, ean_codes, reorders] = await Promise.all([
            unitConversionIds.length
                ? this.itemUnitConversionService.toggleDelete(unitConversionIds)
                : [],
            priceIds.length ? this.itemsPriceMasterService.toggleDelete(priceIds) : [],
            eanCodeIds.length ? this.itemsEanCodeMasterService.toggleDelete(eanCodeIds) : [],
            reorderIds.length ? this.itemsReorderMasterService.toggleDelete(reorderIds) : [],
        ]);
        return { item, unit_conversions, prices, ean_codes, reorders };
    }
    async createItem(saveItemDto, tx) {
        const itemNameEn = saveItemDto.item_name_en?.trim();
        if (!itemNameEn) {
            (0, module_service_utils_2.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'item_name_en',
                    message: 'item_name_en is required',
                },
            ]);
        }
        const companyId = saveItemDto.item_company_id ?? null;
        const now = new Date();
        const createdBy = (0, module_service_utils_2.resolveActor)(saveItemDto.item_created_by, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_2.resolveActor)(saveItemDto.item_modified_by, createdBy);
        const data = {
            itemCompanyId: companyId,
            itemNameEn,
            itemGroupId: saveItemDto.item_group_id,
            itemBaseUnitId: saveItemDto.item_base_unit_id ?? null,
            itemPackingItemIds: saveItemDto.item_packing_item_ids ?? [],
            itemCreatedOn: now,
            itemCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemDto);
        const create = async (client) => {
            const created = await client.itemMaster.create({ data });
            await this.stockTrackPolicyService.syncFromItem(created, client);
            const payload = this.toPayload(created);
            await this.auditLogService.logEntityChange({
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
            }, client);
            return payload;
        };
        try {
            return tx ? await create(tx) : await this.prisma.$transaction(create);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItem(saveItemDto, tx) {
        const itemId = saveItemDto.item_id;
        const itemNameEn = saveItemDto.item_name_en?.trim();
        if (!itemNameEn) {
            (0, module_service_utils_2.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'item_name_en',
                    message: 'item_name_en cannot be empty',
                },
            ]);
        }
        const companyId = saveItemDto.item_company_id ?? null;
        const update = async (client) => {
            const existing = await client.itemMaster.findFirst({
                where: {
                    itemId,
                    itemIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_2.throwInventoryNotFound)('Item not found', 'item_id', `No active item found with id ${itemId}`);
            }
            const data = {
                itemCompanyId: companyId,
                itemNameEn,
                itemGroupId: saveItemDto.item_group_id,
                itemBaseUnitId: saveItemDto.item_base_unit_id ?? null,
                itemModifiedOn: new Date(),
                itemModifiedBy: (0, module_service_utils_2.resolveActor)(saveItemDto.item_modified_by, this.requestContextService.getUserId()),
            };
            this.applyOptionalFields(data, saveItemDto);
            const updated = await client.itemMaster.update({
                where: {
                    itemId,
                },
                data,
            });
            await this.stockTrackPolicyService.syncFromItem(updated, client);
            const payload = this.toPayload(updated);
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: ITEM_TABLE_NAME,
                screenName: ITEM_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: itemId,
                displayName: payload.item_name_en,
                originalRecord: this.toPayload(existing),
                modifiedRecord: payload,
                userId: payload.item_modified_by ?? this.requestContextService.getUserId() ?? module_service_utils_2.DEFAULT_ACTOR,
                notes: 'Item updated',
            }, client);
            return payload;
        };
        try {
            return tx ? await update(tx) : await this.prisma.$transaction(update);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    applyOptionalFields(data, saveItemDto) {
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_branch_id')) {
            data.itemBranchId = saveItemDto.item_branch_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_code')) {
            data.itemCode = saveItemDto.item_code;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_sku')) {
            data.itemSku = saveItemDto.item_sku;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_name_ta')) {
            data.itemNameTa = saveItemDto.item_name_ta;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_alias')) {
            data.itemAlias = saveItemDto.item_alias;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_stock_type')) {
            data.itemStockType = saveItemDto.item_stock_type;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_default_barcode')) {
            data.itemDefaultBarcode = saveItemDto.item_default_barcode;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_category_id')) {
            data.itemCategoryId = saveItemDto.item_category_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_brand_id')) {
            data.itemBrandId = saveItemDto.item_brand_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_section_id')) {
            data.itemSectionId = saveItemDto.item_section_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_company_category_id')) {
            data.itemCompanyCategoryId = saveItemDto.item_company_category_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_mfgr_id')) {
            data.itemMfgrId = saveItemDto.item_mfgr_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_supplier_id')) {
            data.itemSupplierId = saveItemDto.item_supplier_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_cust_group')) {
            data.itemCustGroup = saveItemDto.item_cust_group;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_is_service')) {
            data.itemIsService = saveItemDto.item_is_service;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_is_batch_based')) {
            data.itemIsBatchBased = saveItemDto.item_is_batch_based;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_is_expiry_item')) {
            data.itemIsExpiryItem = saveItemDto.item_is_expiry_item;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_expiry_days')) {
            data.itemExpiryDays = saveItemDto.item_expiry_days;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_intimate_before_days')) {
            data.itemIntimateBeforeDays = saveItemDto.item_intimate_before_days;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_sales')) {
            data.itemAllowSales = saveItemDto.item_allow_sales;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_sales_return')) {
            data.itemAllowSalesReturn = saveItemDto.item_allow_sales_return;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_purchase')) {
            data.itemAllowPurchase = saveItemDto.item_allow_purchase;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_po')) {
            data.itemAllowPo = saveItemDto.item_allow_po;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_so')) {
            data.itemAllowSo = saveItemDto.item_allow_so;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_neg_stock')) {
            data.itemAllowNegStock = saveItemDto.item_allow_neg_stock;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_negative_so')) {
            data.itemAllowNegativeSo = saveItemDto.item_allow_negative_so;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_price_list')) {
            data.itemPriceList = saveItemDto.item_price_list;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_weigh_scale')) {
            data.itemWeighScale = saveItemDto.item_weigh_scale;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_retail_item')) {
            data.itemRetailItem = saveItemDto.item_retail_item;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_is_kit')) {
            data.itemIsKit = saveItemDto.item_is_kit;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_auto_break')) {
            data.itemAutoBreak = saveItemDto.item_auto_break;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_auto_make')) {
            data.itemAutoMake = saveItemDto.item_auto_make;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_loyalty')) {
            data.itemAllowLoyalty = saveItemDto.item_allow_loyalty;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_promo')) {
            data.itemAllowPromo = saveItemDto.item_allow_promo;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_has_offer')) {
            data.itemHasOffer = saveItemDto.item_has_offer;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_damagable_product')) {
            data.itemDamagableProduct = saveItemDto.item_damagable_product;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_is_demand')) {
            data.itemIsDemand = saveItemDto.item_is_demand;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_loading')) {
            data.itemAllowLoading = saveItemDto.item_allow_loading;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_allow_freight')) {
            data.itemAllowFreight = saveItemDto.item_allow_freight;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_random_stock')) {
            data.itemRandomStock = saveItemDto.item_random_stock;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_barcode_sticker')) {
            data.itemBarcodeSticker = saveItemDto.item_barcode_sticker;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_barcode_sticker_id')) {
            data.itemBarcodeStickerId = saveItemDto.item_barcode_sticker_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_default_tax_id')) {
            data.itemDefaultTaxId = saveItemDto.item_default_tax_id;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_hsn_code')) {
            data.itemHsnCode = saveItemDto.item_hsn_code;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_batch_config')) {
            data.itemBatchConfig = saveItemDto.item_batch_config;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_sort_order')) {
            data.itemSortOrder = saveItemDto.item_sort_order;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_photo')) {
            data.itemPhoto = this.decodePhoto(saveItemDto.item_photo);
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_image_url')) {
            data.itemImageUrl = saveItemDto.item_image_url;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_notes')) {
            data.itemNotes = saveItemDto.item_notes;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_storage_location')) {
            data.itemStorageLocation = saveItemDto.item_storage_location;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_packing_item_ids')) {
            data.itemPackingItemIds = saveItemDto.item_packing_item_ids ?? [];
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_incl_tax')) {
            data.itemInclTax = saveItemDto.item_incl_tax;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_is_active')) {
            data.itemIsActive = saveItemDto.item_is_active;
        }
    }
    decodePhoto(value) {
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
            (0, module_service_utils_2.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'item_photo',
                    message: 'item_photo must be a valid base64 string',
                },
            ]);
        }
        const bytes = Uint8Array.from(Buffer.from(normalized, 'base64'));
        return bytes;
    }
    toPayload(record) {
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
            item_incl_tax: record.itemInclTax,
            item_is_active: record.itemIsActive,
            item_is_deleted: record.itemIsDeleted,
            item_created_on: record.itemCreatedOn.toISOString(),
            item_created_by: record.itemCreatedBy,
            item_modified_on: record.itemModifiedOn.toISOString(),
            item_modified_by: record.itemModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_2.throwOnUniqueConstraintError)(error, 'Item already exists', [
            { field: 'item_name_en', message: 'Duplicate item_name_en is not allowed' },
        ]);
        if ((0, module_service_utils_2.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_2.throwInventoryBadRequest)('Invalid relation reference', [
                { field: 'item_group_id', message: 'Referenced relation does not exist' },
            ]);
        }
    }
};
exports.ItemsMasterService = ItemsMasterService;
exports.ItemsMasterService = ItemsMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        item_unit_conversion_service_1.ItemUnitConversionService,
        items_price_master_service_1.ItemsPriceMasterService,
        items_ean_code_master_service_1.ItemsEanCodeMasterService,
        items_reorder_master_service_1.ItemsReorderMasterService,
        item_master_update_service_1.ItemMasterUpdateService,
        stock_track_policy_service_1.StockTrackPolicyService])
], ItemsMasterService);
//# sourceMappingURL=items-master.service.js.map