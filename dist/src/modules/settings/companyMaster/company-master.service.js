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
exports.CompanyMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const COMPANY_MASTER_TABLE_NAME = 'companys';
const COMPANY_MASTER_TABLE_SCHEMA = 'public';
const COMPANY_MASTER_AUDIT_SCREEN_NAME = 'Company Master';
const COMPANY_MASTER_OPTIONAL_FIELDS = [
    'compCode',
    'compShort',
    'compLegalName',
    'compGstinNo',
    'compGstRegType',
    'compPanNo',
    'compTanNo',
    'compCinNo',
    'compFssaiNo',
    'compDrugLicenseNo',
    'compAddr1',
    'compAddr2',
    'compAddr3',
    'compCity',
    'compDistrict',
    'compState',
    'compPin',
    'compCountry',
    'compRegionAddr1',
    'compRegionAddr2',
    'compRegionAddr3',
    'compRegionCity',
    'compRegionDistrict',
    'compRegionState',
    'compRegionCountry',
    'compRegionName',
    'compTel',
    'compPhone',
    'compMail',
    'compSupportEmail',
    'compSupportPhone',
    'compWebsiteName',
    'compFinYearFrom',
    'compFinYearTo',
    'compBooksBeginFrom',
    'compBooksLockDate',
    'compGstApplicable',
    'compTcsApplicable',
    'compSmsApplicable',
    'compEinvoiceApplicable',
    'compEwayApplicable',
    'compEwayDate',
    'compEwayInterLimit',
    'compEwayIntraApl',
    'compEwayIntraLimit',
    'compEinvoiceDate',
    'compEinvoiceInclEway',
    'compBankId',
    'compPriceFixing',
    'compPrefixCode',
    'compBillGreeting',
    'compNegStkApl',
    'compDefault',
    'compIsActive',
    'compCurrencyCode',
    'compCurrencySymbol',
    'compLocaleCode',
    'compRemarks',
    'compAuthorizeSignature',
];
let CompanyMasterService = class CompanyMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveCompanyMasterDto) {
        if (saveCompanyMasterDto.compId) {
            return this.updateCompany(saveCompanyMasterDto);
        }
        return this.createCompany(saveCompanyMasterDto);
    }
    async getById(compId) {
        const record = await this.prisma.company.findFirst({
            where: {
                compId,
                compIsDeleted: false,
            },
            include: {
                stylesheet: { select: { thmName: true } },
            },
        });
        if (!record) {
            this.throwNotFound(compId);
        }
        const bankLedger = record.compBankId
            ? await this.prisma.accLedgerMaster.findUnique({
                where: { ledId: record.compBankId },
                select: { ledName: true },
            })
            : null;
        return this.toPayload(record, {
            compStylesheetName: record.stylesheet?.thmName ?? null,
            compBankName: bankLedger?.ledName ?? null,
        });
    }
    async softDelete(compId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.company.findFirst({
                where: {
                    compId,
                    compIsDeleted: false,
                },
            });
            if (!existing) {
                this.throwNotFound(compId);
            }
            const modifiedOn = new Date();
            const result = await tx.company.updateMany({
                where: {
                    compId,
                    compIsDeleted: false,
                },
                data: {
                    compIsDeleted: true,
                    compIsActive: false,
                    compDefault: false,
                    compModifiedOn: modifiedOn,
                    compModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(compId);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                compIsDeleted: true,
                compIsActive: false,
                compDefault: false,
                compModifiedOn: modifiedOn,
                compModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: COMPANY_MASTER_TABLE_NAME,
                screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(compId),
                displayName: existing.compName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Company soft deleted',
            }, tx);
            return {
                compId,
                deleted: true,
            };
        });
    }
    async createCompany(saveCompanyMasterDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const compName = this.normalizeRequiredName(saveCompanyMasterDto.compName, 'compName');
                const compStateCode = this.normalizeLengthCode(saveCompanyMasterDto.compStateCode, 2, 'compStateCode');
                await this.ensureNameIsUnique(tx, compName);
                await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null);
                await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null);
                if (saveCompanyMasterDto.compDefault === true) {
                    await this.clearDefaultCompany(tx);
                }
                const now = new Date();
                const data = {
                    compName,
                    compStateCode,
                    compStylesheetId: saveCompanyMasterDto.compStylesheetId,
                    compCreatedOn: now,
                    compCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveCompanyMasterDto);
                const created = await tx.company.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: COMPANY_MASTER_TABLE_NAME,
                    screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: String(payload.compId),
                    displayName: payload.compName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Company created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateCompany(saveCompanyMasterDto) {
        const compId = saveCompanyMasterDto.compId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.company.findFirst({
                    where: {
                        compId,
                        compIsDeleted: false,
                    },
                });
                if (!existing) {
                    this.throwNotFound(compId);
                }
                const compName = this.normalizeRequiredName(saveCompanyMasterDto.compName, 'compName');
                const compStateCode = this.normalizeLengthCode(saveCompanyMasterDto.compStateCode, 2, 'compStateCode');
                await this.ensureNameIsUnique(tx, compName, compId);
                await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null, compId);
                await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null, compId);
                if (saveCompanyMasterDto.compDefault === true) {
                    await this.clearDefaultCompany(tx, compId);
                }
                const data = {
                    compName,
                    compStateCode,
                    compStylesheetId: saveCompanyMasterDto.compStylesheetId,
                    compModifiedOn: new Date(),
                    compModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveCompanyMasterDto);
                const updated = await tx.company.update({
                    where: {
                        compId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: COMPANY_MASTER_TABLE_NAME,
                    screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: String(compId),
                    displayName: payload.compName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Company updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureNameIsUnique(tx, compName, excludeCompId) {
        const existing = await tx.company.findFirst({
            where: {
                compName: {
                    equals: compName,
                    mode: 'insensitive',
                },
                ...(excludeCompId !== undefined
                    ? {
                        compId: {
                            not: excludeCompId,
                        },
                    }
                    : {}),
            },
            select: {
                compId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Company name already exists', [
                {
                    field: 'compName',
                    message: 'Duplicate compName is not allowed',
                },
            ]);
        }
    }
    async ensureCodeIsUnique(tx, compCode, excludeCompId) {
        if (!compCode) {
            return;
        }
        const existing = await tx.company.findFirst({
            where: {
                compCode: {
                    equals: compCode,
                    mode: 'insensitive',
                },
                ...(excludeCompId !== undefined
                    ? {
                        compId: {
                            not: excludeCompId,
                        },
                    }
                    : {}),
            },
            select: {
                compId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Company code already exists', [
                {
                    field: 'compCode',
                    message: 'Duplicate compCode is not allowed',
                },
            ]);
        }
    }
    async ensureGstinIsUnique(tx, compGstinNo, excludeCompId) {
        if (!compGstinNo) {
            return;
        }
        const existing = await tx.company.findFirst({
            where: {
                compGstinNo: {
                    equals: compGstinNo,
                    mode: 'insensitive',
                },
                ...(excludeCompId !== undefined
                    ? {
                        compId: {
                            not: excludeCompId,
                        },
                    }
                    : {}),
            },
            select: {
                compId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Company GSTIN already exists', [
                {
                    field: 'compGstinNo',
                    message: 'Duplicate compGstinNo is not allowed',
                },
            ]);
        }
    }
    async clearDefaultCompany(tx, excludeCompId) {
        await tx.company.updateMany({
            where: {
                compIsDeleted: false,
                compDefault: true,
                ...(excludeCompId !== undefined
                    ? {
                        compId: {
                            not: excludeCompId,
                        },
                    }
                    : {}),
            },
            data: {
                compDefault: false,
                compModifiedOn: new Date(),
                compModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            },
        });
    }
    applyOptionalFields(data, saveCompanyMasterDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveCompanyMasterDto, COMPANY_MASTER_OPTIONAL_FIELDS);
    }
    normalizeRequiredName(value, field) {
        return (0, module_service_utils_1.normalizeRequiredText)(value, field);
    }
    normalizeLengthCode(value, length, field) {
        const normalized = value.trim().toUpperCase();
        if (normalized.length !== length) {
            this.throwBadRequest('Validation failed', [
                {
                    field,
                    message: `${field} must be exactly ${length} characters`,
                },
            ]);
        }
        return normalized;
    }
    toPayload(record, related = {
        compStylesheetName: null,
        compBankName: null,
    }) {
        return {
            compId: record.compId,
            compCode: record.compCode,
            compName: record.compName,
            compShort: record.compShort,
            compLegalName: record.compLegalName,
            compGstinNo: record.compGstinNo,
            compGstRegType: record.compGstRegType,
            compPanNo: record.compPanNo,
            compTanNo: record.compTanNo,
            compCinNo: record.compCinNo,
            compFssaiNo: record.compFssaiNo,
            compDrugLicenseNo: record.compDrugLicenseNo,
            compAddr1: record.compAddr1,
            compAddr2: record.compAddr2,
            compAddr3: record.compAddr3,
            compCity: record.compCity,
            compDistrict: record.compDistrict,
            compState: record.compState,
            compStateCode: record.compStateCode,
            compPin: record.compPin,
            compCountry: record.compCountry,
            compRegionAddr1: record.compRegionAddr1,
            compRegionAddr2: record.compRegionAddr2,
            compRegionAddr3: record.compRegionAddr3,
            compRegionCity: record.compRegionCity,
            compRegionDistrict: record.compRegionDistrict,
            compRegionState: record.compRegionState,
            compRegionCountry: record.compRegionCountry,
            compRegionName: record.compRegionName,
            compTel: record.compTel,
            compPhone: record.compPhone,
            compMail: record.compMail,
            compSupportEmail: record.compSupportEmail,
            compSupportPhone: record.compSupportPhone,
            compWebsiteName: record.compWebsiteName,
            compFinYearFrom: record.compFinYearFrom ? record.compFinYearFrom.toISOString() : null,
            compFinYearTo: record.compFinYearTo ? record.compFinYearTo.toISOString() : null,
            compBooksBeginFrom: record.compBooksBeginFrom
                ? record.compBooksBeginFrom.toISOString()
                : null,
            compBooksLockDate: record.compBooksLockDate
                ? record.compBooksLockDate.toISOString()
                : null,
            compGstApplicable: record.compGstApplicable,
            compTcsApplicable: record.compTcsApplicable,
            compSmsApplicable: record.compSmsApplicable,
            compEinvoiceApplicable: record.compEinvoiceApplicable,
            compEwayApplicable: record.compEwayApplicable,
            compEwayDate: record.compEwayDate ? record.compEwayDate.toISOString() : null,
            compEwayInterLimit: (0, module_service_utils_1.toNullableNumber)(record.compEwayInterLimit),
            compEwayIntraApl: record.compEwayIntraApl,
            compEwayIntraLimit: (0, module_service_utils_1.toNumber)(record.compEwayIntraLimit),
            compEinvoiceDate: record.compEinvoiceDate ? record.compEinvoiceDate.toISOString() : null,
            compEinvoiceInclEway: record.compEinvoiceInclEway,
            compStylesheetId: record.compStylesheetId,
            compStylesheetName: related.compStylesheetName,
            compBankId: record.compBankId,
            compBankName: related.compBankName,
            compPriceFixing: record.compPriceFixing,
            compPrefixCode: record.compPrefixCode,
            compBillGreeting: record.compBillGreeting,
            compNegStkApl: record.compNegStkApl,
            compDefault: record.compDefault,
            compIsActive: record.compIsActive,
            compCurrencyCode: record.compCurrencyCode,
            compCurrencySymbol: record.compCurrencySymbol,
            compLocaleCode: record.compLocaleCode,
            compRemarks: record.compRemarks,
            compAuthorizeSignature: record.compAuthorizeSignature,
            compIsDeleted: record.compIsDeleted,
            compSyncDate: record.compSyncDate ? record.compSyncDate.toISOString() : null,
            compCreatedOn: record.compCreatedOn.toISOString(),
            compCreatedBy: record.compCreatedBy,
            compModifiedOn: record.compModifiedOn.toISOString(),
            compModifiedBy: record.compModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Company already exists', [
            {
                field: 'compName',
                message: 'Duplicate company unique value is not allowed',
            },
        ]);
    }
    throwNotFound(compId) {
        (0, module_service_utils_1.throwSettingsNotFound)('Company not found', 'compId', `No active company found with id ${compId}`);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)(message, errors);
    }
    buildErrorResponse(message, errors = []) {
        return (0, module_service_utils_1.buildSettingsErrorResponse)(message, errors);
    }
};
exports.CompanyMasterService = CompanyMasterService;
exports.CompanyMasterService = CompanyMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], CompanyMasterService);
//# sourceMappingURL=company-master.service.js.map