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
exports.ItemsPriceMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const DEFAULT_AUDIT_ACTOR = 'system';
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
let ItemsPriceMasterService = class ItemsPriceMasterService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    constructor(prisma, auditLogService, configuredGridSqlService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
    }
    async save(saveItemPriceDto, tx) {
        const saveItems = Array.isArray(saveItemPriceDto) ? saveItemPriceDto : [saveItemPriceDto];
        const saveAll = async (client) => {
            const savedItems = [];
            for (const saveItem of saveItems) {
                savedItems.push(await this.saveItemPrice(client, saveItem));
            }
            return savedItems;
        };
        try {
            const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
            return Array.isArray(saveItemPriceDto) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async listPrices(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {
            ipmIsDeleted: false,
            ...(queryDto.ipm_item_id !== undefined && { ipmItemId: queryDto.ipm_item_id }),
            ...(queryDto.ipm_company_id !== undefined && { ipmCompanyId: queryDto.ipm_company_id }),
            ...(queryDto.ipm_branch_id !== undefined && { ipmBranchId: queryDto.ipm_branch_id }),
            ...(queryDto.ipm_is_active !== undefined && { ipmIsActive: queryDto.ipm_is_active }),
        };
        return (0, module_list_utils_1.runInventoryListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: ITEM_PRICE_TABLE_NAME,
                alias: 'item_price_grid',
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.itemPriceMaster.count({ where }),
            findManyFn: () => this.prisma.itemPriceMaster.findMany({
                where,
                orderBy: [
                    { ipmItemId: 'asc' },
                    { ipmSlNo: 'asc' },
                    { itemUnitConversion: { iucUnitSlno: 'asc' } },
                    { ipmId: 'asc' },
                ],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
        });
    }
    async getById(ipmId) {
        const record = await this.prisma.itemPriceMaster.findFirst({
            where: {
                ipmId,
                ipmIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item price not found', 'ipm_id', `No item price found with id ${ipmId}`);
        }
        return this.toPayload(record);
    }
    async findByItemId(itemId, client = this.prisma) {
        const records = await client.itemPriceMaster.findMany({
            where: { ipmItemId: itemId, ipmIsDeleted: false },
            orderBy: [
                { ipmSlNo: 'asc' },
                { itemUnitConversion: { iucUnitSlno: 'asc' } },
                { ipmId: 'asc' },
            ],
        });
        return records.map((record) => this.toPayload(record));
    }
    async findIdsByItemId(itemId, isDeleted) {
        const records = await this.prisma.itemPriceMaster.findMany({
            where: { ipmItemId: itemId, ipmIsDeleted: isDeleted },
            select: { ipmId: true },
        });
        return records.map((record) => record.ipmId);
    }
    async toggleDelete(ipmId, tx) {
        const toggleIds = Array.isArray(ipmId) ? ipmId : [ipmId];
        const toggleAll = async (client) => {
            const toggledItems = [];
            for (const toggleId of toggleIds) {
                toggledItems.push(await this.toggleDeleteItemPrice(client, toggleId));
            }
            return toggledItems;
        };
        try {
            const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
            return Array.isArray(ipmId) ? results : results[0];
        }
        catch (error) {
            this.handleDeleteError(error);
            throw error;
        }
    }
    async saveItemPrice(tx, saveItemPriceDto) {
        if (saveItemPriceDto.ipm_id) {
            return this.updateItemPrice(tx, saveItemPriceDto);
        }
        return this.createItemPrice(tx, saveItemPriceDto);
    }
    async toggleDeleteItemPrice(tx, ipmId) {
        const existing = await tx.itemPriceMaster.findFirst({
            where: {
                ipmId,
            },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item price not found', 'ipm_id', `No item price found with id ${ipmId}`);
        }
        const nextDeleted = !existing.ipmIsDeleted;
        const updatedOn = new Date();
        const updated = await tx.itemPriceMaster.update({
            where: {
                ipmId,
            },
            data: {
                ipmIsDeleted: nextDeleted,
                ipmUpdatedOn: updatedOn,
            },
        });
        await this.auditLogService.logEntityChange({
            action: nextDeleted ? 'cancel' : 'update',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ipmId,
            displayName: this.buildDisplayName(existing),
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(updated),
            userId: this.resolveAuditActor(updated.ipmUpdatedBy),
            notes: nextDeleted ? 'Item price soft deleted' : 'Item price restored',
        }, tx);
        return {
            ipm_id: ipmId,
            deleted: nextDeleted,
        };
    }
    async createItemPrice(tx, saveItemPriceDto) {
        const profitType = saveItemPriceDto.ipm_profit_type?.trim();
        if (!profitType) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ipm_profit_type',
                    message: 'ipm_profit_type is required',
                },
            ]);
        }
        const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
        const now = new Date();
        const createdBy = this.resolveRecordActor(saveItemPriceDto.ipm_created_by);
        const updatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by) ?? createdBy;
        const data = {
            ipmItemId: saveItemPriceDto.ipm_item_id,
            ipmUcUnitId: unitConversion.iucId,
            ipmGodownId: saveItemPriceDto.ipm_godown_id ?? null,
            ipmProfitType: profitType,
            ipmUomRemarks: unitConversion.iucUomRemarks,
            ipmCreatedOn: now,
            ipmCreatedBy: createdBy,
            ipmUpdatedOn: now,
            ipmUpdatedBy: updatedBy,
        };
        this.applyOptionalFields(data, saveItemPriceDto);
        const created = await tx.itemPriceMaster.create({
            data,
        });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange({
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
        }, tx);
        return payload;
    }
    async updateItemPrice(tx, saveItemPriceDto) {
        const ipmId = saveItemPriceDto.ipm_id;
        const profitType = saveItemPriceDto.ipm_profit_type?.trim();
        if (!profitType) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
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
            (0, module_service_utils_1.throwInventoryNotFound)('Item price not found', 'ipm_id', `No item price found with id ${ipmId}`);
        }
        const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
        const data = {
            ipmItemId: saveItemPriceDto.ipm_item_id,
            ipmUcUnitId: unitConversion.iucId,
            ipmGodownId: saveItemPriceDto.ipm_godown_id ?? null,
            ipmProfitType: profitType,
            ipmUpdatedOn: new Date(),
        };
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_updated_by')) {
            data.ipmUpdatedBy = this.resolveRecordActor(saveItemPriceDto.ipm_updated_by);
        }
        this.applyOptionalFields(data, saveItemPriceDto);
        const updated = await tx.itemPriceMaster.update({
            where: {
                ipmId,
            },
            data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
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
        }, tx);
        return payload;
    }
    async requireUnitConversion(tx, saveItemPriceDto) {
        const unitConversion = await tx.itemUnitConversion.findFirst({
            where: {
                iucId: saveItemPriceDto.ipm_uc_unit_id,
                iucItemId: saveItemPriceDto.ipm_item_id,
                iucIsDeleted: false,
            },
            select: { iucId: true, iucUomRemarks: true },
        });
        if (!unitConversion) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ipm_uc_unit_id',
                    message: `Unit conversion ${saveItemPriceDto.ipm_uc_unit_id} does not exist for item ${saveItemPriceDto.ipm_item_id}`,
                },
            ]);
        }
        return unitConversion;
    }
    applyOptionalFields(data, saveItemPriceDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_company_id')) {
            data.ipmCompanyId = saveItemPriceDto.ipm_company_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_branch_id')) {
            data.ipmBranchId = saveItemPriceDto.ipm_branch_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sl_no')) {
            data.ipmSlNo = saveItemPriceDto.ipm_sl_no;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_cost_price')) {
            data.ipmCostPrice = saveItemPriceDto.ipm_cost_price;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_cost_wot')) {
            data.ipmCostWot = saveItemPriceDto.ipm_cost_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_a')) {
            data.ipmSalesPriceA = saveItemPriceDto.ipm_sales_price_a;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_b')) {
            data.ipmSalesPriceB = saveItemPriceDto.ipm_sales_price_b;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_c')) {
            data.ipmSalesPriceC = saveItemPriceDto.ipm_sales_price_c;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sales_price_d')) {
            data.ipmSalesPriceD = saveItemPriceDto.ipm_sales_price_d;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_a_wot')) {
            data.ipmPriceAWot = saveItemPriceDto.ipm_price_a_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_b_wot')) {
            data.ipmPriceBWot = saveItemPriceDto.ipm_price_b_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_c_wot')) {
            data.ipmPriceCWot = saveItemPriceDto.ipm_price_c_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_d_wot')) {
            data.ipmPriceDWot = saveItemPriceDto.ipm_price_d_wot;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_a_markup_perc')) {
            data.ipmPriceAMarkupPerc = saveItemPriceDto.ipm_price_a_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_b_markup_perc')) {
            data.ipmPriceBMarkupPerc = saveItemPriceDto.ipm_price_b_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_c_markup_perc')) {
            data.ipmPriceCMarkupPerc = saveItemPriceDto.ipm_price_c_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_price_d_markup_perc')) {
            data.ipmPriceDMarkupPerc = saveItemPriceDto.ipm_price_d_markup_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_max_price')) {
            data.ipmMaxPrice = saveItemPriceDto.ipm_max_price;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_min_price')) {
            data.ipmMinPrice = saveItemPriceDto.ipm_min_price;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_disc_perc')) {
            data.ipmDiscPerc = saveItemPriceDto.ipm_disc_perc;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_disc_qty')) {
            data.ipmDiscQty = saveItemPriceDto.ipm_disc_qty;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_addl_cess')) {
            data.ipmAddlCess = saveItemPriceDto.ipm_addl_cess;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_round_off')) {
            data.ipmRoundOff = saveItemPriceDto.ipm_round_off;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_loading_charge')) {
            data.ipmLoadingCharge = saveItemPriceDto.ipm_loading_charge;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_freight_charge')) {
            data.ipmFreightCharge = saveItemPriceDto.ipm_freight_charge;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_loyalty_points')) {
            data.ipmLoyaltyPoints = saveItemPriceDto.ipm_loyalty_points;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_uom_remarks')) {
            data.ipmUomRemarks = saveItemPriceDto.ipm_uom_remarks;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_cost_remarks')) {
            data.ipmCostRemarks = saveItemPriceDto.ipm_cost_remarks;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_is_active')) {
            data.ipmIsActive = saveItemPriceDto.ipm_is_active;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemPriceDto, 'ipm_sync_date')) {
            data.ipmSyncDate = this.parseOptionalDate(saveItemPriceDto.ipm_sync_date, 'ipm_sync_date');
        }
    }
    parseOptionalDate(value, fieldName) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: fieldName,
                    message: `${fieldName} must be a valid date`,
                },
            ]);
        }
        return parsedDate;
    }
    toPayload(record) {
        return {
            ipm_id: record.ipmId,
            ipm_company_id: record.ipmCompanyId,
            ipm_branch_id: record.ipmBranchId,
            ipm_item_id: record.ipmItemId,
            ipm_uc_unit_id: record.ipmUcUnitId,
            ipm_godown_id: record.ipmGodownId,
            ipm_sl_no: record.ipmSlNo,
            ipm_cost_price: (0, module_service_utils_1.toNumber)(record.ipmCostPrice),
            ipm_cost_wot: (0, module_service_utils_1.toNumber)(record.ipmCostWot),
            ipm_sales_price_a: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceA),
            ipm_sales_price_b: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceB),
            ipm_sales_price_c: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceC),
            ipm_sales_price_d: (0, module_service_utils_1.toNumber)(record.ipmSalesPriceD),
            ipm_price_a_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceAWot),
            ipm_price_b_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceBWot),
            ipm_price_c_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceCWot),
            ipm_price_d_wot: (0, module_service_utils_1.toNumber)(record.ipmPriceDWot),
            ipm_price_a_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceAMarkupPerc),
            ipm_price_b_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceBMarkupPerc),
            ipm_price_c_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceCMarkupPerc),
            ipm_price_d_markup_perc: (0, module_service_utils_1.toNumber)(record.ipmPriceDMarkupPerc),
            ipm_max_price: (0, module_service_utils_1.toNumber)(record.ipmMaxPrice),
            ipm_min_price: (0, module_service_utils_1.toNumber)(record.ipmMinPrice),
            ipm_disc_perc: (0, module_service_utils_1.toNumber)(record.ipmDiscPerc),
            ipm_disc_qty: (0, module_service_utils_1.toNumber)(record.ipmDiscQty),
            ipm_addl_cess: (0, module_service_utils_1.toNumber)(record.ipmAddlCess),
            ipm_profit_type: record.ipmProfitType,
            ipm_round_off: (0, module_service_utils_1.toNumber)(record.ipmRoundOff),
            ipm_loading_charge: (0, module_service_utils_1.toNumber)(record.ipmLoadingCharge),
            ipm_freight_charge: (0, module_service_utils_1.toNumber)(record.ipmFreightCharge),
            ipm_loyalty_points: (0, module_service_utils_1.toNumber)(record.ipmLoyaltyPoints),
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
    buildDisplayName(record) {
        const branchSegment = record.ipmBranchId ?? 'NO_BRANCH';
        const godownSegment = record.ipmGodownId ?? 'ALL_GODOWNS';
        return `${record.ipmItemId}:${record.ipmUcUnitId}:${branchSegment}:${godownSegment}`;
    }
    resolveRecordActor(value) {
        const trimmed = value?.trim();
        return trimmed || null;
    }
    resolveAuditActor(value, fallback = DEFAULT_AUDIT_ACTOR) {
        const trimmed = value?.trim();
        return trimmed || fallback;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item price already exists', [
            { field: 'ipm_item_id', message: 'Duplicate item price configuration is not allowed' },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    message: 'Referenced company, branch, item, unit, base unit, or godown does not exist',
                },
            ]);
        }
    }
    handleDeleteError(error) {
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Cannot delete item price', [
                { field: 'ipm_id', message: 'Item price is referenced by related records' },
            ]);
        }
    }
};
exports.ItemsPriceMasterService = ItemsPriceMasterService;
exports.ItemsPriceMasterService = ItemsPriceMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService])
], ItemsPriceMasterService);
//# sourceMappingURL=items-price-master.service.js.map