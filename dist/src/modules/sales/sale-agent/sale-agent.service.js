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
exports.SaleAgentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const account_ledger_masters_service_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const SALE_AGENT_RELATIONS = {
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
    group: { select: { saGrpName: true } },
};
const SALE_AGENT_TABLE_NAME = 'sale agents';
const SALE_AGENT_AUDIT_SCREEN_NAME = 'Sale Agent Master';
const SALE_AGENT_OPTIONAL_FIELDS = [
    'saAlias',
    'saMobile1',
    'saMobile2',
    'saAddr1',
    'saAddr2',
    'saCity',
    'saDistrict',
    'saState',
    'saPincode',
    'saPanNo',
    'saGstin',
    'saRemarks',
    'saIsActive',
];
const SALE_AGENT_TO_LEDGER_FIELD_MAP = [
    ['saAlias', 'ledAlias'],
    ['saMobile1', 'ledPhone1'],
    ['saMobile2', 'ledPhone2'],
    ['saAddr1', 'ledAddr1'],
    ['saAddr2', 'ledAddr2'],
    ['saCity', 'ledCity'],
    ['saDistrict', 'ledDistrict'],
    ['saState', 'ledStateName'],
    ['saPincode', 'ledPin'],
    ['saPanNo', 'ledPanNo'],
    ['saGstin', 'ledGstinNo'],
    ['saRemarks', 'ledRemarks'],
    ['saIsActive', 'ledIsActive'],
];
let SaleAgentService = class SaleAgentService {
    prisma;
    auditLogService;
    requestContextService;
    accountLedgerMastersService;
    constructor(prisma, auditLogService, requestContextService, accountLedgerMastersService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.accountLedgerMastersService = accountLedgerMastersService;
    }
    async save(saveSaleAgentDto) {
        if (saveSaleAgentDto.saId) {
            return this.updateSaleAgent(saveSaleAgentDto);
        }
        return this.createSaleAgent(saveSaleAgentDto);
    }
    async getById(saId) {
        const record = await this.prisma.saleAgent.findFirst({
            where: {
                saId,
                saIsDeleted: false,
            },
            include: SALE_AGENT_RELATIONS,
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Sale agent not found', 'saId', `No active sale agent found with id ${saId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(saId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.saleAgent.findFirst({
                where: {
                    saId,
                    saIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Sale agent not found', 'saId', `No active sale agent found with id ${saId}`);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const modifiedOn = new Date();
            const result = await tx.saleAgent.updateMany({
                where: {
                    saId,
                    saIsDeleted: false,
                },
                data: {
                    saIsDeleted: true,
                    saIsActive: false,
                    saModifiedOn: modifiedOn,
                    saModifiedBy: actor,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Sale agent not found', 'saId', `No active sale agent found with id ${saId}`);
            }
            await tx.accLedgerMaster.updateMany({
                where: { ledId: saId, ledIsDeleted: false },
                data: {
                    ledIsDeleted: true,
                    ledIsActive: false,
                    ledModifiedOn: modifiedOn,
                    ledModifiedBy: actor,
                },
            });
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                saIsDeleted: true,
                saIsActive: false,
                saModifiedOn: modifiedOn,
                saModifiedBy: actor,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: SALE_AGENT_TABLE_NAME,
                screenName: SALE_AGENT_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: saId,
                displayName: existing.saName,
                originalRecord,
                modifiedRecord,
                userId: actor,
                notes: 'Sale agent soft deleted',
            }, tx);
            return {
                saId,
                deleted: true,
            };
        });
    }
    async createSaleAgent(saveSaleAgentDto) {
        const now = new Date();
        const actor = (0, module_service_utils_1.resolveActor)(saveSaleAgentDto.saCreatedBy, this.requestContextService.getUserId());
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveSaleAgentDto.saName, 'saName');
        const normalizedCode = (0, module_service_utils_1.normalizeNullableString)(saveSaleAgentDto.saCode) ?? null;
        const companyId = saveSaleAgentDto.saCompanyId;
        const branchId = saveSaleAgentDto.saBranchId ?? null;
        const groupId = saveSaleAgentDto.saGroupId;
        const data = {
            saCompanyId: companyId,
            saBranchId: branchId,
            saGroupId: groupId,
            saCode: normalizedCode,
            saName: normalizedName,
            saCreatedOn: now,
            saCreatedBy: actor,
            saModifiedOn: now,
            saModifiedBy: actor,
        };
        this.applyOptionalFields(data, saveSaleAgentDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureCompanyExists(tx, companyId);
                await this.ensureBranchExists(tx, branchId);
                await this.ensureGroupExists(tx, groupId);
                await this.ensureNameIsUnique(tx, normalizedName, companyId);
                await this.ensureCodeIsUnique(tx, normalizedCode, companyId);
                const ledgerGroupId = await this.resolveAnyAccountGroupId(tx);
                const ledgerDto = this.buildLinkedLedgerDto(saveSaleAgentDto, {
                    name: normalizedName,
                    groupId: ledgerGroupId,
                    companyId,
                    branchId,
                });
                const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
                data.saId = ledger.ledId;
                const created = await tx.saleAgent.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: SALE_AGENT_TABLE_NAME,
                    screenName: SALE_AGENT_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.saId,
                    displayName: payload.saName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'Sale agent created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateSaleAgent(saveSaleAgentDto) {
        const saId = saveSaleAgentDto.saId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.saleAgent.findFirst({
                    where: {
                        saId,
                        saIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Sale agent not found', 'saId', `No active sale agent found with id ${saId}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveSaleAgentDto.saName, 'saName');
                const nextCompanyId = saveSaleAgentDto.saCompanyId;
                const nextGroupId = saveSaleAgentDto.saGroupId;
                const nextBranchId = (0, module_service_utils_1.hasOwnProperty)(saveSaleAgentDto, 'saBranchId')
                    ? (saveSaleAgentDto.saBranchId ?? null)
                    : existing.saBranchId;
                const nextCode = (0, module_service_utils_1.hasOwnProperty)(saveSaleAgentDto, 'saCode')
                    ? ((0, module_service_utils_1.normalizeNullableString)(saveSaleAgentDto.saCode) ?? null)
                    : existing.saCode;
                await this.ensureCompanyExists(tx, nextCompanyId);
                await this.ensureBranchExists(tx, nextBranchId);
                await this.ensureGroupExists(tx, nextGroupId);
                await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, saId);
                await this.ensureCodeIsUnique(tx, nextCode, nextCompanyId, saId);
                const data = {
                    saCompanyId: nextCompanyId,
                    saBranchId: nextBranchId,
                    saGroupId: nextGroupId,
                    saCode: nextCode,
                    saName: normalizedName,
                    saModifiedOn: new Date(),
                    saModifiedBy: (0, module_service_utils_1.resolveActor)(saveSaleAgentDto.saModifiedBy, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveSaleAgentDto);
                const updated = await tx.saleAgent.update({
                    where: {
                        saId,
                    },
                    data,
                });
                const linkedLedger = await tx.accLedgerMaster.findFirst({
                    where: { ledId: saId, ledIsDeleted: false },
                    select: { ledId: true, ledName: true, ledGroupId: true },
                });
                if (linkedLedger) {
                    const ledgerDto = this.buildLinkedLedgerDto(saveSaleAgentDto, {
                        name: normalizedName,
                        groupId: linkedLedger.ledGroupId,
                        companyId: nextCompanyId,
                        branchId: nextBranchId,
                    });
                    ledgerDto.ledId = saId;
                    try {
                        await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
                    }
                    catch (error) {
                        if (error instanceof common_1.ConflictException) {
                            (0, module_service_utils_1.throwSalesConflict)('Sale agent name already exists for this company', [
                                {
                                    field: 'saName',
                                    message: 'Duplicate sale agent name is not allowed for this company',
                                },
                            ]);
                        }
                        throw error;
                    }
                }
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: SALE_AGENT_TABLE_NAME,
                    screenName: SALE_AGENT_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: saId,
                    displayName: payload.saName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.saModifiedBy ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Sale agent updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureCompanyExists(tx, companyId) {
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
            (0, module_service_utils_1.throwSalesBadRequest)('Company does not exist', [
                {
                    field: 'saCompanyId',
                    message: `No active company found with id ${companyId}`,
                },
            ]);
        }
    }
    async ensureBranchExists(tx, branchId) {
        if (branchId === null) {
            return;
        }
        const branch = await tx.branchMaster.findFirst({
            where: {
                brId: branchId,
                brIsDeleted: false,
            },
            select: {
                brId: true,
            },
        });
        if (!branch) {
            (0, module_service_utils_1.throwSalesBadRequest)('Branch does not exist', [
                {
                    field: 'saBranchId',
                    message: `No active branch found with id ${branchId}`,
                },
            ]);
        }
    }
    async ensureGroupExists(tx, groupId) {
        const group = await tx.saleAgentGroup.findFirst({
            where: {
                saGrpId: groupId,
                saGrpIsDeleted: false,
            },
            select: {
                saGrpId: true,
            },
        });
        if (!group) {
            (0, module_service_utils_1.throwSalesBadRequest)('Sale agent group does not exist', [
                {
                    field: 'saGroupId',
                    message: `No active sale agent group found with id ${groupId}`,
                },
            ]);
        }
    }
    async ensureNameIsUnique(tx, agentName, companyId, excludeId) {
        const existing = await tx.saleAgent.findFirst({
            where: {
                saIsDeleted: false,
                saCompanyId: companyId,
                saName: {
                    equals: agentName,
                    mode: 'insensitive',
                },
                ...(excludeId
                    ? {
                        saId: {
                            not: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                saId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSalesConflict)('Sale agent name already exists for this company', [
                {
                    field: 'saName',
                    message: 'Duplicate sale agent name is not allowed for this company',
                },
            ]);
        }
    }
    async ensureCodeIsUnique(tx, agentCode, companyId, excludeId) {
        if (agentCode === null) {
            return;
        }
        const existing = await tx.saleAgent.findFirst({
            where: {
                saIsDeleted: false,
                saCompanyId: companyId,
                saCode: {
                    equals: agentCode,
                    mode: 'insensitive',
                },
                ...(excludeId
                    ? {
                        saId: {
                            not: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                saId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSalesConflict)('Sale agent code already exists for this company', [
                {
                    field: 'saCode',
                    message: 'Duplicate sale agent code is not allowed for this company',
                },
            ]);
        }
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Sale agent already exists', [
            {
                field: 'saName',
                message: 'Duplicate sale agent is not allowed',
            },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    message: 'Referenced company, branch or sale agent group does not exist',
                },
            ]);
        }
    }
    applyOptionalFields(data, saveSaleAgentDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveSaleAgentDto, SALE_AGENT_OPTIONAL_FIELDS);
    }
    async resolveAnyAccountGroupId(tx) {
        const group = await tx.accountGroup.findFirst({
            where: { accGroupIsDeleted: false },
            select: { accGroupId: true },
        });
        if (!group) {
            (0, module_service_utils_1.throwSalesBadRequest)('No account group available', [
                {
                    field: 'request',
                    message: 'At least one account group must exist to provision the sale agent ledger',
                },
            ]);
        }
        return group.accGroupId;
    }
    buildLinkedLedgerDto(saveSaleAgentDto, resolved) {
        const ledgerDto = {
            ledGroupId: resolved.groupId,
            ledName: resolved.name,
        };
        const ledgerRecord = ledgerDto;
        ledgerRecord.ledCompanyId = resolved.companyId;
        ledgerRecord.ledBranchId = resolved.branchId;
        const dtoRecord = saveSaleAgentDto;
        for (const [saField, ledField] of SALE_AGENT_TO_LEDGER_FIELD_MAP) {
            if ((0, module_service_utils_1.hasOwnProperty)(saveSaleAgentDto, saField)) {
                ledgerRecord[ledField] = dtoRecord[saField];
            }
        }
        return ledgerDto;
    }
    toPayload(record) {
        return {
            saId: record.saId,
            saCompanyId: record.saCompanyId,
            saCompanyName: 'company' in record ? (record.company?.compName ?? null) : null,
            saBranchId: record.saBranchId,
            saBranchName: 'branch' in record ? (record.branch?.brName ?? null) : null,
            saGroupId: record.saGroupId,
            saGroupName: 'group' in record ? (record.group?.saGrpName ?? null) : null,
            saCode: record.saCode,
            saName: record.saName,
            saAlias: record.saAlias,
            saMobile1: record.saMobile1,
            saMobile2: record.saMobile2,
            saAddr1: record.saAddr1,
            saAddr2: record.saAddr2,
            saCity: record.saCity,
            saDistrict: record.saDistrict,
            saState: record.saState,
            saPincode: record.saPincode,
            saPanNo: record.saPanNo,
            saGstin: record.saGstin,
            saRemarks: record.saRemarks,
            saIsActive: record.saIsActive,
            saIsDeleted: record.saIsDeleted,
            saSyncDate: record.saSyncDate ? record.saSyncDate.toISOString() : null,
            saCreatedOn: record.saCreatedOn.toISOString(),
            saCreatedBy: record.saCreatedBy,
            saModifiedOn: record.saModifiedOn.toISOString(),
            saModifiedBy: record.saModifiedBy,
        };
    }
};
exports.SaleAgentService = SaleAgentService;
exports.SaleAgentService = SaleAgentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        account_ledger_masters_service_1.AccountLedgerMastersService])
], SaleAgentService);
//# sourceMappingURL=sale-agent.service.js.map