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
exports.GspCompanyServiceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const GSP_COMPANY_SERVICE_TABLE_NAME = 'gsp company service';
const GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME = 'GSP Company Service';
let GspCompanyServiceService = class GspCompanyServiceService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveGspCompanyServiceDto) {
        if (saveGspCompanyServiceDto.csgCompanyServiceId) {
            return this.updateGspCompanyService(saveGspCompanyServiceDto);
        }
        return this.createGspCompanyService(saveGspCompanyServiceDto);
    }
    async getById(csgCompanyServiceId) {
        const record = await this.prisma.gspCompanyService.findFirst({
            where: {
                csgCompanyServiceId,
                csgIsDeleted: false,
            },
            include: {
                company: {
                    select: {
                        compName: true,
                    },
                },
            },
        });
        if (!record) {
            this.throwNotFound(csgCompanyServiceId);
        }
        const providerNameById = await this.loadProviderNameMap([record.csgGspProviderId]);
        return this.toPayload(record, providerNameById.get(record.csgGspProviderId) ?? null);
    }
    async softDelete(csgCompanyServiceId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gspCompanyService.findFirst({
                where: {
                    csgCompanyServiceId,
                    csgIsDeleted: false,
                },
            });
            if (!existing) {
                this.throwNotFound(csgCompanyServiceId);
            }
            const modifiedOn = new Date();
            const result = await tx.gspCompanyService.updateMany({
                where: {
                    csgCompanyServiceId,
                    csgIsDeleted: false,
                },
                data: {
                    csgIsDeleted: true,
                    csgIsActive: false,
                    csgModifiedOn: modifiedOn,
                    csgModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(csgCompanyServiceId);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                csgIsDeleted: true,
                csgIsActive: false,
                csgModifiedOn: modifiedOn,
                csgModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
                screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: csgCompanyServiceId,
                displayName: this.buildDisplayName(existing),
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'GSP company service soft deleted',
            }, tx);
            return {
                csgCompanyServiceId,
                deleted: true,
            };
        });
    }
    async createGspCompanyService(saveGspCompanyServiceDto) {
        try {
            return this.prisma.$transaction(async (tx) => {
                const csgServiceType = this.normalizeRequiredString(saveGspCompanyServiceDto.csgServiceType, 'csgServiceType');
                const csgEuserName = this.normalizeRequiredString(saveGspCompanyServiceDto.csgEuserName, 'csgEuserName');
                const csgEuserPassword = this.normalizeRequiredString(saveGspCompanyServiceDto.csgEuserPassword, 'csgEuserPassword');
                const csgAuthToken = (0, module_service_utils_1.normalizeNullableString)(saveGspCompanyServiceDto.csgAuthToken);
                await this.ensureCompanyExists(saveGspCompanyServiceDto.csgCompanyId, tx);
                await this.ensureGspProviderExists(saveGspCompanyServiceDto.csgGspProviderId, tx);
                const now = new Date();
                const data = {
                    csgCompanyId: saveGspCompanyServiceDto.csgCompanyId,
                    csgGspProviderId: saveGspCompanyServiceDto.csgGspProviderId,
                    csgServiceType,
                    csgEuserName,
                    csgEuserPassword,
                    csgCreatedOn: now,
                    csgCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspCompanyServiceDto, 'csgAuthToken')) {
                    data.csgAuthToken = csgAuthToken;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
                    data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspCompanyServiceDto, 'csgIsActive')) {
                    data.csgIsActive = saveGspCompanyServiceDto.csgIsActive;
                }
                const created = await tx.gspCompanyService.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
                    screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.csgCompanyServiceId,
                    displayName: this.buildDisplayName(created),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'GSP company service created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateGspCompanyService(saveGspCompanyServiceDto) {
        const csgCompanyServiceId = saveGspCompanyServiceDto.csgCompanyServiceId;
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.gspCompanyService.findFirst({
                    where: {
                        csgCompanyServiceId,
                        csgIsDeleted: false,
                    },
                });
                if (!existing) {
                    this.throwNotFound(csgCompanyServiceId);
                }
                const csgServiceType = this.normalizeRequiredString(saveGspCompanyServiceDto.csgServiceType, 'csgServiceType');
                const csgEuserName = this.normalizeRequiredString(saveGspCompanyServiceDto.csgEuserName, 'csgEuserName');
                const csgEuserPassword = this.normalizeRequiredString(saveGspCompanyServiceDto.csgEuserPassword, 'csgEuserPassword');
                const csgAuthToken = (0, module_service_utils_1.normalizeNullableString)(saveGspCompanyServiceDto.csgAuthToken);
                await this.ensureCompanyExists(saveGspCompanyServiceDto.csgCompanyId, tx);
                await this.ensureGspProviderExists(saveGspCompanyServiceDto.csgGspProviderId, tx);
                const data = {
                    csgCompanyId: saveGspCompanyServiceDto.csgCompanyId,
                    csgGspProviderId: saveGspCompanyServiceDto.csgGspProviderId,
                    csgServiceType,
                    csgEuserName,
                    csgEuserPassword,
                    csgModifiedOn: new Date(),
                    csgModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspCompanyServiceDto, 'csgAuthToken')) {
                    data.csgAuthToken = csgAuthToken;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
                    data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveGspCompanyServiceDto, 'csgIsActive')) {
                    data.csgIsActive = saveGspCompanyServiceDto.csgIsActive;
                }
                const updated = await tx.gspCompanyService.update({
                    where: {
                        csgCompanyServiceId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
                    screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: csgCompanyServiceId,
                    displayName: this.buildDisplayName(updated),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'GSP company service updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureCompanyExists(companyId, tx) {
        const company = await tx.company.findFirst({
            where: {
                compId: companyId,
                compIsDeleted: false,
            },
            select: {
                compId: true,
            },
        });
        if (!company) {
            this.throwBadRequest('Company does not exist', [
                {
                    field: 'csgCompanyId',
                    message: `No active company found with id ${companyId}`,
                },
            ]);
        }
    }
    async ensureGspProviderExists(gspProviderId, tx) {
        const provider = await tx.gspProviderMaster.findFirst({
            where: {
                gspProviderId,
                gspIsDeleted: false,
            },
            select: {
                gspProviderId: true,
            },
        });
        if (!provider) {
            this.throwBadRequest('GSP provider does not exist', [
                {
                    field: 'csgGspProviderId',
                    message: `No active GSP provider found with id ${gspProviderId}`,
                },
            ]);
        }
    }
    normalizeRequiredString(value, field) {
        return (0, module_service_utils_1.normalizeRequiredText)(value, field);
    }
    async loadProviderNameMap(providerIds) {
        const uniqueProviderIds = Array.from(new Set(providerIds.map((providerId) => providerId.trim()).filter(Boolean)));
        if (uniqueProviderIds.length === 0) {
            return new Map();
        }
        const providers = await this.prisma.gspProviderMaster.findMany({
            where: {
                gspProviderId: {
                    in: uniqueProviderIds,
                },
            },
            select: {
                gspProviderId: true,
                gspProviderName: true,
            },
        });
        return new Map(providers.map((provider) => [provider.gspProviderId, provider.gspProviderName]));
    }
    buildReferenceDisplay(name, id) {
        if (name && id) {
            return `${name} (${id})`;
        }
        if (name) {
            return name;
        }
        return id;
    }
    toPayload(record, providerName = null) {
        const companyName = 'company' in record ? (record.company?.compName ?? null) : null;
        return {
            csgCompanyServiceId: record.csgCompanyServiceId,
            csgCompanyId: record.csgCompanyId,
            companyName,
            companyDisplay: this.buildReferenceDisplay(companyName, record.csgCompanyId),
            csgGspProviderId: record.csgGspProviderId,
            providerName,
            providerDisplay: this.buildReferenceDisplay(providerName, record.csgGspProviderId),
            csgServiceType: record.csgServiceType,
            csgEuserName: record.csgEuserName,
            csgEuserPassword: record.csgEuserPassword,
            csgAuthToken: record.csgAuthToken,
            csgAuthTokenValidTill: record.csgAuthTokenValidTill
                ? record.csgAuthTokenValidTill.toISOString()
                : null,
            csgIsActive: record.csgIsActive,
            csgIsDeleted: record.csgIsDeleted,
            csgSyncDate: record.csgSyncDate ? record.csgSyncDate.toISOString() : null,
            csgCreatedOn: record.csgCreatedOn.toISOString(),
            csgCreatedBy: record.csgCreatedBy,
            csgModifiedOn: record.csgModifiedOn.toISOString(),
            csgModifiedBy: record.csgModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'GSP company service already exists', [
            {
                field: 'csgCompanyServiceId',
                message: 'Duplicate GSP company service unique value is not allowed',
            },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid company or provider reference', [
                {
                    field: 'csgCompanyId',
                    message: 'Referenced company or provider does not exist',
                },
            ]);
        }
    }
    throwNotFound(csgCompanyServiceId) {
        (0, module_service_utils_1.throwSettingsNotFound)('GSP company service not found', 'csgCompanyServiceId', `No active GSP company service found with id ${csgCompanyServiceId}`);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)(message, errors);
    }
    buildErrorResponse(message, errors = []) {
        return (0, module_service_utils_1.buildSettingsErrorResponse)(message, errors);
    }
    buildDisplayName(record) {
        return `${record.csgServiceType} (${record.csgEuserName})`;
    }
};
exports.GspCompanyServiceService = GspCompanyServiceService;
exports.GspCompanyServiceService = GspCompanyServiceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], GspCompanyServiceService);
//# sourceMappingURL=gsp-company-service.service.js.map