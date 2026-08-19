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
exports.StateCodeMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const STATE_CODE_MASTER_TABLE_NAME = 'state codes';
const STATE_CODE_MASTER_AUDIT_SCREEN_NAME = 'State Code Master';
const STATE_CODE_MASTER_OPTIONAL_FIELDS = ['stateUt', 'tinCode', 'isActive'];
let StateCodeMasterService = class StateCodeMasterService {
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
    async save(saveStateCodeMasterDto) {
        const stateCode = this.normalizeStateCode(saveStateCodeMasterDto.stateCode);
        const existing = await this.prisma.stateCode.findUnique({
            where: { stateCode },
            select: { stateCode: true },
        });
        if (existing) {
            return this.updateStateCode(saveStateCodeMasterDto, stateCode);
        }
        return this.createStateCode(saveStateCodeMasterDto, stateCode);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const result = await (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, { tableName: STATE_CODE_MASTER_TABLE_NAME, alias: 'state_code_master_grid', search: queryDto.search, page, limit, skip });
        if (!result) {
            (0, module_service_utils_1.throwFixedBadRequest)('No configured grid found for state code master list', []);
        }
        return result;
    }
    async getById(stateCodeValue) {
        const stateCode = this.normalizeStateCode(stateCodeValue);
        const record = await this.prisma.stateCode.findFirst({
            where: { stateCode, isDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwFixedNotFound)('State code not found', 'stateCode', `No active state code found with code ${stateCode}`);
        }
        return this.toPayload(record);
    }
    async softDelete(stateCodeValue) {
        const stateCode = this.normalizeStateCode(stateCodeValue);
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.stateCode.findFirst({
                where: { stateCode, isDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('State code not found', 'stateCode', `No active state code found with code ${stateCode}`);
            }
            const modifiedOn = new Date();
            const result = await tx.stateCode.updateMany({
                where: { stateCode, isDeleted: false },
                data: {
                    isDeleted: true,
                    isActive: false,
                    modifiedOn,
                    modifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwFixedNotFound)('State code not found', 'stateCode', `No active state code found with code ${stateCode}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                isDeleted: true,
                isActive: false,
                modifiedOn,
                modifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: STATE_CODE_MASTER_TABLE_NAME,
                screenName: STATE_CODE_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: stateCode,
                displayName: existing.stateName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'State code soft deleted',
            }, tx);
            return { stateCode, deleted: true };
        });
    }
    async createStateCode(saveStateCodeMasterDto, stateCode) {
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveStateCodeMasterDto.stateName, 'stateName');
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveStateCodeMasterDto.createdBy, this.requestContextService.getUserId());
        const data = {
            stateCode,
            stateName: normalizedName,
            createdOn: now,
            createdBy,
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveStateCodeMasterDto, STATE_CODE_MASTER_OPTIONAL_FIELDS);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureStateNameIsUnique(tx, normalizedName, stateCode);
                const created = await tx.stateCode.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: STATE_CODE_MASTER_TABLE_NAME,
                    screenName: STATE_CODE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.stateCode,
                    displayName: payload.stateName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'State code created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'State code already exists', [{ field: 'stateCode', message: 'Duplicate stateCode is not allowed' }]);
            throw error;
        }
    }
    async updateStateCode(saveStateCodeMasterDto, stateCode) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.stateCode.findUnique({ where: { stateCode } });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('State code not found', 'stateCode', `No active state code found with code ${stateCode}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveStateCodeMasterDto.stateName, 'stateName');
                await this.ensureStateNameIsUnique(tx, normalizedName, stateCode);
                const data = {
                    stateName: normalizedName,
                    isDeleted: false,
                    modifiedOn: new Date(),
                    modifiedBy: (0, module_service_utils_1.resolveActor)(saveStateCodeMasterDto.modifiedBy, this.requestContextService.getUserId()),
                };
                (0, module_service_utils_1.applyPresentFields)(data, saveStateCodeMasterDto, STATE_CODE_MASTER_OPTIONAL_FIELDS);
                const updated = await tx.stateCode.update({ where: { stateCode }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: STATE_CODE_MASTER_TABLE_NAME,
                    screenName: STATE_CODE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: stateCode,
                    displayName: payload.stateName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: (0, module_service_utils_1.resolveActor)(saveStateCodeMasterDto.modifiedBy, this.requestContextService.getUserId()),
                    notes: existing.isDeleted ? 'State code restored and updated' : 'State code updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'State code already exists', [{ field: 'stateCode', message: 'Duplicate stateCode is not allowed' }]);
            throw error;
        }
    }
    async ensureStateNameIsUnique(tx, stateName, excludeCode) {
        const existing = await tx.stateCode.findFirst({
            where: {
                isDeleted: false,
                stateName: { equals: stateName, mode: 'insensitive' },
                ...(excludeCode ? { stateCode: { not: excludeCode } } : {}),
            },
            select: { stateCode: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwFixedConflict)('State name already exists', [{ field: 'stateName', message: 'Duplicate stateName is not allowed' }]);
        }
    }
    normalizeStateCode(value, fieldName = 'stateCode') {
        const normalized = value.trim().toUpperCase();
        if (!normalized || normalized.length !== 2) {
            (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field: fieldName, message: `${fieldName} must be a 2-character code` }]);
        }
        return normalized;
    }
    toPayload(record) {
        return {
            stateCode: record.stateCode,
            stateName: record.stateName,
            stateUt: record.stateUt,
            tinCode: record.tinCode,
            isActive: record.isActive,
            isDeleted: record.isDeleted,
            stateSyncDate: record.stateSyncDate ? record.stateSyncDate.toISOString() : null,
            createdOn: record.createdOn.toISOString(),
            createdBy: record.createdBy,
            modifiedOn: record.modifiedOn.toISOString(),
            modifiedBy: record.modifiedBy,
        };
    }
};
exports.StateCodeMasterService = StateCodeMasterService;
exports.StateCodeMasterService = StateCodeMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], StateCodeMasterService);
//# sourceMappingURL=state-code-master.service.js.map