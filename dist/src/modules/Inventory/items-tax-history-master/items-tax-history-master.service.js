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
exports.ItemsTaxHistoryMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_TAX_HISTORY_TABLE_NAME = 'item tax history';
const ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME = 'Item Tax History';
let ItemsTaxHistoryMasterService = class ItemsTaxHistoryMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveItemTaxHistoryDto) {
        if (saveItemTaxHistoryDto.ith_id) {
            return this.updateItemTaxHistory(saveItemTaxHistoryDto);
        }
        return this.createItemTaxHistory(saveItemTaxHistoryDto);
    }
    async getById(ithId) {
        const record = await this.prisma.itemTaxHistory.findUnique({ where: { ithId } });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item tax history not found', 'ith_id', `No item tax history found with id ${ithId}`);
        }
        return this.toPayload(record);
    }
    async delete(ithId) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.itemTaxHistory.findUnique({ where: { ithId } });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Item tax history not found', 'ith_id', `No item tax history found with id ${ithId}`);
                }
                await tx.itemTaxHistory.delete({ where: { ithId } });
                await this.auditLogService.logEntityChange({
                    action: 'cancel',
                    tableName: ITEM_TAX_HISTORY_TABLE_NAME,
                    screenName: ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: ithId,
                    displayName: this.buildDisplayName(existing),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: null,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item tax history deleted',
                }, tx);
                return { ith_id: ithId, deleted: true };
            });
        }
        catch (error) {
            this.handleDeleteError(error);
            throw error;
        }
    }
    async createItemTaxHistory(saveItemTaxHistoryDto) {
        const effectiveFrom = this.parseRequiredDate(saveItemTaxHistoryDto.ith_effective_from, 'ith_effective_from');
        const effectiveTo = this.parseOptionalDate(saveItemTaxHistoryDto.ith_effective_to, 'ith_effective_to');
        this.validateDateRange(effectiveFrom, effectiveTo);
        const createdBy = (0, module_service_utils_1.resolveActor)(saveItemTaxHistoryDto.ith_created_by, this.requestContextService.getUserId());
        const data = {
            ithItemId: saveItemTaxHistoryDto.ith_item_id,
            ithTaxId: saveItemTaxHistoryDto.ith_tax_id,
            ithEffectiveFrom: effectiveFrom,
            ithCreatedOn: new Date(),
            ithCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemTaxHistoryDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const created = await tx.itemTaxHistory.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ITEM_TAX_HISTORY_TABLE_NAME,
                    screenName: ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.ith_id,
                    displayName: this.buildDisplayName(created),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Item tax history created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemTaxHistory(saveItemTaxHistoryDto) {
        const ithId = saveItemTaxHistoryDto.ith_id;
        const effectiveFrom = this.parseRequiredDate(saveItemTaxHistoryDto.ith_effective_from, 'ith_effective_from');
        const effectiveTo = this.parseOptionalDate(saveItemTaxHistoryDto.ith_effective_to, 'ith_effective_to');
        this.validateDateRange(effectiveFrom, effectiveTo);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.itemTaxHistory.findUnique({ where: { ithId } });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Item tax history not found', 'ith_id', `No item tax history found with id ${ithId}`);
                }
                const data = {
                    ithItemId: saveItemTaxHistoryDto.ith_item_id,
                    ithTaxId: saveItemTaxHistoryDto.ith_tax_id,
                    ithEffectiveFrom: effectiveFrom,
                };
                this.applyOptionalFields(data, saveItemTaxHistoryDto);
                const updated = await tx.itemTaxHistory.update({ where: { ithId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_TAX_HISTORY_TABLE_NAME,
                    screenName: ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: ithId,
                    displayName: this.buildDisplayName(updated),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item tax history updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    applyOptionalFields(data, saveItemTaxHistoryDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxHistoryDto, 'ith_effective_to')) {
            data.ithEffectiveTo = this.parseOptionalDate(saveItemTaxHistoryDto.ith_effective_to, 'ith_effective_to');
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxHistoryDto, 'ith_reason')) {
            data.ithReason = saveItemTaxHistoryDto.ith_reason;
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
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        return this.parseRequiredDate(value, fieldName);
    }
    validateDateRange(effectiveFrom, effectiveTo) {
        if (!effectiveTo)
            return;
        if (effectiveFrom.getTime() > effectiveTo.getTime()) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                {
                    field: 'ith_effective_to',
                    message: 'ith_effective_to must be greater than or equal to ith_effective_from',
                },
            ]);
        }
    }
    toPayload(record) {
        return {
            ith_id: record.ithId,
            ith_item_id: record.ithItemId,
            ith_tax_id: record.ithTaxId,
            ith_effective_from: record.ithEffectiveFrom.toISOString(),
            ith_effective_to: record.ithEffectiveTo ? record.ithEffectiveTo.toISOString() : null,
            ith_reason: record.ithReason,
            ith_created_on: record.ithCreatedOn.toISOString(),
            ith_created_by: record.ithCreatedBy,
        };
    }
    buildDisplayName(record) {
        return `${record.ithItemId}:${record.ithTaxId}:${record.ithEffectiveFrom.toISOString().slice(0, 10)}`;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item tax history already exists', [{ field: 'ith_id', message: 'Duplicate item tax history is not allowed' }]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid relation reference', [
                { field: 'ith_item_id', message: 'Referenced item or tax does not exist' },
            ]);
        }
    }
    handleDeleteError(error) {
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Cannot delete item tax history', [
                { field: 'ith_id', message: 'Item tax history is referenced by related records' },
            ]);
        }
    }
};
exports.ItemsTaxHistoryMasterService = ItemsTaxHistoryMasterService;
exports.ItemsTaxHistoryMasterService = ItemsTaxHistoryMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ItemsTaxHistoryMasterService);
//# sourceMappingURL=items-tax-history-master.service.js.map