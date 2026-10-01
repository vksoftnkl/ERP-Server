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
exports.BranchMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const master_tree_helper_1 = require("../../Inventory/utils/master-tree.helper");
const gst_registration_1 = require("../shared/gst-registration");
const BRANCH_MASTER_TABLE_NAME = 'branch master';
const BRANCH_MASTER_AUDIT_SCREEN_NAME = 'Branch Master';
const BRANCH_MASTER_OPTIONAL_FIELDS = [
    'brCode',
    'brMailingName',
    'brAlias',
    'brShort',
    'brType',
    'brIsDefault',
    'brIsActive',
    'brAddr1',
    'brAddr2',
    'brAddr3',
    'brCity',
    'brDistrict',
    'brState',
    'brPin',
    'brCountry',
    'brLandmark',
    'brRegionAddr1',
    'brRegionAddr2',
    'brRegionAddr3',
    'brRegionCity',
    'brRegionDistrict',
    'brRegionState',
    'brRegionCountry',
    'brRegionName',
    'brContactPerson',
    'brTel',
    'brPhone',
    'brMail',
    'brBillPrefix',
    'brInvoiceSeriesPrefix',
    'brBillGreeting',
    'brTerms',
    'brRoundingMode',
    'brRoundingValue',
    'brDefaultGodownId',
    'brPosType',
    'brAllowNegativeStock',
    'brSmsApplicable',
    'brBankId',
    'brFssaiNo',
    'brFssaiLicenseType',
    'brFssaiValidUpto',
    'brGstinNo',
    'brGstRegType',
    'brPanNo',
];
const BRANCH_IN_USE_REFERENCES = [
    {
        table: 'stock.stock_balance',
        column: 'sbl_branch_id',
        live: 'true',
        label: 'stock balance rows',
    },
    { table: 'stock.stock_ledger', column: 'sml_branch_id', live: 'true', label: 'stock movements' },
    { table: 'stock.stock_voucher', column: 'svh_branch_id', live: 'true', label: 'stock vouchers' },
    {
        table: 'stock.stock_voucher',
        column: 'svh_to_branch_id',
        live: 'true',
        label: 'stock vouchers sent to it',
    },
    {
        table: 'stock.stock_transit',
        column: 'stt_from_branch_id',
        live: 'true',
        label: 'transfers out',
    },
    { table: 'stock.stock_transit', column: 'stt_to_branch_id', live: 'true', label: 'transfers in' },
    { table: 'sales.sale_quotation', column: 'sq_branch_id', live: 'true', label: 'quotations' },
    { table: 'sales.sale_order', column: 'so_branch_id', live: 'true', label: 'sale orders' },
    { table: 'sales.sale_dc', column: 'sdc_branch_id', live: 'true', label: 'delivery challans' },
    { table: 'sales.sale_dc_return', column: 'sdr_branch_id', live: 'true', label: 'DC returns' },
    { table: 'sales.sale_bill', column: 'sb_branch_id', live: 'true', label: 'sale bills' },
    { table: 'sales.sale_return', column: 'sr_branch_id', live: 'true', label: 'sale returns' },
    {
        table: 'accounts.acc_voucher_header',
        column: 'avh_branch_id',
        live: 'true',
        label: 'vouchers',
    },
    {
        table: 'accounts.acc_opening_balance',
        column: 'op_branch_id',
        live: 'op_is_deleted = false',
        label: 'opening balances',
    },
    {
        table: 'public.user_master',
        column: 'usr_branch_id',
        live: 'usr_is_deleted = false',
        label: 'users',
    },
    {
        table: 'fixed.device_master',
        column: 'dev_branch_id',
        live: 'dev_is_deleted = false',
        label: 'devices',
    },
];
const describeUse = (used) => used.map((ref) => `${ref.count} ${ref.label}`).join(', ');
let BranchMasterService = class BranchMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveBranchMasterDto) {
        if (saveBranchMasterDto.brId) {
            return this.updateBranch(saveBranchMasterDto);
        }
        return this.createBranch(saveBranchMasterDto);
    }
    async getById(brId) {
        const record = await this.prisma.branchMaster.findFirst({
            where: {
                brId,
                brIsDeleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(brId);
        }
        const payload = this.toPayload(record);
        const relatedNames = await this.resolveRelatedNames(this.prisma, record);
        return { ...payload, ...relatedNames };
    }
    async softDelete(brId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.branchMaster.findFirst({
                where: {
                    brId,
                    brIsDeleted: false,
                },
            });
            if (!existing) {
                this.throwNotFound(brId);
            }
            await this.assertDeletable(tx, existing);
            const modifiedOn = new Date();
            const result = await tx.branchMaster.updateMany({
                where: {
                    brId,
                    brIsDeleted: false,
                },
                data: {
                    brIsDeleted: true,
                    brIsActive: false,
                    brModifiedOn: modifiedOn,
                    brModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(brId);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                brIsDeleted: true,
                brIsActive: false,
                brModifiedOn: modifiedOn,
                brModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: BRANCH_MASTER_TABLE_NAME,
                screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(brId),
                displayName: existing.brName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Branch soft deleted',
            }, tx);
            return {
                brId,
                deleted: true,
            };
        });
    }
    async restore(brId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.branchMaster.findFirst({ where: { brId } });
            if (!existing) {
                (0, module_service_utils_1.throwSettingsNotFound)('Branch not found', 'brId', `No branch found with id ${brId}`);
            }
            if (!existing.brIsDeleted) {
                (0, module_service_utils_1.throwSettingsConflict)('Branch is not deleted', [
                    {
                        field: 'brId',
                        message: `${existing.brName} is live; only a deleted branch can be restored`,
                    },
                ]);
            }
            const company = await tx.company.findFirst({
                where: { compId: existing.brCompId, compIsDeleted: false },
                select: { compId: true },
            });
            if (!company) {
                (0, module_service_utils_1.throwSettingsConflict)('The branch’s company is deleted', [
                    {
                        field: 'brCompId',
                        message: 'Restore the company first (POST /company-masters/restore)',
                    },
                ]);
            }
            await this.ensureNameIsUnique(tx, existing.brCompId, existing.brName, brId);
            const otherDefault = existing.brIsDefault
                ? await tx.branchMaster.findFirst({
                    where: {
                        brCompId: existing.brCompId,
                        brIsDeleted: false,
                        brIsDefault: true,
                        brId: { not: brId },
                    },
                    select: { brId: true },
                })
                : null;
            const modifiedOn = new Date();
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const restored = {
                brIsDeleted: false,
                brIsActive: true,
                brIsDefault: existing.brIsDefault && !otherDefault,
                brModifiedOn: modifiedOn,
                brModifiedBy: actor,
            };
            const result = await tx.branchMaster.updateMany({
                where: { brId, brIsDeleted: true },
                data: restored,
            });
            if (result.count === 0) {
                this.throwNotFound(brId);
            }
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: BRANCH_MASTER_TABLE_NAME,
                screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(brId),
                displayName: existing.brName,
                originalRecord: this.toPayload(existing),
                modifiedRecord: this.toPayload({ ...existing, ...restored }),
                userId: actor,
                notes: 'Branch restored',
            }, tx);
            return { brId, deleted: false };
        });
    }
    async createBranch(saveBranchMasterDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const normalizedName = this.normalizeRequiredName(saveBranchMasterDto.brName);
                const stateCode = this.normalizeStateCode(saveBranchMasterDto.brStateCode);
                const panFromGstin = this.assertGstin(saveBranchMasterDto.brGstinNo ?? null, stateCode, saveBranchMasterDto.brPanNo ?? null);
                await this.ensureCompanyExists(saveBranchMasterDto.brCompId, tx);
                await this.ensureNameIsUnique(tx, saveBranchMasterDto.brCompId, normalizedName);
                await this.ensureCodeIsUnique(tx, saveBranchMasterDto.brCode ?? null);
                if (saveBranchMasterDto.brIsDefault === true) {
                    await this.clearDefaultBranch(tx, saveBranchMasterDto.brCompId);
                }
                const now = new Date();
                const data = {
                    brCompId: saveBranchMasterDto.brCompId,
                    brName: normalizedName,
                    brStateCode: stateCode,
                    brCreatedOn: now,
                    brCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveBranchMasterDto);
                if (panFromGstin) {
                    data.brPanNo = panFromGstin;
                }
                const created = await tx.branchMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: BRANCH_MASTER_TABLE_NAME,
                    screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: String(payload.brId),
                    displayName: payload.brName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Branch created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateBranch(saveBranchMasterDto) {
        const brId = saveBranchMasterDto.brId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.branchMaster.findFirst({
                    where: {
                        brId,
                        brIsDeleted: false,
                    },
                });
                if (!existing) {
                    this.throwNotFound(brId);
                }
                const normalizedName = this.normalizeRequiredName(saveBranchMasterDto.brName);
                const stateCode = this.normalizeStateCode(saveBranchMasterDto.brStateCode);
                const panFromGstin = this.assertGstin(saveBranchMasterDto.brGstinNo !== undefined
                    ? saveBranchMasterDto.brGstinNo
                    : existing.brGstinNo, stateCode, saveBranchMasterDto.brPanNo !== undefined
                    ? saveBranchMasterDto.brPanNo
                    : existing.brPanNo);
                if (saveBranchMasterDto.brCompId !== existing.brCompId) {
                    await this.assertMayChangeCompany(tx, existing);
                }
                await this.ensureCompanyExists(saveBranchMasterDto.brCompId, tx);
                await this.ensureNameIsUnique(tx, saveBranchMasterDto.brCompId, normalizedName, brId);
                await this.ensureCodeIsUnique(tx, saveBranchMasterDto.brCode ?? null, brId);
                if (saveBranchMasterDto.brIsDefault === true) {
                    await this.clearDefaultBranch(tx, saveBranchMasterDto.brCompId, brId);
                }
                const data = {
                    brCompId: saveBranchMasterDto.brCompId,
                    brName: normalizedName,
                    brStateCode: stateCode,
                    brModifiedOn: new Date(),
                    brModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveBranchMasterDto);
                if (panFromGstin) {
                    data.brPanNo = panFromGstin;
                }
                const updated = await tx.branchMaster.update({
                    where: {
                        brId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: BRANCH_MASTER_TABLE_NAME,
                    screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: String(brId),
                    displayName: payload.brName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Branch updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async resolveRelatedNames(client, record) {
        const [company, bankLedger, godown] = await Promise.all([
            record.brCompId
                ? client.company.findFirst({
                    where: { compId: record.brCompId },
                    select: { compName: true },
                })
                : null,
            record.brBankId
                ? client.accLedgerMaster.findFirst({
                    where: { ledId: record.brBankId },
                    select: { ledName: true },
                })
                : null,
            record.brDefaultGodownId
                ? client.godownLocation.findFirst({
                    where: { gdlId: record.brDefaultGodownId },
                    select: { gdlName: true },
                })
                : null,
        ]);
        return {
            brCompName: company?.compName ?? null,
            brBankName: bankLedger?.ledName ?? null,
            brDefaultGodownName: godown?.gdlName ?? null,
        };
    }
    async ensureCompanyExists(compId, tx) {
        const company = await tx.company.findFirst({
            where: {
                compId,
                compIsDeleted: false,
            },
            select: {
                compId: true,
            },
        });
        if (!company) {
            this.throwBadRequest('Company does not exist', [
                {
                    field: 'compId',
                    message: `No active company found with id ${compId}`,
                },
            ]);
        }
    }
    async ensureNameIsUnique(tx, brCompId, brName, excludeBrId) {
        const existing = await tx.branchMaster.findFirst({
            where: {
                brCompId: brCompId,
                brIsDeleted: false,
                brName: {
                    equals: brName,
                    mode: 'insensitive',
                },
                ...(excludeBrId !== undefined
                    ? {
                        brId: {
                            not: excludeBrId,
                        },
                    }
                    : {}),
            },
            select: {
                brId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Branch name already exists for this company', [
                {
                    field: 'brName',
                    message: 'Duplicate brName is not allowed for this company',
                },
            ]);
        }
    }
    async ensureCodeIsUnique(tx, brCode, excludeBrId) {
        if (!brCode) {
            return;
        }
        const existing = await tx.branchMaster.findFirst({
            where: {
                brCode: {
                    equals: brCode,
                    mode: 'insensitive',
                },
                ...(excludeBrId !== undefined
                    ? {
                        brId: {
                            not: excludeBrId,
                        },
                    }
                    : {}),
            },
            select: {
                brId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsConflict)('Branch code already exists', [
                {
                    field: 'brCode',
                    message: 'Duplicate brCode is not allowed',
                },
            ]);
        }
    }
    async clearDefaultBranch(tx, compId, excludeBrId) {
        await tx.branchMaster.updateMany({
            where: {
                brCompId: compId,
                brIsDeleted: false,
                brIsDefault: true,
                ...(excludeBrId !== undefined
                    ? {
                        brId: {
                            not: excludeBrId,
                        },
                    }
                    : {}),
            },
            data: {
                brIsDefault: false,
                brModifiedOn: new Date(),
                brModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            },
        });
    }
    applyOptionalFields(data, saveBranchMasterDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveBranchMasterDto, BRANCH_MASTER_OPTIONAL_FIELDS);
    }
    normalizeRequiredName(name) {
        return (0, module_service_utils_1.normalizeRequiredText)(name, 'brName');
    }
    normalizeStateCode(stateCode) {
        const normalized = stateCode.trim().toUpperCase();
        if (normalized.length !== 2) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'brStateCode',
                    message: 'brStateCode must be exactly 2 characters',
                },
            ]);
        }
        return normalized;
    }
    toPayload(record) {
        return {
            brId: record.brId,
            brCompId: record.brCompId,
            brCode: record.brCode,
            brName: record.brName,
            brMailingName: record.brMailingName,
            brAlias: record.brAlias,
            brShort: record.brShort,
            brType: record.brType,
            brIsDefault: record.brIsDefault,
            brIsActive: record.brIsActive,
            brAddr1: record.brAddr1,
            brAddr2: record.brAddr2,
            brAddr3: record.brAddr3,
            brCity: record.brCity,
            brDistrict: record.brDistrict,
            brState: record.brState,
            brStateCode: record.brStateCode,
            brPin: record.brPin,
            brCountry: record.brCountry,
            brLandmark: record.brLandmark,
            brRegionAddr1: record.brRegionAddr1,
            brRegionAddr2: record.brRegionAddr2,
            brRegionAddr3: record.brRegionAddr3,
            brRegionCity: record.brRegionCity,
            brRegionDistrict: record.brRegionDistrict,
            brRegionState: record.brRegionState,
            brRegionCountry: record.brRegionCountry,
            brRegionName: record.brRegionName,
            brContactPerson: record.brContactPerson,
            brTel: record.brTel,
            brPhone: record.brPhone,
            brMail: record.brMail,
            brBillPrefix: record.brBillPrefix,
            brInvoiceSeriesPrefix: record.brInvoiceSeriesPrefix,
            brBillGreeting: record.brBillGreeting,
            brTerms: record.brTerms,
            brRoundingMode: record.brRoundingMode,
            brRoundingValue: (0, module_service_utils_1.toNullableNumber)(record.brRoundingValue),
            brDefaultGodownId: record.brDefaultGodownId,
            brPosType: record.brPosType,
            brAllowNegativeStock: record.brAllowNegativeStock,
            brSmsApplicable: record.brSmsApplicable,
            brBankId: record.brBankId,
            brFssaiNo: record.brFssaiNo,
            brFssaiLicenseType: record.brFssaiLicenseType,
            brFssaiValidUpto: record.brFssaiValidUpto ? record.brFssaiValidUpto.toISOString() : null,
            brGstinNo: record.brGstinNo,
            brGstRegType: record.brGstRegType,
            brPanNo: record.brPanNo,
            brIsDeleted: record.brIsDeleted,
            brSyncDate: record.brSyncDate ? record.brSyncDate.toISOString() : null,
            brCreatedOn: record.brCreatedOn.toISOString(),
            brCreatedBy: record.brCreatedBy,
            brModifiedOn: record.brModifiedOn.toISOString(),
            brModifiedBy: record.brModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Branch already exists', [
            {
                field: 'brCode',
                message: 'Duplicate branch unique value is not allowed',
            },
        ]);
    }
    async assertDeletable(tx, existing) {
        if (existing.brIsDefault) {
            const others = await tx.branchMaster.count({
                where: { brCompId: existing.brCompId, brIsDeleted: false, brId: { not: existing.brId } },
            });
            if (others > 0) {
                (0, module_service_utils_1.throwSettingsConflict)('The default branch cannot be deleted', [
                    {
                        field: 'brId',
                        message: `${existing.brName} is its company’s default branch; make another branch the default first`,
                    },
                ]);
            }
        }
        const used = await this.inUse(tx, existing.brId);
        if (used.length) {
            (0, module_service_utils_1.throwSettingsConflict)('This branch is still in use', [
                {
                    field: 'brId',
                    message: `Used by ${describeUse(used)}. A deleted branch would leave them under a ` +
                        'branch nobody can open.',
                },
            ]);
        }
    }
    async assertMayChangeCompany(tx, existing) {
        if (existing.brIsDefault) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'brCompId',
                    message: `${existing.brName} is its company’s default branch and cannot move to another company`,
                },
            ]);
        }
        const used = await this.inUse(tx, existing.brId);
        if (used.length) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'brCompId',
                    message: `${existing.brName} cannot move to another company: it has ${describeUse(used)}`,
                },
            ]);
        }
    }
    async inUse(tx, brId) {
        return (await (0, master_tree_helper_1.countLiveReferences)(tx, BRANCH_IN_USE_REFERENCES, brId)).filter((ref) => ref.count > 0);
    }
    assertGstin(gstin, stateCode, pan) {
        const check = (0, gst_registration_1.checkGstin)(gstin, stateCode, pan, {
            gstin: 'brGstinNo',
            stateCode: 'brStateCode',
            pan: 'brPanNo',
        });
        if (check.errors.length) {
            this.throwBadRequest('Validation failed', check.errors);
        }
        return check.panFromGstin;
    }
    throwNotFound(brId) {
        (0, module_service_utils_1.throwSettingsNotFound)('Branch not found', 'brId', `No active branch found with id ${brId}`);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)(message, errors);
    }
    buildErrorResponse(message, errors = []) {
        return (0, module_service_utils_1.buildSettingsErrorResponse)(message, errors);
    }
};
exports.BranchMasterService = BranchMasterService;
exports.BranchMasterService = BranchMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], BranchMasterService);
//# sourceMappingURL=branch-master.service.js.map