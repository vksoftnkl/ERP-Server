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
exports.ItemsQtyPriceMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_QTY_PRICE_TABLE_NAME = 'item qty price';
const ITEM_QTY_PRICE_AUDIT_SCREEN_NAME = 'Item Qty Price Master';
const ITEM_QTY_PRICE_INCLUDE = {
    item: { select: { itemNameEn: true } },
    itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
    priceLevel: { select: { iplName: true } },
    party: { select: { cusName: true } },
};
let ItemsQtyPriceMasterService = class ItemsQtyPriceMasterService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
    }
    async save(saveItemQtyPriceDto, tx) {
        const saveItems = Array.isArray(saveItemQtyPriceDto)
            ? saveItemQtyPriceDto
            : [saveItemQtyPriceDto];
        const saveAll = async (client) => {
            const savedItems = [];
            for (const saveItem of saveItems) {
                savedItems.push(await this.saveItemQtyPrice(client, saveItem));
            }
            return savedItems;
        };
        try {
            const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
            return Array.isArray(saveItemQtyPriceDto) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {
            iqpIsDeleted: false,
            ...(queryDto.iqp_item_id !== undefined && { iqpItemId: queryDto.iqp_item_id }),
            ...(queryDto.iqp_item_unit_id !== undefined && { iqpItemUnitId: queryDto.iqp_item_unit_id }),
            ...(queryDto.iqp_company_id !== undefined && { iqpCompanyId: queryDto.iqp_company_id }),
            ...(queryDto.iqp_branch_id !== undefined && { iqpBranchId: queryDto.iqp_branch_id }),
            ...(queryDto.iqp_party_id !== undefined && { iqpPartyId: queryDto.iqp_party_id }),
            ...(queryDto.iqp_price_level !== undefined && { iqpPriceLevel: queryDto.iqp_price_level }),
            ...(queryDto.iqp_is_active !== undefined && { iqpIsActive: queryDto.iqp_is_active }),
        };
        return (0, module_list_utils_1.runInventoryListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: ITEM_QTY_PRICE_TABLE_NAME,
                alias: 'item_qty_price_grid',
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.itemQtyPrice.count({ where }),
            findManyFn: () => this.prisma.itemQtyPrice.findMany({
                where,
                include: ITEM_QTY_PRICE_INCLUDE,
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
        });
    }
    async getById(iqpId) {
        const record = await this.prisma.itemQtyPrice.findFirst({
            where: { iqpId, iqpIsDeleted: false },
            include: ITEM_QTY_PRICE_INCLUDE,
        });
        if (!record) {
            this.throwNotFound(iqpId);
        }
        return this.toPayload(record);
    }
    async toggleDelete(iqpId, tx) {
        const toggleIds = Array.isArray(iqpId) ? iqpId : [iqpId];
        const toggleAll = async (client) => {
            const toggledItems = [];
            for (const toggleId of toggleIds) {
                toggledItems.push(await this.toggleDeleteItemQtyPrice(client, toggleId));
            }
            return toggledItems;
        };
        const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
        return Array.isArray(iqpId) ? results : results[0];
    }
    async saveItemQtyPrice(tx, saveItemQtyPriceDto) {
        if (saveItemQtyPriceDto.iqp_id) {
            return this.updateItemQtyPrice(tx, saveItemQtyPriceDto);
        }
        return this.createItemQtyPrice(tx, saveItemQtyPriceDto);
    }
    async toggleDeleteItemQtyPrice(tx, iqpId) {
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
        const modifiedBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
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
        await this.auditLogService.logEntityChange({
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
        }, tx);
        return { iqp_id: iqpId, deleted: nextDeleted };
    }
    async createItemQtyPrice(tx, saveItemQtyPriceDto) {
        const effectiveFrom = this.parseRequiredDate(saveItemQtyPriceDto.iqp_effective_from, 'iqp_effective_from');
        const effectiveTo = this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null;
        this.validateDateRange(effectiveFrom, effectiveTo);
        this.validateQtyRange(saveItemQtyPriceDto.iqp_from_qty ?? 0, saveItemQtyPriceDto.iqp_to_qty ?? null);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveItemQtyPriceDto.iqp_created_by, this.requestContextService.getUserId());
        const data = {
            iqpItemId: saveItemQtyPriceDto.iqp_item_id,
            iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
            iqpEffectiveFrom: effectiveFrom,
            iqpCreatedOn: now,
            iqpCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemQtyPriceDto);
        const created = await tx.itemQtyPrice.create({ data, include: ITEM_QTY_PRICE_INCLUDE });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange({
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
        }, tx);
        return payload;
    }
    async updateItemQtyPrice(tx, saveItemQtyPriceDto) {
        const iqpId = saveItemQtyPriceDto.iqp_id;
        const existing = await tx.itemQtyPrice.findFirst({
            where: { iqpId, iqpIsDeleted: false },
            include: ITEM_QTY_PRICE_INCLUDE,
        });
        if (!existing) {
            this.throwNotFound(iqpId);
        }
        const nextEffectiveFrom = this.parseRequiredDate(saveItemQtyPriceDto.iqp_effective_from, 'iqp_effective_from');
        const nextEffectiveTo = (0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_effective_to')
            ? (this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null)
            : existing.iqpEffectiveTo;
        this.validateDateRange(nextEffectiveFrom, nextEffectiveTo);
        const nextFromQty = (0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_from_qty')
            ? (saveItemQtyPriceDto.iqp_from_qty ?? 0)
            : (0, module_service_utils_1.toNumber)(existing.iqpFromQty);
        const nextToQty = (0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_to_qty')
            ? (saveItemQtyPriceDto.iqp_to_qty ?? null)
            : (0, module_service_utils_1.toNullableNumber)(existing.iqpToQty);
        this.validateQtyRange(nextFromQty, nextToQty);
        const data = {
            iqpItemId: saveItemQtyPriceDto.iqp_item_id,
            iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
            iqpEffectiveFrom: nextEffectiveFrom,
            iqpModifiedOn: new Date(),
            iqpModifiedBy: (0, module_service_utils_1.resolveActor)(saveItemQtyPriceDto.iqp_modified_by, this.requestContextService.getUserId()),
        };
        this.applyOptionalFields(data, saveItemQtyPriceDto);
        const updated = await tx.itemQtyPrice.update({
            where: { iqpId },
            data,
            include: ITEM_QTY_PRICE_INCLUDE,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: ITEM_QTY_PRICE_TABLE_NAME,
            screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: iqpId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.iqp_modified_by ?? this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            notes: 'Item qty price updated',
        }, tx);
        return payload;
    }
    applyOptionalFields(data, saveItemQtyPriceDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_company_id'))
            data.iqpCompanyId = saveItemQtyPriceDto.iqp_company_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_branch_id'))
            data.iqpBranchId = saveItemQtyPriceDto.iqp_branch_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_party_id'))
            data.iqpPartyId = saveItemQtyPriceDto.iqp_party_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_price_level'))
            data.iqpPriceLevel = saveItemQtyPriceDto.iqp_price_level;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_from_qty'))
            data.iqpFromQty = saveItemQtyPriceDto.iqp_from_qty;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_to_qty'))
            data.iqpToQty = saveItemQtyPriceDto.iqp_to_qty;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_price_mode'))
            data.iqpPriceMode = saveItemQtyPriceDto.iqp_price_mode;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_disc_pct'))
            data.iqpDiscPct = saveItemQtyPriceDto.iqp_disc_pct;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_flat_off'))
            data.iqpFlatOff = saveItemQtyPriceDto.iqp_flat_off;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_price'))
            data.iqpPrice = saveItemQtyPriceDto.iqp_price;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_is_tax_incl'))
            data.iqpIsTaxIncl = saveItemQtyPriceDto.iqp_is_tax_incl;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_effective_to'))
            data.iqpEffectiveTo = this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to');
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_is_active'))
            data.iqpIsActive = saveItemQtyPriceDto.iqp_is_active;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemQtyPriceDto, 'iqp_sync_date'))
            data.iqpSyncDate = this.parseOptionalDate(saveItemQtyPriceDto.iqp_sync_date, 'iqp_sync_date');
    }
    validateDateRange(effectiveFrom, effectiveTo) {
        if (!effectiveTo) {
            return;
        }
        if (effectiveFrom.getTime() > effectiveTo.getTime()) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iqp_effective_to',
                    message: 'iqp_effective_to must be greater than or equal to iqp_effective_from',
                },
            ]);
        }
    }
    validateQtyRange(fromQty, toQty) {
        if (toQty === null) {
            return;
        }
        if (fromQty >= toQty) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'iqp_to_qty',
                    message: 'iqp_to_qty must be greater than iqp_from_qty',
                },
            ]);
        }
    }
    parseRequiredDate(value, fieldName) {
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                { field: fieldName, message: `${fieldName} must be a valid date` },
            ]);
        }
        return parsedDate;
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
                { field: fieldName, message: `${fieldName} must be a valid date` },
            ]);
        }
        return parsedDate;
    }
    toPayload(record) {
        return {
            iqp_id: record.iqpId,
            iqp_company_id: record.iqpCompanyId,
            iqp_branch_id: record.iqpBranchId,
            iqp_party_id: record.iqpPartyId,
            iqp_price_level: record.iqpPriceLevel,
            iqp_item_id: record.iqpItemId,
            iqp_item_unit_id: record.iqpItemUnitId,
            iqp_from_qty: (0, module_service_utils_1.toNumber)(record.iqpFromQty),
            iqp_to_qty: (0, module_service_utils_1.toNullableNumber)(record.iqpToQty),
            iqp_price_mode: record.iqpPriceMode,
            iqp_disc_pct: (0, module_service_utils_1.toNullableNumber)(record.iqpDiscPct),
            iqp_flat_off: (0, module_service_utils_1.toNullableNumber)(record.iqpFlatOff),
            iqp_price: (0, module_service_utils_1.toNullableNumber)(record.iqpPrice),
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
            iqp_item_name: record.item?.itemNameEn ?? null,
            iqp_unit_name: record.itemUnitConversion?.unit?.unit_name ?? null,
            iqp_company_name: record.company?.compName ?? null,
            iqp_branch_name: record.branch?.brName ?? null,
            iqp_price_level_name: record.priceLevel?.iplName ?? null,
            iqp_party_name: record.party?.cusName ?? null,
        };
    }
    buildDisplayName(record) {
        const levelSegment = record.iqpPriceLevel ?? 'ALL';
        const upperSegment = record.iqpToQty !== null ? (0, module_service_utils_1.toNumber)(record.iqpToQty) : 'ABOVE';
        return `${record.iqpItemId}:${record.iqpItemUnitId}:L${levelSegment}:[${(0, module_service_utils_1.toNumber)(record.iqpFromQty)}-${upperSegment})`;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item qty price already exists', [
            { field: 'iqp_item_id', message: 'Duplicate qty price slab is not allowed' },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                {
                    field: 'iqp_item_id',
                    message: 'Referenced item, unit, company, branch, or party does not exist',
                },
            ]);
        }
    }
    throwNotFound(iqpId) {
        (0, module_service_utils_1.throwInventoryNotFound)('Item qty price not found', 'iqp_id', `No item qty price found with id ${iqpId}`);
    }
};
exports.ItemsQtyPriceMasterService = ItemsQtyPriceMasterService;
exports.ItemsQtyPriceMasterService = ItemsQtyPriceMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], ItemsQtyPriceMasterService);
//# sourceMappingURL=items-qty-price-master.service.js.map