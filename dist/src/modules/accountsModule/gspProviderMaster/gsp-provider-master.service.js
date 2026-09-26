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
exports.GspProviderMasterService = void 0;
const node_net_1 = require("node:net");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const GSP_PROVIDER_MASTER_TABLE_NAME = 'gsp provider master';
const GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME = 'GSP Provider Master';
let GspProviderMasterService = class GspProviderMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveGspProviderMasterDto) {
        if (saveGspProviderMasterDto.gspProviderId) {
            return this.updateProvider(saveGspProviderMasterDto);
        }
        return this.createProvider(saveGspProviderMasterDto);
    }
    async getById(gspProviderId) {
        const record = await this.prisma.gspProviderMaster.findFirst({
            where: {
                gspProviderId,
                gspIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwAccountsNotFound)('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(gspProviderId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gspProviderMaster.findFirst({
                where: {
                    gspProviderId,
                    gspIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
            }
            const activeServiceCount = await tx.gspCompanyService.count({
                where: {
                    csgGspProviderId: gspProviderId,
                    csgIsDeleted: false,
                },
            });
            if (activeServiceCount > 0) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Cannot delete GSP provider linked to active company services', [
                    {
                        field: 'gspProviderId',
                        message: `GSP provider ${gspProviderId} is linked to ${activeServiceCount} active service record(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.gspProviderMaster.updateMany({
                where: {
                    gspProviderId,
                    gspIsDeleted: false,
                },
                data: {
                    gspIsDeleted: true,
                    gspIsActive: false,
                    gspModifiedOn: modifiedOn,
                    gspModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                gspIsDeleted: true,
                gspIsActive: false,
                gspModifiedOn: modifiedOn,
                gspModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
                screenName: GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: gspProviderId,
                displayName: existing.gspProviderName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'GSP provider soft deleted',
            }, tx);
            return {
                gspProviderId,
                deleted: true,
            };
        });
    }
    async createProvider(saveGspProviderMasterDto) {
        try {
            return this.prisma.$transaction(async (tx) => {
                const gspProviderCode = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspProviderCode, 'gspProviderCode');
                const gspProviderName = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspProviderName, 'gspProviderName');
                const gspBaseUrl = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspBaseUrl, 'gspBaseUrl');
                const gspRoute = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspRoute, 'gspRoute');
                const gspIpAddress = this.normalizeIpAddress(saveGspProviderMasterDto.gspIpAddress);
                const gspUserName = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspUserName, 'gspUserName');
                const gspUserPassword = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspUserPassword, 'gspUserPassword');
                await this.ensureCodeIsUnique(tx, gspProviderCode);
                await this.ensureNameIsUnique(tx, gspProviderName);
                const now = new Date();
                const data = {
                    gspProviderCode,
                    gspProviderName,
                    gspBaseUrl,
                    gspRoute,
                    gspIpAddress,
                    gspUserName,
                    gspUserPassword,
                    gspCreatedOn: now,
                    gspCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspProviderMasterDto, 'gspIsActive')) {
                    data.gspIsActive = saveGspProviderMasterDto.gspIsActive;
                }
                const created = await tx.gspProviderMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
                    screenName: GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.gspProviderId,
                    displayName: payload.gspProviderName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'GSP provider created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'GSP provider already exists', [
                {
                    field: 'gspProviderCode',
                    message: 'Duplicate GSP provider unique value is not allowed',
                },
            ]);
            throw error;
        }
    }
    async updateProvider(saveGspProviderMasterDto) {
        const gspProviderId = saveGspProviderMasterDto.gspProviderId;
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.gspProviderMaster.findFirst({
                    where: {
                        gspProviderId,
                        gspIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsNotFound)('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
                }
                const gspProviderCode = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspProviderCode, 'gspProviderCode');
                const gspProviderName = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspProviderName, 'gspProviderName');
                const gspBaseUrl = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspBaseUrl, 'gspBaseUrl');
                const gspRoute = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspRoute, 'gspRoute');
                const gspIpAddress = this.normalizeIpAddress(saveGspProviderMasterDto.gspIpAddress);
                const gspUserName = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspUserName, 'gspUserName');
                const gspUserPassword = (0, module_service_utils_1.normalizeRequiredText)(saveGspProviderMasterDto.gspUserPassword, 'gspUserPassword');
                await this.ensureCodeIsUnique(tx, gspProviderCode, gspProviderId);
                await this.ensureNameIsUnique(tx, gspProviderName, gspProviderId);
                const data = {
                    gspProviderCode,
                    gspProviderName,
                    gspBaseUrl,
                    gspRoute,
                    gspIpAddress,
                    gspUserName,
                    gspUserPassword,
                    gspModifiedOn: new Date(),
                    gspModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspProviderMasterDto, 'gspIsActive')) {
                    data.gspIsActive = saveGspProviderMasterDto.gspIsActive;
                }
                const updated = await tx.gspProviderMaster.update({
                    where: {
                        gspProviderId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
                    screenName: GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: gspProviderId,
                    displayName: payload.gspProviderName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'GSP provider updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'GSP provider already exists', [
                {
                    field: 'gspProviderCode',
                    message: 'Duplicate GSP provider unique value is not allowed',
                },
            ]);
            throw error;
        }
    }
    async ensureCodeIsUnique(tx, gspProviderCode, excludeProviderId) {
        const existing = await tx.gspProviderMaster.findFirst({
            where: {
                gspIsDeleted: false,
                gspProviderCode: {
                    equals: gspProviderCode,
                    mode: 'insensitive',
                },
                ...(excludeProviderId
                    ? {
                        gspProviderId: {
                            not: excludeProviderId,
                        },
                    }
                    : {}),
            },
            select: {
                gspProviderId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('GSP provider code already exists', [
                { field: 'gspProviderCode', message: 'Duplicate gspProviderCode is not allowed' },
            ]);
        }
    }
    async ensureNameIsUnique(tx, gspProviderName, excludeProviderId) {
        const existing = await tx.gspProviderMaster.findFirst({
            where: {
                gspIsDeleted: false,
                gspProviderName: {
                    equals: gspProviderName,
                    mode: 'insensitive',
                },
                ...(excludeProviderId
                    ? {
                        gspProviderId: {
                            not: excludeProviderId,
                        },
                    }
                    : {}),
            },
            select: {
                gspProviderId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('GSP provider name already exists', [
                { field: 'gspProviderName', message: 'Duplicate gspProviderName is not allowed' },
            ]);
        }
    }
    normalizeIpAddress(value) {
        const normalized = value.trim();
        if (!normalized || (0, node_net_1.isIP)(normalized) === 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'gspIpAddress',
                    message: 'gspIpAddress must be a valid IP address',
                },
            ]);
        }
        return normalized;
    }
    toPayload(record) {
        return {
            gspProviderId: record.gspProviderId,
            gspProviderCode: record.gspProviderCode,
            gspProviderName: record.gspProviderName,
            gspBaseUrl: record.gspBaseUrl,
            gspRoute: record.gspRoute,
            gspIpAddress: record.gspIpAddress,
            gspUserName: record.gspUserName,
            gspUserPassword: record.gspUserPassword,
            gspIsActive: record.gspIsActive,
            gspIsDeleted: record.gspIsDeleted,
            gspCreatedOn: record.gspCreatedOn.toISOString(),
            gspCreatedBy: record.gspCreatedBy,
            gspModifiedOn: record.gspModifiedOn.toISOString(),
            gspModifiedBy: record.gspModifiedBy,
        };
    }
};
exports.GspProviderMasterService = GspProviderMasterService;
exports.GspProviderMasterService = GspProviderMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], GspProviderMasterService);
//# sourceMappingURL=gsp-provider-master.service.js.map