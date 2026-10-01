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
const master_tree_helper_1 = require("../../Inventory/utils/master-tree.helper");
const gst_registration_1 = require("../shared/gst-registration");
const COMPANY_MASTER_TABLE_NAME = 'companys';
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
    'compGstApplicable',
    'compTcsApplicable',
    'compTdsApplicable',
    'compAatoClass',
    'compDcPurposes',
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
];
const COMPANY_DELETE_REFERENCES = [
    {
        table: 'public.branch_master',
        column: 'br_comp_id',
        live: 'br_is_deleted = false',
        label: 'live branches',
    },
    {
        table: 'accounts.acc_ledger_master',
        column: 'led_company_id',
        live: 'led_is_deleted = false',
        label: 'live ledgers',
    },
    {
        table: 'accounts.acc_voucher_header',
        column: 'avh_company_id',
        live: 'true',
        label: 'vouchers',
    },
];
const SIGNATURE_MAX_BYTES = 512 * 1024;
const SIGNATURE_IMAGE_TYPES = [
    ['image/png', (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))],
    ['image/jpeg', (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
    ['image/gif', (b) => b.subarray(0, 4).toString('latin1') === 'GIF8'],
    [
        'image/webp',
        (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' &&
            b.subarray(8, 12).toString('latin1') === 'WEBP',
    ],
];
const utcDay = (year, monthIndex, day) => new Date(Date.UTC(year, monthIndex, day));
const sameDay = (date) => utcDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const aprilYearOf = (date) => date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
const isFirstApril = (date) => date.getUTCMonth() === 3 && date.getUTCDate() === 1;
const isThirtyFirstMarch = (date) => date.getUTCMonth() === 2 && date.getUTCDate() === 31;
const isoDay = (date) => date.toISOString().slice(0, 10);
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
        }, await this.currentYear(this.prisma, compId));
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
            await this.assertDeletable(tx, existing);
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
    async restore(compId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.company.findFirst({ where: { compId } });
            if (!existing) {
                (0, module_service_utils_1.throwSettingsNotFound)('Company not found', 'compId', `No company found with id ${compId}`);
            }
            if (!existing.compIsDeleted) {
                (0, module_service_utils_1.throwSettingsConflict)('Company is not deleted', [
                    {
                        field: 'compId',
                        message: `${existing.compName} is live; only a deleted company can be restored`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.company.updateMany({
                where: { compId, compIsDeleted: true },
                data: {
                    compIsDeleted: false,
                    compIsActive: true,
                    compModifiedOn: modifiedOn,
                    compModifiedBy: actor,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(compId);
            }
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: COMPANY_MASTER_TABLE_NAME,
                screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(compId),
                displayName: existing.compName,
                originalRecord: this.toPayload(existing),
                modifiedRecord: this.toPayload({
                    ...existing,
                    compIsDeleted: false,
                    compIsActive: true,
                    compModifiedOn: modifiedOn,
                    compModifiedBy: actor,
                }),
                userId: actor,
                notes: 'Company restored',
            }, tx);
            return { compId, deleted: false };
        });
    }
    async createCompany(saveCompanyMasterDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const compName = this.normalizeRequiredName(saveCompanyMasterDto.compName, 'compName');
                const compStateCode = this.normalizeLengthCode(saveCompanyMasterDto.compStateCode, 2, 'compStateCode');
                const year = this.resolveFirstYear(saveCompanyMasterDto);
                const panFromGstin = this.assertGstin(saveCompanyMasterDto.compGstinNo ?? null, compStateCode, saveCompanyMasterDto.compPanNo ?? null);
                const signature = this.normalizeSignature(saveCompanyMasterDto.compAuthorizeSignature);
                await this.ensureNameIsUnique(tx, compName);
                await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null);
                await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null);
                await this.ensureThemeIsLive(tx, saveCompanyMasterDto.compStylesheetId);
                if (saveCompanyMasterDto.compDefault === true) {
                    await this.clearDefaultCompany(tx);
                }
                const now = new Date();
                const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
                const data = {
                    compName,
                    compStateCode,
                    compStylesheetId: saveCompanyMasterDto.compStylesheetId,
                    compFinYearFrom: year.begin,
                    compFinYearTo: year.end,
                    compBooksBeginFrom: year.booksBegin,
                    compCreatedOn: now,
                    compCreatedBy: actor,
                };
                this.applyOptionalFields(data, saveCompanyMasterDto);
                if (panFromGstin) {
                    data.compPanNo = panFromGstin;
                }
                if (signature !== undefined) {
                    data.compAuthorizeSignature = signature;
                }
                const created = await tx.company.create({ data });
                const fiscalYear = await tx.fiscalYear.create({
                    data: {
                        compId: created.compId,
                        fyYearName: year.name,
                        fyBeginDate: year.begin,
                        fyEndDate: year.end,
                        fyBooksBeginDate: year.booksBegin,
                        fyStatus: 'OPEN',
                        fyIsCurrent: true,
                        createdBy: actor,
                        fyRemarks: 'Seeded on company create',
                    },
                });
                const payload = this.toPayload(created, undefined, fiscalYear);
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
                const panFromGstin = this.assertGstin(saveCompanyMasterDto.compGstinNo !== undefined
                    ? saveCompanyMasterDto.compGstinNo
                    : existing.compGstinNo, compStateCode, saveCompanyMasterDto.compPanNo !== undefined
                    ? saveCompanyMasterDto.compPanNo
                    : existing.compPanNo);
                const signature = this.normalizeSignature(saveCompanyMasterDto.compAuthorizeSignature);
                await this.ensureNameIsUnique(tx, compName, compId);
                await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null, compId);
                await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null, compId);
                if (saveCompanyMasterDto.compStylesheetId !== existing.compStylesheetId) {
                    await this.ensureThemeIsLive(tx, saveCompanyMasterDto.compStylesheetId);
                }
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
                if (panFromGstin) {
                    data.compPanNo = panFromGstin;
                }
                if (signature !== undefined) {
                    data.compAuthorizeSignature = signature;
                }
                const updated = await tx.company.update({
                    where: {
                        compId,
                    },
                    data,
                });
                const year = await this.currentYear(tx, compId);
                const payload = this.toPayload(updated, undefined, year);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: COMPANY_MASTER_TABLE_NAME,
                    screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: String(compId),
                    displayName: payload.compName,
                    originalRecord: this.toPayload(existing, undefined, year),
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
    }, year = null) {
        const finYearFrom = year ? year.fyBeginDate : record.compFinYearFrom;
        const finYearTo = year ? year.fyEndDate : record.compFinYearTo;
        const booksBeginFrom = year
            ? (year.fyBooksBeginDate ?? year.fyBeginDate)
            : record.compBooksBeginFrom;
        const booksLockDate = year ? year.fyLockDate : record.compBooksLockDate;
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
            compFinYearFrom: finYearFrom ? finYearFrom.toISOString() : null,
            compFinYearTo: finYearTo ? finYearTo.toISOString() : null,
            compBooksBeginFrom: booksBeginFrom ? booksBeginFrom.toISOString() : null,
            compBooksLockDate: booksLockDate ? booksLockDate.toISOString() : null,
            compGstApplicable: record.compGstApplicable,
            compTcsApplicable: record.compTcsApplicable,
            compTdsApplicable: record.compTdsApplicable,
            compAatoClass: record.compAatoClass,
            compDcPurposes: record.compDcPurposes,
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
    currentYear(client, compId) {
        return client.fiscalYear.findFirst({
            where: { compId, fyIsCurrent: true, isDeleted: false },
        });
    }
    async assertDeletable(tx, existing) {
        if (existing.compDefault) {
            (0, module_service_utils_1.throwSettingsConflict)('The default company cannot be deleted', [
                {
                    field: 'compId',
                    message: `${existing.compName} is the default company; make another company the default first`,
                },
            ]);
        }
        const used = (await (0, master_tree_helper_1.countLiveReferences)(tx, COMPANY_DELETE_REFERENCES, existing.compId)).filter((ref) => ref.count > 0);
        if (used.length) {
            (0, module_service_utils_1.throwSettingsConflict)('This company is still in use', [
                {
                    field: 'compId',
                    message: `Used by ${used.map((ref) => `${ref.count} ${ref.label}`).join(', ')}. ` +
                        'Delete those first; a deleted company would leave them under books nobody can open.',
                },
            ]);
        }
    }
    resolveFirstYear(dto) {
        const from = dto.compFinYearFrom ? sameDay(dto.compFinYearFrom) : null;
        const to = dto.compFinYearTo ? sameDay(dto.compFinYearTo) : null;
        const books = dto.compBooksBeginFrom ? sameDay(dto.compBooksBeginFrom) : null;
        if (from && !isFirstApril(from)) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'compFinYearFrom',
                    message: `A financial year begins on 1 April; compFinYearFrom is ${isoDay(from)}`,
                },
            ]);
        }
        if (to && !isThirtyFirstMarch(to)) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'compFinYearTo',
                    message: `A financial year ends on 31 March; compFinYearTo is ${isoDay(to)}`,
                },
            ]);
        }
        if (from && to && to.getUTCFullYear() !== from.getUTCFullYear() + 1) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'compFinYearTo',
                    message: `A year from ${isoDay(from)} ends on ${from.getUTCFullYear() + 1}-03-31; compFinYearTo is ${isoDay(to)}`,
                },
            ]);
        }
        const startYear = from
            ? from.getUTCFullYear()
            : to
                ? to.getUTCFullYear() - 1
                : aprilYearOf(books ?? this.todayInIndia());
        const begin = utcDay(startYear, 3, 1);
        const end = utcDay(startYear + 1, 2, 31);
        const booksBegin = books ?? begin;
        if (booksBegin < begin || booksBegin > end) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'compBooksBeginFrom',
                    message: `compBooksBeginFrom must fall inside the first year, ${isoDay(begin)} to ${isoDay(end)}`,
                },
            ]);
        }
        return { name: `${startYear}-${startYear + 1}`, begin, end, booksBegin };
    }
    todayInIndia() {
        const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
            .format(new Date())
            .split('-')
            .map(Number);
        return utcDay(year, month - 1, day);
    }
    assertGstin(gstin, stateCode, pan) {
        const check = (0, gst_registration_1.checkGstin)(gstin, stateCode, pan, {
            gstin: 'compGstinNo',
            stateCode: 'compStateCode',
            pan: 'compPanNo',
        });
        if (check.errors.length) {
            this.throwBadRequest('Validation failed', check.errors);
        }
        return check.panFromGstin;
    }
    normalizeSignature(value) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null || !value.trim()) {
            return null;
        }
        const field = 'compAuthorizeSignature';
        const dataUrl = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(value.trim());
        if (dataUrl && !dataUrl[2].split(';').includes('base64')) {
            this.throwBadRequest('Invalid signature image', [
                { field, message: `${field} must be base64-encoded` },
            ]);
        }
        const base64 = (dataUrl ? dataUrl[3] : value).replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
            this.throwBadRequest('Invalid signature image', [
                { field, message: `${field} must be valid base64 content` },
            ]);
        }
        const bytes = Buffer.from(base64, 'base64');
        if (bytes.length > SIGNATURE_MAX_BYTES) {
            this.throwBadRequest('Invalid signature image', [
                {
                    field,
                    message: `${field} must be at most ${SIGNATURE_MAX_BYTES / 1024} KB; this one is ${Math.ceil(bytes.length / 1024)} KB`,
                },
            ]);
        }
        const type = SIGNATURE_IMAGE_TYPES.find(([, isType]) => isType(bytes))?.[0];
        if (!type) {
            this.throwBadRequest('Invalid signature image', [
                { field, message: `${field} must be a PNG, JPEG, GIF or WebP image` },
            ]);
        }
        return `data:${type};base64,${bytes.toString('base64')}`;
    }
    throwNotFound(compId) {
        (0, module_service_utils_1.throwSettingsNotFound)('Company not found', 'compId', `No active company found with id ${compId}`);
    }
    async ensureThemeIsLive(tx, thmId) {
        if (thmId === null || thmId === undefined) {
            return;
        }
        const theme = await tx.appThemeMaster.findFirst({
            where: { thmId, thmIsActive: true, thmIsDeleted: false },
            select: { thmId: true },
        });
        if (!theme) {
            this.throwBadRequest('Validation failed', [
                { field: 'compStylesheetId', message: `theme ${thmId} is not active` },
            ]);
        }
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