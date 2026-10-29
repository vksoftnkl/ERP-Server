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
const item_error_codes_1 = require("./types/item-error-codes");
const item_unit_conversion_service_1 = require("../item-unit-conversion/item-unit-conversion.service");
const items_price_master_service_1 = require("../items-price-master/items-price-master.service");
const items_ean_code_master_service_1 = require("../items-ean-code-master/items-ean-code-master.service");
const items_reorder_master_service_1 = require("../items-reorder-master/items-reorder-master.service");
const item_master_update_service_1 = require("./item-master-update.service");
const stock_track_policy_service_1 = require("../../stocks/stock-track-policy/stock-track-policy.service");
const master_tree_helper_1 = require("../utils/master-tree.helper");
const item_base_unit_helper_1 = require("../utils/item-base-unit.helper");
const price_bucket_service_1 = require("../items-price-master/price-bucket.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_2 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_TABLE_NAME = 'item master';
const ITEM_AUDIT_SCREEN_NAME = 'Item Master';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const ITEM_HSN_MAX_LENGTH = 10;
const COMPOSITE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
const TRACK_PRESET_INCLUDE = {
    trackPreset: { select: { sptName: true } },
};
const ITEM_FOREIGN_KEYS = {
    item_master_item_group_id_fkey: {
        field: 'item_group_id',
        what: 'item group',
        code: item_error_codes_1.ItemErrorCode.UNKNOWN_GROUP,
    },
    item_master_item_default_tax_id_fkey: {
        field: 'item_default_tax_id',
        what: 'tax rate (tax_rate_master)',
        code: item_error_codes_1.ItemErrorCode.UNKNOWN_TAX_RATE,
    },
    item_master_item_base_unit_id_fkey: {
        field: 'item_base_unit_id',
        what: 'unit',
        code: item_error_codes_1.ItemErrorCode.UNKNOWN_UNIT,
    },
    item_master_item_category_id_fkey: {
        field: 'item_category_id',
        what: 'item category',
        code: item_error_codes_1.ItemErrorCode.UNKNOWN_CATEGORY,
    },
    item_master_item_company_id_fkey: {
        field: 'item_company_id',
        what: 'company',
        code: item_error_codes_1.ItemErrorCode.UNKNOWN_COMPANY,
    },
    fk_item_track_preset: {
        field: 'item_track_preset_id',
        what: 'stock track preset',
        code: item_error_codes_1.ItemErrorCode.UNKNOWN_TRACK_PRESET,
    },
};
const ITEM_DELETE_REFERENCES = [
    {
        table: 'stock.stock_balance',
        column: 'sbl_item_id',
        live: 'sbl_is_deleted = false AND (sbl_on_hand_qty <> 0 OR sbl_transit_in_qty <> 0)',
        label: 'stock holdings with quantity on hand or in transit',
    },
    {
        table: 'sales.sale_order_item',
        column: 'soi_item_id',
        live: "soi_is_deleted = false AND soi_line_status IN ('PENDING', 'PARTIAL') AND EXISTS (" +
            'SELECT 1 FROM sales.sale_order o WHERE o.so_id = soi_order_id AND o.so_is_deleted = false ' +
            "AND o.so_status IN ('DRAFT', 'CONFIRMED', 'PARTIAL'))",
        label: 'open sale order lines',
    },
    {
        table: 'sales.sale_quotation_item',
        column: 'sqi_item_id',
        live: 'sqi_is_deleted = false AND EXISTS (' +
            'SELECT 1 FROM sales.sale_quotation q WHERE q.sq_id = sqi_quote_id AND q.sq_is_deleted = false ' +
            "AND q.sq_status IN ('DRAFT', 'SENT', 'ACCEPTED'))",
        label: 'open quotation lines',
    },
    {
        table: 'sales.promotion_scheme_item',
        column: 'pri_item_id',
        live: 'pri_is_deleted = false AND EXISTS (' +
            'SELECT 1 FROM sales.promotion_scheme p WHERE p.prm_id = pri_prm_id AND p.prm_is_deleted = false ' +
            "AND p.prm_status <> 'CLOSED')",
        label: 'promotion scheme items',
    },
    {
        table: 'sales.promotion_scheme_slab',
        column: 'prs_free_item_id',
        live: 'prs_is_deleted = false AND EXISTS (' +
            'SELECT 1 FROM sales.promotion_scheme p WHERE p.prm_id = prs_prm_id AND p.prm_is_deleted = false ' +
            "AND p.prm_status <> 'CLOSED')",
        label: 'promotion free-item slabs',
    },
    {
        table: 'sales.loyalty_scheme_slab',
        column: 'lss_item_id',
        live: 'lss_is_deleted = false AND EXISTS (' +
            'SELECT 1 FROM sales.loyalty_scheme l WHERE l.lsc_id = lss_lsc_id AND l.lsc_is_deleted = false ' +
            "AND l.lsc_status <> 'CLOSED')",
        label: 'loyalty scheme slabs',
    },
    {
        table: 'sales.loyalty_scheme_gift',
        column: 'lsg_item_id',
        live: 'lsg_is_deleted = false AND EXISTS (' +
            'SELECT 1 FROM sales.loyalty_scheme l WHERE l.lsc_id = lsg_lsc_id AND l.lsc_is_deleted = false ' +
            "AND l.lsc_status <> 'CLOSED')",
        label: 'loyalty gifts',
    },
];
const SAVE_CLASH_CODES = {
    item_name_en: item_error_codes_1.ItemErrorCode.NAME_TAKEN,
    item_code: item_error_codes_1.ItemErrorCode.CODE_TAKEN,
    item_sku: item_error_codes_1.ItemErrorCode.SKU_TAKEN,
    item_default_barcode: item_error_codes_1.ItemErrorCode.BARCODE_TAKEN,
};
const RESTORE_CLASH_CODES = {
    item_name_en: item_error_codes_1.ItemErrorCode.RESTORE_NAME_TAKEN,
    item_code: item_error_codes_1.ItemErrorCode.RESTORE_CODE_TAKEN,
    item_sku: item_error_codes_1.ItemErrorCode.RESTORE_SKU_TAKEN,
    item_default_barcode: item_error_codes_1.ItemErrorCode.BARCODE_TAKEN,
};
const UNIQUE_LOCK_NAMESPACE = 'inventory.item_master.unique';
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
    priceBucketService;
    constructor(prisma, auditLogService, requestContextService, itemUnitConversionService, itemsPriceMasterService, itemsEanCodeMasterService, itemsReorderMasterService, itemMasterUpdateService, stockTrackPolicyService, priceBucketService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.itemUnitConversionService = itemUnitConversionService;
        this.itemsPriceMasterService = itemsPriceMasterService;
        this.itemsEanCodeMasterService = itemsEanCodeMasterService;
        this.itemsReorderMasterService = itemsReorderMasterService;
        this.itemMasterUpdateService = itemMasterUpdateService;
        this.stockTrackPolicyService = stockTrackPolicyService;
        this.priceBucketService = priceBucketService;
    }
    async save(saveItemDto, tx) {
        if (saveItemDto.item_id) {
            return (await this.updateItem(saveItemDto, tx)).payload;
        }
        return this.createItem(saveItemDto, tx);
    }
    async saveComposite(dto) {
        return this.prisma.$transaction(async (tx) => {
            const saved = dto.item_id
                ? await this.updateItem(dto, tx, { childrenFollow: true })
                : { payload: await this.createItem(dto, tx), before: null };
            const itemId = saved.payload.item_id;
            const children = await this.itemMasterUpdateService.syncChildren(itemId, dto, tx);
            if (await this.priceBucketService.rekeyItem(tx, itemId)) {
                children.prices = await this.itemsPriceMasterService.findByItemId(itemId, tx);
            }
            const scheduled_prices = await this.itemsPriceMasterService.findScheduledByItemId(itemId, tx);
            if (saved.before) {
                await this.assertCompanyMove(tx, saved.before, saved.payload.item_company_id);
            }
            const item = await this.alignBaseUnit(tx, saved.payload, dto, children.unit_conversions);
            return { item, ...children, scheduled_prices };
        }, COMPOSITE_TRANSACTION_OPTIONS);
    }
    async getById(itemId) {
        const record = await this.prisma.itemMaster.findFirst({
            where: {
                itemId,
                itemIsDeleted: false,
            },
            include: TRACK_PRESET_INCLUDE,
        });
        if (!record) {
            (0, module_service_utils_2.throwInventoryNotFound)('Item not found', 'item_id', `No active item found with id ${itemId}`, item_error_codes_1.ItemErrorCode.NOT_FOUND);
        }
        return this.toPayload(record);
    }
    async getComposite(itemId) {
        const item = await this.getById(itemId);
        const [unit_conversions, prices, scheduled_prices, ean_codes, reorders] = await Promise.all([
            this.itemUnitConversionService.findByItemId(itemId),
            this.itemsPriceMasterService.findByItemId(itemId),
            this.itemsPriceMasterService.findScheduledByItemId(itemId),
            this.itemsEanCodeMasterService.findByItemId(itemId),
            this.itemsReorderMasterService.findByItemId(itemId),
        ]);
        return this.resolveCompositeNames({
            item,
            unit_conversions,
            prices,
            scheduled_prices,
            ean_codes,
            reorders,
        });
    }
    async resolveCompositeNames(composite) {
        const { item, unit_conversions, ean_codes, reorders } = composite;
        const prices = [...composite.prices, ...composite.scheduled_prices];
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
        const [companies, branches, units, godowns, groups, categories, brands, sections, suppliers, custGroups, taxes,] = await Promise.all([
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
                ? this.prisma.taxRateMaster.findMany({
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
        const namePrice = (r) => {
            const unitId = conversionUnitId(r.ipm_uc_unit_id);
            return {
                ...r,
                ipm_company_name: nameOf(companyName, r.ipm_company_id),
                ipm_branch_name: nameOf(branchName, r.ipm_branch_id),
                ipm_uc_unit_id: unitId ?? r.ipm_uc_unit_id,
                ipm_unit_name: nameOf(unitName, unitId),
                ipm_godown_name: nameOf(godownName, r.ipm_godown_id),
            };
        };
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
            prices: composite.prices.map(namePrice),
            scheduled_prices: composite.scheduled_prices.map(namePrice),
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
        const scope = [];
        if (params.itemCompanyId) {
            scope.push({ OR: [{ itemCompanyId: params.itemCompanyId }, { itemCompanyId: null }] });
        }
        if (params.itemBranchId) {
            scope.push({ OR: [{ itemBranchId: params.itemBranchId }, { itemBranchId: null }] });
        }
        const where = {
            itemIsDeleted: false,
            itemIsActive: true,
            ...(scope.length ? { AND: scope } : {}),
            ...(params.itemGroupId ? { itemGroupId: params.itemGroupId } : {}),
            ...(params.itemBrandId ? { itemBrandId: params.itemBrandId } : {}),
            ...(params.itemSectionId ? { itemSectionId: params.itemSectionId } : {}),
            ...(params.itemCategoryId ? { itemCategoryId: params.itemCategoryId } : {}),
        };
        const items = await this.prisma.itemMaster.findMany({
            where,
            include: {
                prices: {
                    where: { ipmIsDeleted: false, ipmBucketMrp: null, ipmBucketSp: null },
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
            ? await this.prisma.taxRateMaster.findMany({
                where: { taxId: { in: taxIds }, taxIsDeleted: false },
            })
            : [];
        const taxById = new Map(taxRecords.map((t) => [t.taxId, t]));
        return items.map((item) => {
            const p = (params.godownId
                ? item.prices.find((r) => r.ipmGodownId === params.godownId)
                : undefined) ??
                item.prices.find((r) => r.itemUnitConversion.iucIsDefaultUnit) ??
                item.prices[0] ??
                null;
            const tax = item.itemDefaultTaxId ? (taxById.get(item.itemDefaultTaxId) ?? null) : null;
            const trackingType = item.itemBatchConfig === 1
                ? 'MRP'
                : item.itemBatchConfig === 2 || item.itemIsBatchBased || item.itemIsExpiryItem
                    ? 'BATCH'
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
                tax_perc: (0, module_service_utils_1.toNumber)(tax?.taxRatePerc ?? 0),
                cess_type: tax?.taxCessBasis ?? 'NONE',
                cess_perc: (0, module_service_utils_1.toNumber)(tax?.taxCessPerc ?? 0),
                cess_per_unit: (0, module_service_utils_1.toNumber)(tax?.taxCessPerUnit ?? 0),
                tracking_type: trackingType,
            };
        });
    }
    async softDeleteComposite(itemId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.findItemForDeleteState(tx, itemId);
            if (existing.itemIsDeleted) {
                (0, module_service_utils_2.throwInventoryConflict)('Item is already deleted', [
                    {
                        field: 'item_id',
                        code: item_error_codes_1.ItemErrorCode.ALREADY_DELETED,
                        message: `${existing.itemNameEn} is already deleted. POST /items/restore brings it back.`,
                    },
                ]);
            }
            await (0, master_tree_helper_1.assertNoLiveReferences)(tx, ITEM_DELETE_REFERENCES, itemId, {
                label: 'item',
                idField: 'item_id',
                inUseCode: item_error_codes_1.ItemErrorCode.IN_USE,
            });
            const packers = await tx.itemMaster.findMany({
                where: { itemIsDeleted: false, itemPackingItemIds: { has: itemId } },
                select: { itemNameEn: true },
                take: 5,
            });
            if (packers.length) {
                (0, module_service_utils_2.throwInventoryConflict)('This item is still in use', [
                    {
                        field: 'item_id',
                        code: item_error_codes_1.ItemErrorCode.IN_USE,
                        message: `Packed into ${packers.map((row) => row.itemNameEn).join(', ')}. ` +
                            'Take it out of their packing lists first.',
                    },
                ]);
            }
            const item = await this.setItemDeleted(tx, existing, true);
            const [unitConversionIds, priceIds, eanCodeIds, reorderIds] = await Promise.all([
                tx.itemUnitConversion
                    .findMany({ where: { iucItemId: itemId, iucIsDeleted: false }, select: { iucId: true } })
                    .then((rows) => rows.map((row) => row.iucId)),
                tx.itemPriceMaster
                    .findMany({ where: { ipmItemId: itemId, ipmIsDeleted: false }, select: { ipmId: true } })
                    .then((rows) => rows.map((row) => row.ipmId)),
                tx.itemEanCode
                    .findMany({ where: { eanItemId: itemId, eanIsDeleted: false }, select: { eanId: true } })
                    .then((rows) => rows.map((row) => row.eanId)),
                tx.itemReorder
                    .findMany({ where: { irItemId: itemId, irIsDeleted: false }, select: { irId: true } })
                    .then((rows) => rows.map((row) => row.irId)),
            ]);
            const children = await this.toggleChildren(tx, {
                unitConversionIds,
                priceIds,
                eanCodeIds,
                reorderIds,
            });
            await this.stockTrackPolicyService.retireForItem(itemId, tx);
            return { item, ...children };
        }, COMPOSITE_TRANSACTION_OPTIONS);
    }
    async restoreComposite(itemId) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await this.findItemForDeleteState(tx, itemId);
                if (!existing.itemIsDeleted) {
                    (0, module_service_utils_2.throwInventoryConflict)('Item is not deleted', [
                        {
                            field: 'item_id',
                            code: item_error_codes_1.ItemErrorCode.NOT_DELETED,
                            message: `${existing.itemNameEn} is not deleted; there is nothing to restore.`,
                        },
                    ]);
                }
                await this.assertUniqueKeys(tx, existing.itemId, {
                    companyId: existing.itemCompanyId,
                    name: existing.itemNameEn,
                    code: existing.itemCode,
                    sku: existing.itemSku,
                    barcode: existing.itemDefaultBarcode,
                }, RESTORE_CLASH_CODES);
                const deletedOn = existing.itemModifiedOn;
                const [unitConversionIds, priceIds, eanCodeIds, reorderIds] = await Promise.all([
                    tx.itemUnitConversion
                        .findMany({
                        where: { iucItemId: itemId, iucIsDeleted: true, iucUpdatedOn: { gte: deletedOn } },
                        select: { iucId: true },
                    })
                        .then((rows) => rows.map((row) => row.iucId)),
                    tx.itemPriceMaster
                        .findMany({
                        where: { ipmItemId: itemId, ipmIsDeleted: true, ipmUpdatedOn: { gte: deletedOn } },
                        select: { ipmId: true },
                    })
                        .then((rows) => rows.map((row) => row.ipmId)),
                    tx.itemEanCode
                        .findMany({
                        where: { eanItemId: itemId, eanIsDeleted: true, eanModifiedOn: { gte: deletedOn } },
                        select: { eanId: true },
                    })
                        .then((rows) => rows.map((row) => row.eanId)),
                    tx.itemReorder
                        .findMany({
                        where: { irItemId: itemId, irIsDeleted: true, irModifiedOn: { gte: deletedOn } },
                        select: { irId: true },
                    })
                        .then((rows) => rows.map((row) => row.irId)),
                ]);
                const item = await this.setItemDeleted(tx, existing, false);
                const children = await this.toggleChildren(tx, {
                    unitConversionIds,
                    priceIds,
                    eanCodeIds,
                    reorderIds,
                });
                const restored = await tx.itemMaster.findFirstOrThrow({ where: { itemId } });
                await this.stockTrackPolicyService.syncFromItem(restored, tx);
                await this.priceBucketService.rekeyItem(tx, itemId);
                return { item, ...children };
            }, COMPOSITE_TRANSACTION_OPTIONS);
        }
        catch (error) {
            if ((0, module_service_utils_2.isUniqueConstraintError)(error)) {
                const constraint = (0, module_service_utils_2.violatedConstraintOf)(error) ?? '';
                (0, module_service_utils_2.throwInventoryConflict)('Item cannot be restored', [
                    /item_name/.test(constraint)
                        ? {
                            field: 'item_name_en',
                            code: item_error_codes_1.ItemErrorCode.RESTORE_NAME_TAKEN,
                            message: 'Another live item now has this name. Rename one of them, then restore.',
                        }
                        : /item_code/.test(constraint)
                            ? {
                                field: 'item_code',
                                code: item_error_codes_1.ItemErrorCode.RESTORE_CODE_TAKEN,
                                message: 'Another live item now has this code. Change one of them, then restore.',
                            }
                            : /item_sku/.test(constraint)
                                ? {
                                    field: 'item_sku',
                                    code: item_error_codes_1.ItemErrorCode.RESTORE_SKU_TAKEN,
                                    message: 'Another live item now has this SKU. Change one of them, then restore.',
                                }
                                : /ean_code/.test(constraint)
                                    ? {
                                        field: 'ean_codes',
                                        code: item_error_codes_1.ItemErrorCode.RESTORE_EAN_TAKEN,
                                        message: 'An EAN code of this item now belongs to another live item. Remove it there, then restore.',
                                    }
                                    : {
                                        field: 'item_id',
                                        code: item_error_codes_1.ItemErrorCode.RESTORE_CLASH,
                                        message: 'A row of this item now clashes with a live row elsewhere.',
                                    },
                ]);
            }
            if ((0, module_service_utils_2.isExclusionConstraintError)(error)) {
                (0, module_service_utils_2.throwInventoryConflict)('Item cannot be restored', [
                    {
                        field: 'prices',
                        code: item_error_codes_1.ItemErrorCode.RESTORE_CLASH,
                        message: 'A price row of this item overlaps a live price row of the same company, branch, unit and MRP. Delete one of them, then restore.',
                    },
                ]);
            }
            throw error;
        }
    }
    async findItemForDeleteState(tx, itemId) {
        const existing = await tx.itemMaster.findFirst({ where: { itemId } });
        if (!existing) {
            (0, module_service_utils_2.throwInventoryNotFound)('Item not found', 'item_id', `No item found with id ${itemId}`, item_error_codes_1.ItemErrorCode.NOT_FOUND);
        }
        return existing;
    }
    async setItemDeleted(tx, existing, deleted) {
        const modifiedOn = new Date();
        const modifiedBy = this.requestContextService.getUserId() ?? module_service_utils_2.DEFAULT_ACTOR;
        const result = await tx.itemMaster.updateMany({
            where: { itemId: existing.itemId, itemIsDeleted: !deleted },
            data: { itemIsDeleted: deleted, itemModifiedOn: modifiedOn, itemModifiedBy: modifiedBy },
        });
        if (result.count === 0) {
            (0, module_service_utils_2.throwInventoryConflict)('Item changed', [
                {
                    field: 'item_id',
                    code: item_error_codes_1.ItemErrorCode.CHANGED_CONCURRENTLY,
                    message: 'The item was deleted or restored by someone else just now. Reload it.',
                },
            ]);
        }
        await this.auditLogService.logEntityChange({
            action: deleted ? 'cancel' : 'update',
            tableName: ITEM_TABLE_NAME,
            screenName: ITEM_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: existing.itemId,
            displayName: existing.itemNameEn,
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload({
                ...existing,
                itemIsDeleted: deleted,
                itemModifiedOn: modifiedOn,
                itemModifiedBy: modifiedBy,
            }),
            userId: modifiedBy,
            notes: deleted ? 'Item soft deleted' : 'Item restored',
        }, tx);
        return { item_id: existing.itemId, deleted };
    }
    async toggleChildren(tx, ids) {
        const unit_conversions = ids.unitConversionIds.length
            ? await this.itemUnitConversionService.toggleDelete(ids.unitConversionIds, tx)
            : [];
        const prices = ids.priceIds.length
            ? await this.itemsPriceMasterService.toggleDelete(ids.priceIds, tx)
            : [];
        const ean_codes = ids.eanCodeIds.length
            ? await this.itemsEanCodeMasterService.toggleDelete(ids.eanCodeIds, tx)
            : [];
        const reorders = ids.reorderIds.length
            ? await this.itemsReorderMasterService.toggleDelete(ids.reorderIds, tx)
            : [];
        return { unit_conversions, prices, ean_codes, reorders };
    }
    async createItem(saveItemDto, tx) {
        const itemNameEn = saveItemDto.item_name_en?.trim();
        if (!itemNameEn) {
            (0, module_service_utils_2.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'item_name_en',
                    code: item_error_codes_1.ItemErrorCode.NAME_REQUIRED,
                    message: 'item_name_en is required',
                },
            ]);
        }
        const companyId = saveItemDto.item_company_id ?? null;
        const now = new Date();
        const createdBy = (0, module_service_utils_2.resolveActor)(null, this.requestContextService.getUserId());
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
            await this.assertBranchOfCompany(client, companyId, saveItemDto.item_branch_id ?? null);
            await this.inheritClassDefaults(client, data, saveItemDto);
            await this.assertReferencesLive(client, saveItemDto, null);
            await this.assertUniqueKeys(client, null, {
                companyId,
                name: itemNameEn,
                code: saveItemDto.item_code ?? null,
                sku: saveItemDto.item_sku ?? null,
                barcode: saveItemDto.item_default_barcode ?? null,
            }, SAVE_CLASH_CODES);
            const created = await client.itemMaster.create({ data, include: TRACK_PRESET_INCLUDE });
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
    async assertBranchOfCompany(client, companyId, branchId) {
        if (!branchId) {
            return;
        }
        const refuse = (code, message) => (0, module_service_utils_2.throwInventoryBadRequest)('Validation failed', [
            { field: 'item_branch_id', code, message },
        ]);
        if (!companyId) {
            return refuse(item_error_codes_1.ItemErrorCode.BRANCH_NEEDS_COMPANY, "An item with a branch must name that branch's company: set item_company_id, or clear " +
                'item_branch_id to share the item with every company');
        }
        const branch = await client.branchMaster.findFirst({
            where: { brId: branchId },
            select: { brCompId: true, brName: true },
        });
        if (!branch) {
            return refuse(item_error_codes_1.ItemErrorCode.UNKNOWN_BRANCH, `No branch found with id ${branchId}`);
        }
        if (branch.brCompId !== companyId) {
            return refuse(item_error_codes_1.ItemErrorCode.BRANCH_OTHER_COMPANY, `${branch.brName} belongs to another company, not to item_company_id`);
        }
    }
    async inheritClassDefaults(client, data, dto) {
        const wantsTax = !data.itemDefaultTaxId;
        const wantsHsn = !data.itemHsnCode?.trim();
        const wantsUnit = !data.itemBaseUnitId && !dto.unit_conversions?.length;
        if (!wantsTax && !wantsHsn && !wantsUnit) {
            return;
        }
        const group = await client.itemGroupMaster.findUnique({
            where: { itgId: data.itemGroupId },
            select: { itgDefaultTaxId: true, itgDefaultHsn: true, itgDefaultUomId: true },
        });
        const category = data.itemCategoryId
            ? await client.categoryMaster.findUnique({
                where: { categoryId: data.itemCategoryId },
                select: {
                    categoryDefaultTaxId: true,
                    categoryDefaultHsn: true,
                    categoryDefaultUomId: true,
                },
            })
            : null;
        const taxIds = [group?.itgDefaultTaxId, category?.categoryDefaultTaxId].filter((id) => !!id);
        const unitIds = [group?.itgDefaultUomId, category?.categoryDefaultUomId].filter((id) => !!id);
        if (wantsTax && taxIds.length) {
            const live = await client.taxRateMaster.findMany({
                where: { taxId: { in: taxIds }, taxIsActive: true, taxIsDeleted: false },
                select: { taxId: true },
            });
            const liveIds = new Set(live.map((row) => row.taxId));
            const taxId = taxIds.find((id) => liveIds.has(id));
            if (taxId)
                data.itemDefaultTaxId = taxId;
        }
        if (wantsHsn) {
            const hsn = [group?.itgDefaultHsn, category?.categoryDefaultHsn]
                .map((code) => code?.trim())
                .find((code) => !!code && code.length <= ITEM_HSN_MAX_LENGTH);
            if (hsn)
                data.itemHsnCode = hsn;
        }
        if (wantsUnit && unitIds.length) {
            const live = await client.unit.findMany({
                where: { unit_id: { in: unitIds }, unit_is_active: true, unit_is_deleted: false },
                select: { unit_id: true },
            });
            const liveIds = new Set(live.map((row) => row.unit_id));
            const unitId = unitIds.find((id) => liveIds.has(id));
            if (unitId)
                data.itemBaseUnitId = unitId;
        }
    }
    async updateItem(saveItemDto, tx, options = { childrenFollow: false }) {
        const itemId = saveItemDto.item_id;
        const itemNameEn = saveItemDto.item_name_en?.trim();
        if (!itemNameEn) {
            (0, module_service_utils_2.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'item_name_en',
                    code: item_error_codes_1.ItemErrorCode.NAME_REQUIRED,
                    message: 'item_name_en cannot be empty',
                },
            ]);
        }
        const update = async (client) => {
            const existing = await client.itemMaster.findFirst({
                where: {
                    itemId,
                    itemIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_2.throwInventoryNotFound)('Item not found', 'item_id', `No active item found with id ${itemId}`, item_error_codes_1.ItemErrorCode.NOT_FOUND);
            }
            const data = {
                itemNameEn,
                itemGroupId: saveItemDto.item_group_id,
                itemModifiedOn: new Date(),
                itemModifiedBy: (0, module_service_utils_2.resolveActor)(null, this.requestContextService.getUserId()),
            };
            if (saveItemDto.item_company_id !== undefined) {
                data.itemCompanyId = saveItemDto.item_company_id ?? null;
            }
            if (saveItemDto.item_company_id !== undefined || saveItemDto.item_branch_id !== undefined) {
                await this.assertBranchOfCompany(client, saveItemDto.item_company_id !== undefined
                    ? (saveItemDto.item_company_id ?? null)
                    : existing.itemCompanyId, saveItemDto.item_branch_id !== undefined
                    ? (saveItemDto.item_branch_id ?? null)
                    : existing.itemBranchId);
            }
            const base = (await this.itemUnitConversionService.findByItemId(itemId, client)).find((row) => row.iuc_is_base_unit);
            if (base) {
                const sent = saveItemDto.item_base_unit_id;
                if (sent && sent !== base.iuc_unit_id) {
                    (0, item_base_unit_helper_1.refuseBaseUnitChange)(item_error_codes_1.ItemErrorCode.BASE_UNIT_LOCKED, 'item_base_unit_id', `item_base_unit_id stays ${base.iuc_unit_id}, the unit of the item's base row.`);
                }
                data.itemBaseUnitId = base.iuc_unit_id;
            }
            else if (saveItemDto.item_base_unit_id !== undefined) {
                data.itemBaseUnitId = saveItemDto.item_base_unit_id ?? null;
            }
            this.applyOptionalFields(data, saveItemDto);
            await this.assertReferencesLive(client, saveItemDto, existing);
            const after = (sent, stored) => (sent !== undefined ? sent : stored);
            await this.assertUniqueKeys(client, itemId, this.changedUniqueKeys(existing, {
                companyId: after(saveItemDto.item_company_id, existing.itemCompanyId),
                name: itemNameEn,
                code: after(saveItemDto.item_code, existing.itemCode),
                sku: after(saveItemDto.item_sku, existing.itemSku),
                barcode: after(saveItemDto.item_default_barcode, existing.itemDefaultBarcode),
            }), SAVE_CLASH_CODES);
            const updated = await client.itemMaster.update({
                where: {
                    itemId,
                },
                data,
                include: TRACK_PRESET_INCLUDE,
            });
            await this.stockTrackPolicyService.syncFromItem(updated, client);
            if (!options.childrenFollow) {
                await this.priceBucketService.rekeyItem(client, itemId);
                await this.assertCompanyMove(client, existing, updated.itemCompanyId);
            }
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
            return { payload, before: existing };
        };
        try {
            return tx ? await update(tx) : await this.prisma.$transaction(update);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    changedUniqueKeys(existing, next) {
        const same = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
        const companyMoved = next.companyId !== existing.itemCompanyId;
        const keep = (value, stored) => companyMoved || !same(value, stored) ? value : null;
        return {
            companyId: next.companyId,
            name: keep(next.name, existing.itemNameEn),
            code: keep(next.code, existing.itemCode),
            sku: keep(next.sku, existing.itemSku),
            barcode: same(next.barcode, existing.itemDefaultBarcode) ? null : next.barcode,
        };
    }
    async assertUniqueKeys(client, selfId, keys, codes) {
        const norm = (value) => value?.trim().toLowerCase() || null;
        const name = norm(keys.name);
        const code = norm(keys.code);
        const sku = norm(keys.sku);
        const barcode = norm(keys.barcode);
        const lockKeys = [
            name && `name:${name}`,
            code && `code:${code}`,
            sku && `sku:${sku}`,
            barcode && `barcode:${barcode}`,
        ]
            .filter((key) => !!key)
            .sort();
        if (!lockKeys.length) {
            return;
        }
        await client.$queryRaw `
      SELECT count(pg_advisory_xact_lock(hashtext(${UNIQUE_LOCK_NAMESPACE}), hashtext(k)))::int AS locked
        FROM unnest(${lockKeys}::text[]) AS k
    `;
        const clashes = await client.$queryRaw `
      WITH peer AS (
        SELECT item_id, item_name_en, item_code, item_sku, item_default_barcode
          FROM inventory.item_master
         WHERE item_is_deleted = false
           AND item_id IS DISTINCT FROM ${selfId}::uuid
           AND (${keys.companyId}::uuid IS NULL OR item_company_id IS NULL
                OR item_company_id = ${keys.companyId}::uuid)
      )
      SELECT 'item_name_en' AS field, item_name_en AS holder FROM peer
       WHERE ${name}::text IS NOT NULL AND lower(item_name_en) = ${name}::text
      UNION ALL
      SELECT 'item_code', item_name_en FROM peer
       WHERE ${code}::text IS NOT NULL AND lower(item_code) = ${code}::text
      UNION ALL
      SELECT 'item_sku', item_name_en FROM peer
       WHERE ${sku}::text IS NOT NULL AND lower(item_sku) = ${sku}::text
      UNION ALL
      SELECT 'item_default_barcode', m.item_name_en
        FROM inventory.item_master m
       WHERE ${barcode}::text IS NOT NULL AND m.item_is_deleted = false
         AND m.item_id IS DISTINCT FROM ${selfId}::uuid
         AND (lower(m.item_default_barcode) = ${barcode}::text
              OR EXISTS (SELECT 1 FROM inventory.item_ean_codes e
                          WHERE e.ean_item_id = m.item_id AND e.ean_is_deleted = false
                            AND upper(e.ean_code) = upper(${barcode}::text)))
    `;
        if (!clashes.length) {
            return;
        }
        const what = {
            item_name_en: 'name',
            item_code: 'code',
            item_sku: 'SKU',
            item_default_barcode: 'barcode',
        };
        (0, module_service_utils_2.throwInventoryConflict)('Item already exists', clashes.map((clash) => ({
            field: clash.field,
            code: codes[clash.field],
            message: clash.field === 'item_default_barcode'
                ? `${clash.holder} already scans with this barcode.`
                : `${clash.holder} already has this ${what[clash.field]} (letters compared in any ` +
                    'case). Names, codes and SKUs are unique within a company, and a shared item ' +
                    "shares them with every company's items.",
        })));
    }
    async assertReferencesLive(client, dto, existing) {
        const checks = [
            {
                field: 'item_group_id',
                value: dto.item_group_id,
                stored: existing?.itemGroupId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_GROUP,
                what: 'item group',
                load: async (id) => {
                    const row = await client.itemGroupMaster.findUnique({
                        where: { itgId: id },
                        select: { itgIsDeleted: true, itgIsActive: true },
                    });
                    return row && { deleted: row.itgIsDeleted, active: row.itgIsActive };
                },
            },
            {
                field: 'item_category_id',
                value: dto.item_category_id,
                stored: existing?.itemCategoryId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_CATEGORY,
                what: 'item category',
                load: async (id) => {
                    const row = await client.categoryMaster.findUnique({
                        where: { categoryId: id },
                        select: { categoryIsDeleted: true, categoryIsActive: true },
                    });
                    return row && { deleted: row.categoryIsDeleted, active: row.categoryIsActive };
                },
            },
            {
                field: 'item_base_unit_id',
                value: dto.item_base_unit_id,
                stored: existing?.itemBaseUnitId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_UNIT,
                what: 'unit',
                load: async (id) => {
                    const row = await client.unit.findUnique({
                        where: { unit_id: id },
                        select: { unit_is_deleted: true, unit_is_active: true },
                    });
                    return row && { deleted: row.unit_is_deleted, active: row.unit_is_active };
                },
            },
            {
                field: 'item_default_tax_id',
                value: dto.item_default_tax_id,
                stored: existing?.itemDefaultTaxId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_TAX_RATE,
                what: 'tax rate',
                load: async (id) => {
                    const row = await client.taxRateMaster.findUnique({
                        where: { taxId: id },
                        select: { taxIsDeleted: true, taxIsActive: true },
                    });
                    return row && { deleted: row.taxIsDeleted, active: row.taxIsActive };
                },
            },
            {
                field: 'item_track_preset_id',
                value: dto.item_track_preset_id,
                stored: existing?.itemTrackPresetId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_TRACK_PRESET,
                what: 'stock track preset',
                load: async (id) => {
                    const row = await client.stockTrackPreset.findUnique({
                        where: { sptId: id },
                        select: { sptIsDeleted: true, sptIsActive: true },
                    });
                    return row && { deleted: row.sptIsDeleted, active: row.sptIsActive };
                },
            },
            {
                field: 'item_brand_id',
                value: dto.item_brand_id,
                stored: existing?.itemBrandId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_BRAND,
                what: 'item brand',
                load: async (id) => {
                    const row = await client.itemBrandMaster.findUnique({
                        where: { brand_id: id },
                        select: { brand_is_deleted: true, brand_is_active: true },
                    });
                    return row && { deleted: row.brand_is_deleted, active: row.brand_is_active };
                },
            },
            {
                field: 'item_section_id',
                value: dto.item_section_id,
                stored: existing?.itemSectionId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_SECTION,
                what: 'item section',
                load: async (id) => {
                    const row = await client.itemSectionMaster.findUnique({
                        where: { secId: id },
                        select: { secIsDeleted: true, secIsActive: true },
                    });
                    return row && { deleted: row.secIsDeleted, active: row.secIsActive };
                },
            },
            {
                field: 'item_supplier_id',
                value: dto.item_supplier_id,
                stored: existing?.itemSupplierId,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_SUPPLIER,
                what: 'supplier',
                load: async (id) => {
                    const row = await client.supplier.findUnique({
                        where: { supId: id },
                        select: { supIsDeleted: true, supIsActive: true },
                    });
                    return row && { deleted: row.supIsDeleted, active: row.supIsActive };
                },
            },
            {
                field: 'item_cust_group',
                value: dto.item_cust_group,
                stored: existing?.itemCustGroup,
                unknown: item_error_codes_1.ItemErrorCode.UNKNOWN_CUST_GROUP,
                what: 'customer group',
                load: async (id) => {
                    const row = await client.custGroup.findUnique({
                        where: { cgrId: id },
                        select: { cgrIsDeleted: true, cgrIsActive: true },
                    });
                    return row && { deleted: row.cgrIsDeleted, active: row.cgrIsActive };
                },
            },
        ];
        for (const check of checks) {
            const id = check.value;
            if (!id || id === check.stored) {
                continue;
            }
            const state = await check.load(id);
            if (!state) {
                (0, module_service_utils_2.throwInventoryBadRequest)('Invalid relation reference', [
                    {
                        field: check.field,
                        code: check.unknown,
                        message: `${check.field} does not name an existing ${check.what}`,
                    },
                ]);
            }
            if (state.deleted || !state.active) {
                (0, module_service_utils_2.throwInventoryBadRequest)('Invalid relation reference', [
                    {
                        field: check.field,
                        code: item_error_codes_1.ItemErrorCode.REFERENCE_RETIRED,
                        message: `The ${check.what} ${id} is ${state.deleted ? 'deleted' : 'inactive'}. Choose a live one.`,
                    },
                ]);
            }
        }
    }
    async assertCompanyMove(client, before, companyId) {
        if (!companyId || companyId === before.itemCompanyId) {
            return;
        }
        const [row] = await client.$queryRaw `
      SELECT
        (SELECT count(*)::int FROM stock.stock_balance b
          WHERE b.sbl_item_id = ${before.itemId}::uuid AND b.sbl_is_deleted = false
            AND (b.sbl_on_hand_qty <> 0 OR b.sbl_transit_in_qty <> 0)
            AND b.sbl_company_id <> ${companyId}::uuid) AS stock_rows,
        (SELECT count(*)::int FROM inventory.item_price_master p
           LEFT JOIN public.branch_master br ON br.br_id = p.ipm_branch_id
          WHERE p.ipm_item_id = ${before.itemId}::uuid AND p.ipm_is_deleted = false
            AND (p.ipm_company_id <> ${companyId}::uuid
                 OR br.br_comp_id <> ${companyId}::uuid)) AS price_rows
    `;
        const parts = [
            row?.stock_rows ? `${row.stock_rows} stock holding(s) with quantity` : null,
            row?.price_rows ? `${row.price_rows} price row(s)` : null,
        ].filter((part) => part !== null);
        if (parts.length) {
            (0, module_service_utils_2.throwInventoryConflict)('The item cannot move to this company', [
                {
                    field: 'item_company_id',
                    code: item_error_codes_1.ItemErrorCode.COMPANY_MOVE_BLOCKED,
                    message: `Another company still holds ${parts.join(' and ')} of this item. ` +
                        'Clear them there first, or keep the item shared.',
                },
            ]);
        }
    }
    async alignBaseUnit(tx, item, dto, syncedConversions) {
        if (dto.item_base_unit_id === undefined && dto.unit_conversions === undefined) {
            return item;
        }
        const conversions = dto.unit_conversions !== undefined
            ? syncedConversions
            : await this.itemUnitConversionService.findByItemId(item.item_id, tx);
        const base = conversions.find((row) => row.iuc_is_base_unit);
        if (!base || base.iuc_unit_id === item.item_base_unit_id) {
            return item;
        }
        if (dto.item_base_unit_id) {
            (0, module_service_utils_2.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'item_base_unit_id',
                    code: item_error_codes_1.ItemErrorCode.BASE_UNIT_MISMATCH,
                    message: `item_base_unit_id must be ${base.iuc_unit_id}, the unit of the item's base unit conversion row.`,
                },
            ]);
        }
        const updated = await tx.itemMaster.update({
            where: { itemId: item.item_id },
            data: { itemBaseUnitId: base.iuc_unit_id },
            include: TRACK_PRESET_INCLUDE,
        });
        return this.toPayload(updated);
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
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_purchase_uom_id')) {
            data.itemPurchaseUomId = saveItemDto.item_purchase_uom_id ?? null;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_min_shelf_life_pct')) {
            data.itemMinShelfLifePct = saveItemDto.item_min_shelf_life_pct ?? null;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_itc_class')) {
            data.itemItcClass = saveItemDto.item_itc_class ?? null;
        }
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_shortage_pct')) {
            data.itemShortagePct = saveItemDto.item_shortage_pct ?? null;
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
        if ((0, module_service_utils_2.hasOwnProperty)(saveItemDto, 'item_track_preset_id')) {
            data.itemTrackPresetId = saveItemDto.item_track_preset_id;
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
        if (saveItemDto.item_packing_item_ids !== undefined) {
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
                    code: item_error_codes_1.ItemErrorCode.PHOTO_INVALID,
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
            item_purchase_uom_id: record.itemPurchaseUomId ?? null,
            item_min_shelf_life_pct: record.itemMinShelfLifePct == null ? null : (0, module_service_utils_1.toNumber)(record.itemMinShelfLifePct),
            item_itc_class: record.itemItcClass ?? null,
            item_shortage_pct: record.itemShortagePct == null ? null : (0, module_service_utils_1.toNumber)(record.itemShortagePct),
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
            item_track_preset_id: record.itemTrackPresetId,
            item_track_preset_name: record.trackPreset?.sptName ?? null,
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
        if ((0, module_service_utils_2.isUniqueConstraintError)(error)) {
            const constraint = (0, module_service_utils_2.violatedConstraintOf)(error) ?? '';
            const [field, code] = /item_name/.test(constraint)
                ? ['item_name_en', item_error_codes_1.ItemErrorCode.NAME_TAKEN]
                : /item_code/.test(constraint)
                    ? ['item_code', item_error_codes_1.ItemErrorCode.CODE_TAKEN]
                    : /item_sku/.test(constraint)
                        ? ['item_sku', item_error_codes_1.ItemErrorCode.SKU_TAKEN]
                        : ['request', item_error_codes_1.ItemErrorCode.DUPLICATE];
            (0, module_service_utils_2.throwInventoryConflict)('Item already exists', [
                {
                    field,
                    code,
                    message: code === item_error_codes_1.ItemErrorCode.DUPLICATE
                        ? 'Another live item already holds one of these values'
                        : `Another live item of this company (or a shared one) already has this ${field}`,
                },
            ]);
        }
        if ((0, module_service_utils_2.isExclusionConstraintError)(error)) {
            (0, module_service_utils_2.throwInventoryConflict)('Stock track policy clash', [
                {
                    field: 'item_track_preset_id',
                    code: item_error_codes_1.ItemErrorCode.TRACK_POLICY_CLASH,
                    message: "The item's stock track policy overlaps another live policy for the same item and scope. Reload the item and save again.",
                },
            ]);
        }
        if ((0, module_service_utils_2.isForeignKeyConstraintError)(error)) {
            const known = ITEM_FOREIGN_KEYS[(0, module_service_utils_2.violatedConstraintOf)(error) ?? ''];
            (0, module_service_utils_2.throwInventoryBadRequest)('Invalid relation reference', [
                known
                    ? {
                        field: known.field,
                        code: known.code,
                        message: `${known.field} does not name an existing ${known.what}`,
                    }
                    : {
                        field: 'request',
                        code: item_error_codes_1.ItemErrorCode.UNKNOWN_REFERENCE,
                        message: 'Referenced relation does not exist',
                    },
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
        stock_track_policy_service_1.StockTrackPolicyService,
        price_bucket_service_1.PriceBucketService])
], ItemsMasterService);
//# sourceMappingURL=items-master.service.js.map