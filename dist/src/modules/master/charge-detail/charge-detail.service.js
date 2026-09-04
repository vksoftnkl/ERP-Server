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
exports.ChargeDetailService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const charge_detail_api_types_1 = require("./types/charge-detail-api.types");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const CHARGE_DETAIL_TABLE_NAME = 'sale charge detail';
const CHARGE_DETAIL_AUDIT_SCREEN_NAME = 'Charge Detail';
const CHARGE_DETAIL_AUDIT = {
    tableName: CHARGE_DETAIL_TABLE_NAME,
    screenName: CHARGE_DETAIL_AUDIT_SCREEN_NAME,
    entityName: 'Charge line',
};
const CHARGE_DETAIL_OPTIONAL_FIELDS = [
    'cdChgName',
    'cdRole',
    'cdMethod',
    'cdType',
    'cdApplyOn',
    'cdLandingCost',
    'cdCostAlloc',
    'cdBeforeTax',
    'cdTaxApl',
    'cdSepPost',
    'cdUnit',
    'cdQtyVal',
    'cdWeight',
    'cdRate',
    'cdAmount',
    'cdTaxCode',
    'cdHsn',
    'cdTaxPerc',
    'cdTaxAmt',
    'cdSgstPerc',
    'cdSgstAmt',
    'cdCgstPerc',
    'cdCgstAmt',
    'cdIgstPerc',
    'cdIgstAmt',
    'cdCessPerc',
    'cdCessAmt',
    'cdNetAmt',
    'cdRemarks',
    'cdIsActive',
];
let ChargeDetailService = class ChargeDetailService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveChargeDetailDto) {
        if (saveChargeDetailDto.cdId) {
            return this.updateChargeDetail(saveChargeDetailDto);
        }
        return this.createChargeDetail(saveChargeDetailDto);
    }
    async get(getChargeDetailQueryDto) {
        const { cdId, cdDocType, cdDocId, isActive } = getChargeDetailQueryDto;
        if (cdId && (cdDocType || cdDocId)) {
            (0, module_service_utils_1.throwMasterBadRequest)('Ambiguous charge line lookup', [
                { field: 'cdId', message: 'Send either cdId or the cdDocType + cdDocId pair, not both' },
            ]);
        }
        if (cdId) {
            return this.getById(cdId);
        }
        if (cdDocType && cdDocId) {
            return this.getByDocument(cdDocType, cdDocId, isActive);
        }
        (0, module_service_utils_1.throwMasterBadRequest)('Missing charge line lookup', [
            {
                field: 'cdId',
                message: 'Either cdId, or both cdDocType and cdDocId, is required',
            },
        ]);
    }
    async getById(cdId) {
        const record = await this.prisma.transactionChargeDetail.findFirst({
            where: { cdId, cdIsDeleted: false },
            include: { ledger: { select: { ledName: true } } },
        });
        if (!record) {
            this.throwNotFound(cdId);
        }
        return this.toPayload(record);
    }
    async getByDocument(cdDocType, cdDocId, isActive) {
        const records = await this.prisma.transactionChargeDetail.findMany({
            where: {
                cdDocType,
                cdDocId,
                cdIsDeleted: false,
                ...(isActive === undefined ? {} : { cdIsActive: isActive }),
            },
            include: { ledger: { select: { ledName: true } } },
            orderBy: [{ cdSlno: { sort: 'asc', nulls: 'last' } }, { cdCreatedOn: 'asc' }],
        });
        return records.map((record) => this.toPayload(record));
    }
    async softDelete(cdId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.transactionChargeDetail.findFirst({
                where: { cdId, cdIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(cdId);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const modifiedOn = new Date();
            const result = await tx.transactionChargeDetail.updateMany({
                where: { cdId, cdIsDeleted: false },
                data: {
                    cdIsDeleted: true,
                    cdIsActive: false,
                    cdModifiedOn: modifiedOn,
                    cdModifiedBy: actor,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(cdId);
            }
            const modifiedRecord = this.toPayload({
                ...existing,
                cdIsDeleted: true,
                cdIsActive: false,
                cdModifiedOn: modifiedOn,
                cdModifiedBy: actor,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: CHARGE_DETAIL_TABLE_NAME,
                screenName: CHARGE_DETAIL_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: cdId,
                displayName: this.displayName(existing),
                originalRecord: this.toPayload(existing),
                modifiedRecord,
                userId: actor,
                notes: 'Charge line soft deleted',
            }, tx);
            return { cdId, deleted: true };
        });
    }
    async syncDocumentCharges(tx, scope, inputCharges, actorId, audit = CHARGE_DETAIL_AUDIT) {
        const existing = await this.findDocumentCharges(tx, scope.cdDocType, scope.cdDocId);
        if (inputCharges === undefined) {
            return existing.map((record) => this.toPayload(record));
        }
        const existingMap = new Map(existing.map((charge) => [charge.cdId, charge]));
        const keptIds = new Set();
        const seenSlnos = new Set();
        const now = new Date();
        const persisted = [];
        for (const [index, inputCharge] of inputCharges.entries()) {
            const slno = inputCharge.cdSlno ?? index + 1;
            if (seenSlnos.has(slno)) {
                (0, module_service_utils_1.throwMasterConflict)('Duplicate charge line number', [
                    {
                        field: 'cdSlno',
                        message: `A charge line with number ${slno} already exists on this document`,
                    },
                ]);
            }
            seenSlnos.add(slno);
            const existingCharge = inputCharge.cdId ? existingMap.get(inputCharge.cdId) : undefined;
            if (inputCharge.cdId && !existingCharge) {
                this.throwNotFound(inputCharge.cdId);
            }
            this.ensureDocumentMatchesScope(inputCharge, scope);
            this.ensureValuesAreAllowed(inputCharge, existingCharge, scope.cdDocType);
            if (existingCharge) {
                persisted.push(await this.updateChargeLine(tx, existingCharge, inputCharge, slno, actorId, now, audit));
                keptIds.add(existingCharge.cdId);
                continue;
            }
            const created = await this.insertChargeLine(tx, scope, inputCharge, slno, actorId, now, audit);
            keptIds.add(created.cdId);
            persisted.push(created);
        }
        for (const removed of existing.filter((charge) => !keptIds.has(charge.cdId))) {
            await this.softDeleteChargeLine(tx, removed, actorId, now, audit);
        }
        return persisted.sort((left, right) => (left.cdSlno ?? 0) - (right.cdSlno ?? 0));
    }
    findDocumentCharges(client, cdDocType, cdDocId) {
        return client.transactionChargeDetail.findMany({
            where: { cdDocType, cdDocId, cdIsDeleted: false },
            include: { ledger: { select: { ledName: true } } },
            orderBy: { cdSlno: 'asc' },
        });
    }
    async softDeleteDocumentCharges(tx, cdDocType, cdDocId, actorId, modifiedOn = new Date()) {
        await tx.transactionChargeDetail.updateMany({
            where: { cdDocType, cdDocId, cdIsDeleted: false },
            data: {
                cdIsDeleted: true,
                cdIsActive: false,
                cdModifiedOn: modifiedOn,
                cdModifiedBy: actorId,
            },
        });
    }
    async createChargeDetail(saveChargeDetailDto) {
        const now = new Date();
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const docType = this.requireField(saveChargeDetailDto.cdDocType, 'cdDocType');
        const docId = this.requireField(saveChargeDetailDto.cdDocId, 'cdDocId');
        this.requireField(saveChargeDetailDto.cdChgId, 'cdChgId');
        this.requireField(saveChargeDetailDto.cdLedgerCode, 'cdLedgerCode');
        const scope = {
            cdDocType: docType,
            cdDocId: docId,
            cdCompId: this.requireField(saveChargeDetailDto.cdCompId, 'cdCompId'),
            cdBranchId: this.requireField(saveChargeDetailDto.cdBranchId, 'cdBranchId'),
            cdAccYear: (0, module_service_utils_1.normalizeRequiredText)(this.requireField(saveChargeDetailDto.cdAccYear, 'cdAccYear'), 'cdAccYear'),
            cdVoucherNo: null,
        };
        this.ensureValuesAreAllowed(saveChargeDetailDto, undefined, docType);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const slno = await this.resolveSlno(tx, docType, docId, saveChargeDetailDto.cdSlno ?? null);
                return this.insertChargeLine(tx, scope, saveChargeDetailDto, slno, actor, now, CHARGE_DETAIL_AUDIT);
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateChargeDetail(saveChargeDetailDto) {
        const cdId = saveChargeDetailDto.cdId;
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.transactionChargeDetail.findFirst({
                    where: { cdId, cdIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound(cdId);
                }
                this.ensureDocumentIsUnchanged(saveChargeDetailDto, existing);
                this.ensureValuesAreAllowed(saveChargeDetailDto, existing, existing.cdDocType);
                const slno = saveChargeDetailDto.cdSlno === undefined
                    ? existing.cdSlno
                    : await this.resolveSlno(tx, existing.cdDocType, existing.cdDocId, saveChargeDetailDto.cdSlno, cdId);
                return this.updateChargeLine(tx, existing, saveChargeDetailDto, slno, actor, new Date(), CHARGE_DETAIL_AUDIT);
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async insertChargeLine(tx, scope, saveChargeDetailDto, slno, actorId, now, audit) {
        const chgId = this.requireField(saveChargeDetailDto.cdChgId, 'cdChgId');
        const ledgerCode = this.requireField(saveChargeDetailDto.cdLedgerCode, 'cdLedgerCode');
        const ledgerName = await this.ensureLedgerExists(tx, ledgerCode);
        await this.ensureChargeExists(tx, chgId);
        const data = {
            cdDocType: scope.cdDocType,
            cdDocId: scope.cdDocId,
            cdSlno: slno,
            cdCompId: saveChargeDetailDto.cdCompId ?? scope.cdCompId,
            cdBranchId: saveChargeDetailDto.cdBranchId ?? scope.cdBranchId,
            cdAccYear: saveChargeDetailDto.cdAccYear === undefined
                ? scope.cdAccYear
                : (0, module_service_utils_1.normalizeRequiredText)(saveChargeDetailDto.cdAccYear, 'cdAccYear'),
            cdVoucherNo: saveChargeDetailDto.cdVoucherNo === undefined
                ? scope.cdVoucherNo
                : this.toVoucherNo(saveChargeDetailDto.cdVoucherNo),
            cdChgId: chgId,
            cdLedgerCode: ledgerCode,
            cdCreatedOn: now,
            cdCreatedBy: (0, module_service_utils_1.resolveActor)(saveChargeDetailDto.cdCreatedBy, actorId),
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveChargeDetailDto, CHARGE_DETAIL_OPTIONAL_FIELDS);
        const created = await tx.transactionChargeDetail.create({ data });
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: audit.tableName,
            screenName: audit.screenName,
            screenType: 'transaction',
            pk: created.cdId,
            displayName: this.displayName(created),
            originalRecord: null,
            modifiedRecord: this.toPayload(created),
            userId: created.cdCreatedBy ?? actorId,
            notes: `${audit.entityName} created`,
        }, tx);
        return this.toPayload(created, ledgerName);
    }
    async updateChargeLine(tx, existing, saveChargeDetailDto, slno, actorId, now, audit) {
        const nextLedgerCode = saveChargeDetailDto.cdLedgerCode ?? existing.cdLedgerCode;
        const nextChgId = saveChargeDetailDto.cdChgId ?? existing.cdChgId;
        const ledgerName = await this.ensureLedgerExists(tx, nextLedgerCode);
        if (nextChgId !== existing.cdChgId) {
            await this.ensureChargeExists(tx, nextChgId);
        }
        const data = {
            cdSlno: slno,
            cdChgId: nextChgId,
            cdLedgerCode: nextLedgerCode,
            cdModifiedOn: now,
            cdModifiedBy: (0, module_service_utils_1.resolveActor)(saveChargeDetailDto.cdModifiedBy, actorId),
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveChargeDetailDto, CHARGE_DETAIL_OPTIONAL_FIELDS);
        if (saveChargeDetailDto.cdCompId !== undefined) {
            data.cdCompId = saveChargeDetailDto.cdCompId;
        }
        if (saveChargeDetailDto.cdBranchId !== undefined) {
            data.cdBranchId = saveChargeDetailDto.cdBranchId;
        }
        if (saveChargeDetailDto.cdAccYear !== undefined) {
            data.cdAccYear = (0, module_service_utils_1.normalizeRequiredText)(saveChargeDetailDto.cdAccYear, 'cdAccYear');
        }
        if (saveChargeDetailDto.cdVoucherNo !== undefined) {
            data.cdVoucherNo = this.toVoucherNo(saveChargeDetailDto.cdVoucherNo);
        }
        const updated = await tx.transactionChargeDetail.update({
            where: { cdId_cdAccYear: { cdId: existing.cdId, cdAccYear: existing.cdAccYear } },
            data,
        });
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: audit.tableName,
            screenName: audit.screenName,
            screenType: 'transaction',
            pk: existing.cdId,
            displayName: this.displayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(updated),
            userId: (0, module_service_utils_1.resolveActor)(saveChargeDetailDto.cdModifiedBy, actorId),
            notes: `${audit.entityName} updated`,
        }, tx);
        return this.toPayload(updated, ledgerName);
    }
    async softDeleteChargeLine(tx, existing, actorId, now, audit) {
        const deleted = await tx.transactionChargeDetail.update({
            where: { cdId_cdAccYear: { cdId: existing.cdId, cdAccYear: existing.cdAccYear } },
            data: {
                cdIsDeleted: true,
                cdIsActive: false,
                cdModifiedOn: now,
                cdModifiedBy: actorId,
            },
        });
        await this.auditLogService.logEntityChange({
            action: 'cancel',
            tableName: audit.tableName,
            screenName: audit.screenName,
            screenType: 'transaction',
            pk: existing.cdId,
            displayName: this.displayName(existing),
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(deleted),
            userId: actorId,
            notes: `${audit.entityName} soft deleted`,
        }, tx);
    }
    ensureDocumentIsUnchanged(saveChargeDetailDto, existing) {
        const details = [];
        const storedDocType = existing.cdDocType;
        if (saveChargeDetailDto.cdDocType && saveChargeDetailDto.cdDocType !== storedDocType) {
            details.push({
                field: 'cdDocType',
                message: `cdDocType cannot be changed (stored value is ${existing.cdDocType})`,
            });
        }
        if (saveChargeDetailDto.cdDocId && saveChargeDetailDto.cdDocId !== existing.cdDocId) {
            details.push({
                field: 'cdDocId',
                message: 'cdDocId cannot be changed; delete the line and create it on the other document',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwMasterBadRequest)('Charge line document is immutable', details);
        }
    }
    ensureDocumentMatchesScope(saveChargeDetailDto, scope) {
        const details = [];
        if (saveChargeDetailDto.cdDocType && saveChargeDetailDto.cdDocType !== scope.cdDocType) {
            details.push({
                field: 'cdDocType',
                message: `cdDocType must be ${scope.cdDocType} on this document`,
            });
        }
        if (saveChargeDetailDto.cdDocId && saveChargeDetailDto.cdDocId !== scope.cdDocId) {
            details.push({
                field: 'cdDocId',
                message: 'cdDocId must be the parent document; a charge line cannot be moved off it',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwMasterBadRequest)('Charge line document is immutable', details);
        }
    }
    async ensureLedgerExists(tx, ledgerCode) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: { ledId: ledgerCode, ledIsDeleted: false },
            select: { ledName: true },
        });
        if (!ledger) {
            (0, module_service_utils_1.throwMasterBadRequest)('Ledger does not exist', [
                { field: 'cdLedgerCode', message: `No active ledger found with id ${ledgerCode}` },
            ]);
        }
        return ledger.ledName;
    }
    async ensureChargeExists(tx, chgId) {
        const charge = await tx.chargeMaster.findFirst({
            where: { chgId, chgIsDeleted: false },
            select: { chgId: true },
        });
        if (!charge) {
            (0, module_service_utils_1.throwMasterBadRequest)('Charge does not exist', [
                { field: 'cdChgId', message: `No active charge found with id ${chgId}` },
            ]);
        }
    }
    async resolveSlno(tx, docType, docId, requested, excludeId) {
        if (requested === null) {
            const highest = await tx.transactionChargeDetail.aggregate({
                where: { cdDocType: docType, cdDocId: docId, cdIsDeleted: false },
                _max: { cdSlno: true },
            });
            return (highest._max.cdSlno ?? 0) + 1;
        }
        const clash = await tx.transactionChargeDetail.findFirst({
            where: {
                cdDocType: docType,
                cdDocId: docId,
                cdSlno: requested,
                cdIsDeleted: false,
                ...(excludeId ? { cdId: { not: excludeId } } : {}),
            },
            select: { cdId: true },
        });
        if (clash) {
            (0, module_service_utils_1.throwMasterConflict)('Duplicate charge line number', [
                {
                    field: 'cdSlno',
                    message: `A charge line with number ${requested} already exists on this document`,
                },
            ]);
        }
        return requested;
    }
    ensureValuesAreAllowed(saveChargeDetailDto, existing, docType) {
        const values = {
            cdDocType: docType,
            cdRole: saveChargeDetailDto.cdRole,
            cdMethod: saveChargeDetailDto.cdMethod,
            cdType: saveChargeDetailDto.cdType,
            cdApplyOn: saveChargeDetailDto.cdApplyOn,
            cdCostAlloc: saveChargeDetailDto.cdCostAlloc,
        };
        const details = [];
        for (const guard of charge_detail_api_types_1.CHARGE_DETAIL_VALUE_GUARDS) {
            const value = values[guard.field];
            if (value === undefined) {
                continue;
            }
            if (value === null) {
                if (!guard.nullable) {
                    details.push({ field: guard.field, message: `${guard.field} is required` });
                }
                continue;
            }
            if (!guard.allowed.includes(value)) {
                details.push({
                    field: guard.field,
                    message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
                });
            }
        }
        const taxApl = saveChargeDetailDto.cdTaxApl ?? existing?.cdTaxApl ?? false;
        const beforeTax = saveChargeDetailDto.cdBeforeTax ?? existing?.cdBeforeTax ?? false;
        if (taxApl && beforeTax) {
            details.push({
                field: 'cdTaxApl',
                message: 'cdTaxApl and cdBeforeTax are mutually exclusive: a charge is either taxed at the item rate or carries its own GST',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwMasterBadRequest)('Invalid charge line value', details);
        }
    }
    requireField(value, field) {
        if (!value) {
            (0, module_service_utils_1.throwMasterBadRequest)(`${field} is required`, [
                { field, message: `${field} must be provided when creating a charge line` },
            ]);
        }
        return value;
    }
    toVoucherNo(value) {
        if (value === null || value === '') {
            return null;
        }
        return BigInt(value);
    }
    handleWriteError(error) {
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwMasterBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    message: 'One of the referenced charge / ledger / company / branch records does not exist',
                },
            ]);
        }
    }
    throwNotFound(cdId) {
        (0, module_service_utils_1.throwMasterNotFound)('Charge line not found', 'cdId', `No active charge line found with id ${cdId}`);
    }
    displayName(record) {
        return record.cdChgName || `Charge ${record.cdSlno ?? ''}`.trim();
    }
    toPayload(record, ledgerName = null) {
        return {
            cdId: record.cdId,
            cdDocType: record.cdDocType,
            cdDocId: record.cdDocId,
            cdSlno: record.cdSlno,
            cdCompId: record.cdCompId,
            cdBranchId: record.cdBranchId,
            cdAccYear: record.cdAccYear,
            cdVoucherNo: record.cdVoucherNo?.toString() ?? null,
            cdChgId: record.cdChgId,
            cdChgName: record.cdChgName,
            cdRole: record.cdRole,
            cdMethod: record.cdMethod,
            cdType: record.cdType,
            cdApplyOn: record.cdApplyOn,
            cdLedgerCode: record.cdLedgerCode,
            cdLedgerName: record.ledger?.ledName ?? ledgerName,
            cdLandingCost: record.cdLandingCost,
            cdCostAlloc: record.cdCostAlloc,
            cdBeforeTax: record.cdBeforeTax,
            cdTaxApl: record.cdTaxApl,
            cdSepPost: record.cdSepPost,
            cdUnit: record.cdUnit,
            cdQtyVal: (0, module_service_utils_1.toNullableNumber)(record.cdQtyVal),
            cdWeight: (0, module_service_utils_1.toNullableNumber)(record.cdWeight),
            cdRate: (0, module_service_utils_1.toNullableNumber)(record.cdRate),
            cdAmount: (0, module_service_utils_1.toNullableNumber)(record.cdAmount),
            cdTaxCode: record.cdTaxCode,
            cdHsn: record.cdHsn,
            cdTaxPerc: (0, module_service_utils_1.toNullableNumber)(record.cdTaxPerc),
            cdTaxAmt: (0, module_service_utils_1.toNullableNumber)(record.cdTaxAmt),
            cdSgstPerc: (0, module_service_utils_1.toNullableNumber)(record.cdSgstPerc),
            cdSgstAmt: (0, module_service_utils_1.toNullableNumber)(record.cdSgstAmt),
            cdCgstPerc: (0, module_service_utils_1.toNullableNumber)(record.cdCgstPerc),
            cdCgstAmt: (0, module_service_utils_1.toNullableNumber)(record.cdCgstAmt),
            cdIgstPerc: (0, module_service_utils_1.toNullableNumber)(record.cdIgstPerc),
            cdIgstAmt: (0, module_service_utils_1.toNullableNumber)(record.cdIgstAmt),
            cdCessPerc: (0, module_service_utils_1.toNullableNumber)(record.cdCessPerc),
            cdCessAmt: (0, module_service_utils_1.toNullableNumber)(record.cdCessAmt),
            cdNetAmt: (0, module_service_utils_1.toNullableNumber)(record.cdNetAmt),
            cdRemarks: record.cdRemarks,
            cdIsActive: record.cdIsActive,
            cdIsDeleted: record.cdIsDeleted,
            cdSyncDate: record.cdSyncDate ? record.cdSyncDate.toISOString() : null,
            cdCreatedOn: record.cdCreatedOn.toISOString(),
            cdCreatedBy: record.cdCreatedBy,
            cdModifiedOn: record.cdModifiedOn ? record.cdModifiedOn.toISOString() : null,
            cdModifiedBy: record.cdModifiedBy,
        };
    }
};
exports.ChargeDetailService = ChargeDetailService;
exports.ChargeDetailService = ChargeDetailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ChargeDetailService);
//# sourceMappingURL=charge-detail.service.js.map