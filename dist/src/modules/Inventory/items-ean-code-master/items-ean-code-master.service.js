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
exports.ItemsEanCodeMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_EAN_CODE_TABLE_NAME = 'item ean codes';
const ITEM_EAN_CODE_AUDIT_SCREEN_NAME = 'Item EAN Code Master';
let ItemsEanCodeMasterService = class ItemsEanCodeMasterService {
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
    async save(saveItemEanCodeDto, tx) {
        const saveItems = Array.isArray(saveItemEanCodeDto) ? saveItemEanCodeDto : [saveItemEanCodeDto];
        const saveAll = async (client) => {
            const savedItems = [];
            for (const saveItem of saveItems) {
                savedItems.push(await this.saveItemEanCode(client, saveItem));
            }
            return savedItems;
        };
        try {
            const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
            return Array.isArray(saveItemEanCodeDto) ? results : results[0];
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = {
            eanIsDeleted: false,
            ...(queryDto.ean_item_id !== undefined && { eanItemId: queryDto.ean_item_id }),
            ...(queryDto.ean_unit_id !== undefined && { eanUcUnitId: queryDto.ean_unit_id }),
            ...(queryDto.ean_is_default !== undefined && { eanIsDefault: queryDto.ean_is_default }),
            ...(queryDto.ean_is_active !== undefined && { eanIsActive: queryDto.ean_is_active }),
        };
        return (0, module_list_utils_1.runInventoryListQuery)({ page, limit }, {
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: ITEM_EAN_CODE_TABLE_NAME,
                alias: 'item_ean_code_grid',
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.itemEanCode.count({ where }),
            findManyFn: () => this.prisma.itemEanCode.findMany({
                where,
                orderBy: [{ eanItemId: 'asc' }, { eanSlNo: 'asc' }, { eanId: 'asc' }],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
        });
    }
    async getById(eanId) {
        const record = await this.prisma.itemEanCode.findFirst({
            where: {
                eanId,
                eanIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item EAN code not found', 'ean_id', `No active item EAN code found with id ${eanId}`);
        }
        return this.toPayload(record);
    }
    async findByItemId(itemId, client = this.prisma) {
        const records = await client.itemEanCode.findMany({
            where: { eanItemId: itemId, eanIsDeleted: false },
            orderBy: [{ eanSlNo: 'asc' }, { eanId: 'asc' }],
        });
        return records.map((record) => this.toPayload(record));
    }
    async findIdsByItemId(itemId, isDeleted) {
        const records = await this.prisma.itemEanCode.findMany({
            where: { eanItemId: itemId, eanIsDeleted: isDeleted },
            select: { eanId: true },
        });
        return records.map((record) => record.eanId);
    }
    async toggleDelete(eanId, tx) {
        const toggleIds = Array.isArray(eanId) ? eanId : [eanId];
        const toggleAll = async (client) => {
            const toggledItems = [];
            for (const toggleId of toggleIds) {
                toggledItems.push(await this.toggleDeleteItemEanCode(client, toggleId));
            }
            return toggledItems;
        };
        const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
        return Array.isArray(eanId) ? results : results[0];
    }
    async saveItemEanCode(tx, saveItemEanCodeDto) {
        if (saveItemEanCodeDto.ean_id) {
            return this.updateItemEanCode(tx, saveItemEanCodeDto);
        }
        return this.createItemEanCode(tx, saveItemEanCodeDto);
    }
    async toggleDeleteItemEanCode(tx, eanId) {
        const existing = await tx.itemEanCode.findFirst({
            where: {
                eanId,
            },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item EAN code not found', 'ean_id', `No item EAN code found with id ${eanId}`);
        }
        const wasDeleted = existing.eanIsDeleted;
        const nextDeleted = !wasDeleted;
        const modifiedOn = new Date();
        const modifiedBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const result = await tx.itemEanCode.updateMany({
            where: {
                eanId,
                eanIsDeleted: wasDeleted,
            },
            data: {
                eanIsDeleted: nextDeleted,
                eanModifiedOn: modifiedOn,
                eanModifiedBy: modifiedBy,
            },
        });
        if (result.count === 0) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item EAN code not found', 'ean_id', `No item EAN code found with id ${eanId}`);
        }
        const originalRecord = this.toPayload(existing);
        const modifiedRecord = this.toPayload({
            ...existing,
            eanIsDeleted: nextDeleted,
            eanModifiedOn: modifiedOn,
            eanModifiedBy: modifiedBy,
        });
        await this.auditLogService.logEntityChange({
            action: nextDeleted ? 'cancel' : 'update',
            tableName: ITEM_EAN_CODE_TABLE_NAME,
            screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: eanId,
            displayName: existing.eanCode,
            originalRecord,
            modifiedRecord,
            userId: modifiedBy,
            notes: nextDeleted ? 'Item EAN code soft deleted' : 'Item EAN code restored',
        }, tx);
        return {
            ean_id: eanId,
            deleted: nextDeleted,
        };
    }
    async createItemEanCode(tx, saveItemEanCodeDto) {
        const eanCode = saveItemEanCodeDto.ean_code?.trim();
        if (!eanCode) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ean_code',
                    message: 'ean_code is required',
                },
            ]);
        }
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveItemEanCodeDto.ean_created_by, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveItemEanCodeDto.ean_modified_by, createdBy);
        const data = {
            eanItemId: saveItemEanCodeDto.ean_item_id,
            eanUcUnitId: saveItemEanCodeDto.ean_unit_id,
            eanCode,
            eanCreatedOn: now,
            eanCreatedBy: createdBy,
            eanModifiedOn: now,
            eanModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveItemEanCodeDto);
        const created = await tx.itemEanCode.create({ data });
        await this.enforceSingleDefaultInScope(tx, created, created.eanModifiedBy ?? modifiedBy);
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: ITEM_EAN_CODE_TABLE_NAME,
            screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ean_id,
            displayName: payload.ean_code,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Item EAN code created',
        }, tx);
        return payload;
    }
    async updateItemEanCode(tx, saveItemEanCodeDto) {
        const eanId = saveItemEanCodeDto.ean_id;
        const existing = await tx.itemEanCode.findFirst({
            where: {
                eanId,
                eanIsDeleted: false,
            },
        });
        if (!existing) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item EAN code not found', 'ean_id', `No active item EAN code found with id ${eanId}`);
        }
        const eanCode = saveItemEanCodeDto.ean_code?.trim();
        if (!eanCode) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ean_code',
                    message: 'ean_code cannot be empty',
                },
            ]);
        }
        const data = {
            eanItemId: saveItemEanCodeDto.ean_item_id,
            eanUcUnitId: saveItemEanCodeDto.ean_unit_id,
            eanCode,
            eanModifiedOn: new Date(),
            eanModifiedBy: (0, module_service_utils_1.resolveActor)(saveItemEanCodeDto.ean_modified_by, this.requestContextService.getUserId()),
        };
        this.applyOptionalFields(data, saveItemEanCodeDto);
        const updated = await tx.itemEanCode.update({
            where: {
                eanId,
            },
            data,
        });
        await this.enforceSingleDefaultInScope(tx, updated, updated.eanModifiedBy ?? this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR);
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: ITEM_EAN_CODE_TABLE_NAME,
            screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: eanId,
            displayName: payload.ean_code,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.ean_modified_by ?? this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            notes: 'Item EAN code updated',
        }, tx);
        return payload;
    }
    applyOptionalFields(data, saveItemEanCodeDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemEanCodeDto, 'ean_sl_no')) {
            data.eanSlNo = saveItemEanCodeDto.ean_sl_no;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemEanCodeDto, 'ean_is_default')) {
            data.eanIsDefault = saveItemEanCodeDto.ean_is_default;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemEanCodeDto, 'ean_is_active')) {
            data.eanIsActive = saveItemEanCodeDto.ean_is_active;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemEanCodeDto, 'ean_remarks')) {
            data.eanRemarks = saveItemEanCodeDto.ean_remarks;
        }
    }
    async enforceSingleDefaultInScope(tx, record, actor) {
        if (!record.eanIsDefault) {
            return;
        }
        await tx.itemEanCode.updateMany({
            where: {
                eanItemId: record.eanItemId,
                eanUcUnitId: record.eanUcUnitId,
                eanIsDeleted: false,
                eanIsDefault: true,
                eanId: {
                    not: record.eanId,
                },
            },
            data: {
                eanIsDefault: false,
                eanModifiedOn: new Date(),
                eanModifiedBy: actor,
            },
        });
    }
    toPayload(record) {
        return {
            ean_id: record.eanId,
            ean_item_id: record.eanItemId,
            ean_unit_id: record.eanUcUnitId,
            ean_code: record.eanCode,
            ean_sl_no: record.eanSlNo,
            ean_is_default: record.eanIsDefault,
            ean_is_active: record.eanIsActive,
            ean_is_deleted: record.eanIsDeleted,
            ean_created_on: record.eanCreatedOn.toISOString(),
            ean_created_by: record.eanCreatedBy,
            ean_modified_on: record.eanModifiedOn.toISOString(),
            ean_modified_by: record.eanModifiedBy,
            ean_remarks: record.eanRemarks,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'EAN code already exists', [
            { field: 'ean_code', message: 'Duplicate ean_code is not allowed' },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                { field: 'ean_unit_id', message: 'Referenced relation does not exist' },
            ]);
        }
    }
};
exports.ItemsEanCodeMasterService = ItemsEanCodeMasterService;
exports.ItemsEanCodeMasterService = ItemsEanCodeMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], ItemsEanCodeMasterService);
//# sourceMappingURL=items-ean-code-master.service.js.map