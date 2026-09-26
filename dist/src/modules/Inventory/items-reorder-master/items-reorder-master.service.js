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
exports.ItemsReorderMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_REORDER_TABLE_NAME = 'item reorders';
const ITEM_REORDER_AUDIT_SCREEN_NAME = 'Item Reorder Master';
let ItemsReorderMasterService = class ItemsReorderMasterService {
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
    async save(saveItemReorderDto, tx) {
        const saveItems = Array.isArray(saveItemReorderDto) ? saveItemReorderDto : [saveItemReorderDto];
        const saveAll = async (client) => {
            const savedItems = [];
            for (const saveItem of saveItems) {
                savedItems.push(await this.saveItemReorder(client, saveItem));
            }
            return savedItems;
        };
        try {
            const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
            return Array.isArray(saveItemReorderDto) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {
            irIsDeleted: false,
            ...(queryDto.ir_item_id !== undefined && { irItemId: queryDto.ir_item_id }),
            ...(queryDto.ir_branch_id !== undefined && { irBranchId: queryDto.ir_branch_id }),
            ...(queryDto.ir_unit_id !== undefined && { irUcUnitId: queryDto.ir_unit_id }),
            ...(queryDto.ir_godown_id !== undefined && { irGodownId: queryDto.ir_godown_id }),
            ...(queryDto.ir_is_active !== undefined && { irIsActive: queryDto.ir_is_active }),
        };
        return (0, module_list_utils_1.runInventoryListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: ITEM_REORDER_TABLE_NAME,
                alias: 'item_reorder_grid',
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.itemReorder.count({ where }),
            findManyFn: () => this.prisma.itemReorder.findMany({
                where,
                orderBy: [{ irItemId: 'asc' }, { irSlNo: 'asc' }, { irId: 'asc' }],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
        });
    }
    async getById(irId) {
        const record = await this.prisma.itemReorder.findFirst({
            where: { irId, irIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item reorder not found', 'ir_id', `No active item reorder found with id ${irId}`);
        }
        return this.toPayload(record);
    }
    async findByItemId(itemId, client = this.prisma) {
        const records = await client.itemReorder.findMany({
            where: { irItemId: itemId, irIsDeleted: false },
            orderBy: [{ irSlNo: 'asc' }, { irId: 'asc' }],
        });
        return records.map((record) => this.toPayload(record));
    }
    async findIdsByItemId(itemId, isDeleted) {
        const records = await this.prisma.itemReorder.findMany({
            where: { irItemId: itemId, irIsDeleted: isDeleted },
            select: { irId: true },
        });
        return records.map((record) => record.irId);
    }
    async toggleDelete(irId, tx) {
        const toggleIds = Array.isArray(irId) ? irId : [irId];
        const toggleAll = async (client) => {
            const toggledItems = [];
            for (const toggleId of toggleIds) {
                toggledItems.push(await this.toggleDeleteItemReorder(client, toggleId));
            }
            return toggledItems;
        };
        const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
        return Array.isArray(irId) ? results : results[0];
    }
    async saveItemReorder(tx, saveItemReorderDto) {
        if (saveItemReorderDto.ir_id) {
            return this.updateItemReorder(tx, saveItemReorderDto);
        }
        return this.createItemReorder(tx, saveItemReorderDto);
    }
    async toggleDeleteItemReorder(tx, irId) {
        const existing = await tx.itemReorder.findFirst({
            where: { irId },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item reorder not found', 'ir_id', `No item reorder found with id ${irId}`);
        }
        const wasDeleted = existing.irIsDeleted;
        const nextDeleted = !wasDeleted;
        const modifiedOn = new Date();
        const modifiedBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const result = await tx.itemReorder.updateMany({
            where: { irId, irIsDeleted: wasDeleted },
            data: { irIsDeleted: nextDeleted, irModifiedOn: modifiedOn, irModifiedBy: modifiedBy },
        });
        if (result.count === 0) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item reorder not found', 'ir_id', `No item reorder found with id ${irId}`);
        }
        const originalRecord = this.toPayload(existing);
        const modifiedRecord = this.toPayload({
            ...existing,
            irIsDeleted: nextDeleted,
            irModifiedOn: modifiedOn,
            irModifiedBy: modifiedBy,
        });
        await this.auditLogService.logEntityChange({
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
        }, tx);
        return { ir_id: irId, deleted: nextDeleted };
    }
    async createItemReorder(tx, saveItemReorderDto) {
        this.validateReorderRange(saveItemReorderDto);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveItemReorderDto.ir_created_by, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveItemReorderDto.ir_modified_by, createdBy);
        const data = {
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
        await this.auditLogService.logEntityChange({
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
        }, tx);
        return payload;
    }
    async updateItemReorder(tx, saveItemReorderDto) {
        const irId = saveItemReorderDto.ir_id;
        this.validateReorderRange(saveItemReorderDto);
        const existing = await tx.itemReorder.findFirst({
            where: { irId, irIsDeleted: false },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item reorder not found', 'ir_id', `No active item reorder found with id ${irId}`);
        }
        const data = {
            irItemId: saveItemReorderDto.ir_item_id,
            irUcUnitId: saveItemReorderDto.ir_unit_id ?? null,
            irModifiedOn: new Date(),
            irModifiedBy: (0, module_service_utils_1.resolveActor)(saveItemReorderDto.ir_modified_by, this.requestContextService.getUserId()),
        };
        this.applyOptionalFields(data, saveItemReorderDto);
        const updated = await tx.itemReorder.update({ where: { irId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: ITEM_REORDER_TABLE_NAME,
            screenName: ITEM_REORDER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: irId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.ir_modified_by ?? this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            notes: 'Item reorder updated',
        }, tx);
        return payload;
    }
    applyOptionalFields(data, saveItemReorderDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_branch_id'))
            data.irBranchId = saveItemReorderDto.ir_branch_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_godown_id'))
            data.irGodownId = saveItemReorderDto.ir_godown_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_sl_no'))
            data.irSlNo = saveItemReorderDto.ir_sl_no;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_min_level'))
            data.irMinLevel = saveItemReorderDto.ir_min_level;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_max_level'))
            data.irMaxLevel = saveItemReorderDto.ir_max_level;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_reorder_level'))
            data.irReorderLevel = saveItemReorderDto.ir_reorder_level;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_reorder_qty'))
            data.irReorderQty = saveItemReorderDto.ir_reorder_qty;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_lead_time_days'))
            data.irLeadTimeDays = saveItemReorderDto.ir_lead_time_days;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_review_cycle_days'))
            data.irReviewCycleDays = saveItemReorderDto.ir_review_cycle_days;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_reorder_days'))
            data.irReorderDays = saveItemReorderDto.ir_reorder_days;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_expiry_buffer_days'))
            data.irExpiryBufferDays = saveItemReorderDto.ir_expiry_buffer_days;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_reorder_type'))
            data.irReorderType = saveItemReorderDto.ir_reorder_type;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_is_active'))
            data.irIsActive = saveItemReorderDto.ir_is_active;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemReorderDto, 'ir_remarks'))
            data.irRemarks = saveItemReorderDto.ir_remarks;
    }
    validateReorderRange(saveItemReorderDto) {
        const minLevel = saveItemReorderDto.ir_min_level;
        const maxLevel = saveItemReorderDto.ir_max_level;
        if (minLevel !== undefined && maxLevel !== undefined && minLevel > maxLevel) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ir_max_level',
                    message: 'ir_max_level must be greater than or equal to ir_min_level',
                },
            ]);
        }
    }
    toPayload(record) {
        return {
            ir_id: record.irId,
            ir_branch_id: record.irBranchId,
            ir_item_id: record.irItemId,
            ir_unit_id: record.irUcUnitId,
            ir_godown_id: record.irGodownId,
            ir_sl_no: record.irSlNo,
            ir_min_level: (0, module_service_utils_1.toNumber)(record.irMinLevel),
            ir_max_level: (0, module_service_utils_1.toNumber)(record.irMaxLevel),
            ir_reorder_level: (0, module_service_utils_1.toNumber)(record.irReorderLevel),
            ir_reorder_qty: (0, module_service_utils_1.toNumber)(record.irReorderQty),
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
    buildDisplayName(record) {
        const unitSegment = record.irUcUnitId ?? 'NO_UNIT';
        const godownSegment = record.irGodownId ?? 'GLOBAL';
        return `${record.irItemId}:${unitSegment}:${godownSegment}`;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item reorder already exists', [
            { field: 'ir_item_id', message: 'Duplicate item + unit + godown combination is not allowed' },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                { field: 'ir_item_id', message: 'Referenced item/unit does not exist' },
            ]);
        }
    }
};
exports.ItemsReorderMasterService = ItemsReorderMasterService;
exports.ItemsReorderMasterService = ItemsReorderMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], ItemsReorderMasterService);
//# sourceMappingURL=items-reorder-master.service.js.map