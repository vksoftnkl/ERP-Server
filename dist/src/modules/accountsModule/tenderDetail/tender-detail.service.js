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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenderDetailService = exports.TENDER_REF_DUPLICATE = exports.TENDER_REF_REQUIRED = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const till_event_service_1 = require("../../till/services/till-event.service");
const till_enum_1 = require("../../till/types/till-enum");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const tender_settlement_settings_1 = require("../tenderSettlement/tender-settlement.settings");
const tender_detail_api_types_1 = require("./types/tender-detail-api.types");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const TENDER_DETAIL_TABLE_NAME = 'account tender detail';
const TENDER_DETAIL_AUDIT_SCREEN_NAME = 'Tender Detail';
const TENDER_DETAIL_AUDIT = {
    tableName: TENDER_DETAIL_TABLE_NAME,
    screenName: TENDER_DETAIL_AUDIT_SCREEN_NAME,
    entityName: 'Tender line',
};
const TENDER_DETAIL_OPTIONAL_FIELDS = [
    'tdVoucherId',
    'tdAmount',
    'tdSurchargePerc',
    'tdSurchargeAmt',
    'tdSurchargeLedgerId',
    'tdReceivedAmt',
    'tdChangeAmt',
    'tdUnitsUsed',
    'tdConversionRate',
    'tdRefNo',
    'tdAuthCode',
    'tdCardLast4',
    'tdBankName',
    'tdPayerVpa',
    'tdInstrumentDate',
    'tdIsPdc',
    'tdSettleStatus',
    'tdSettleLedgerId',
    'tdExpectedSettleOn',
    'tdSettledOn',
    'tdSettleAmount',
    'tdMdrAmt',
    'tdSettleRefNo',
    'tdSettleVoucherId',
    'tdSessionId',
    'tdDeviceId',
    'tdNotes',
];
const TENDER_DETAIL_DEFAULTED_FIELDS = [
    'tdAmount',
    'tdSurchargePerc',
    'tdSurchargeAmt',
    'tdReceivedAmt',
    'tdChangeAmt',
    'tdUnitsUsed',
    'tdConversionRate',
    'tdIsPdc',
    'tdSettleStatus',
    'tdMdrAmt',
];
const TENDER_DETAIL_DATE_FIELDS = ['tdInstrumentDate', 'tdExpectedSettleOn', 'tdSettledOn'];
function dropNullish(value) {
    return value === null ? undefined : value;
}
const CARD_LAST4_PATTERN = /^[0-9]{4}$/;
function toDateOrNull(value, field) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field, message: `${field} must be a valid ISO date` },
        ]);
    }
    return parsed;
}
const TENDER_DETAIL_FIELD_TRANSFORMS = {
    ...Object.fromEntries(TENDER_DETAIL_DEFAULTED_FIELDS.map((field) => [field, dropNullish])),
    ...Object.fromEntries(TENDER_DETAIL_DATE_FIELDS.map((field) => [
        field,
        (value) => toDateOrNull(value, field),
    ])),
};
exports.TENDER_REF_REQUIRED = 'TENDER_REF_REQUIRED';
exports.TENDER_REF_DUPLICATE = 'TENDER_REF_DUPLICATE';
const STATEMENT_SETTLED_TYPES = ['CARD', 'UPI', 'WALLET'];
let TenderDetailService = class TenderDetailService {
    prisma;
    auditLogService;
    requestContextService;
    appSettings;
    tillEvents;
    constructor(prisma, auditLogService, requestContextService, appSettings, tillEvents) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.appSettings = appSettings;
        this.tillEvents = tillEvents;
    }
    async save(saveTenderDetailDto) {
        if (saveTenderDetailDto.tdId) {
            return this.updateTenderDetail(saveTenderDetailDto);
        }
        return this.createTenderDetail(saveTenderDetailDto);
    }
    async get(getTenderDetailQueryDto) {
        const { tdId, tdSrcModule, tdSrcDocType, tdSrcDocId } = getTenderDetailQueryDto;
        if (tdId && (tdSrcModule || tdSrcDocType || tdSrcDocId)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Ambiguous tender line lookup', [
                {
                    field: 'tdId',
                    message: 'Send either tdId or the tdSrcModule + tdSrcDocType + tdSrcDocId triple, not both',
                },
            ]);
        }
        if (tdId) {
            return this.getById(tdId);
        }
        if (tdSrcModule && tdSrcDocType && tdSrcDocId) {
            return this.getByDocument(tdSrcModule, tdSrcDocType, tdSrcDocId);
        }
        (0, module_service_utils_1.throwAccountsBadRequest)('Missing tender line lookup', [
            {
                field: 'tdId',
                message: 'Either tdId, or all of tdSrcModule, tdSrcDocType and tdSrcDocId, is required',
            },
        ]);
    }
    async getById(tdId) {
        const record = await this.prisma.accTenderDetail.findFirst({
            where: { tdId, tdIsDeleted: false },
            include: this.displayJoins(),
        });
        if (!record) {
            this.throwNotFound(tdId);
        }
        return this.toPayload(record);
    }
    async getByDocument(tdSrcModule, tdSrcDocType, tdSrcDocId, client = this.prisma) {
        const records = await this.findDocumentTenders(client, tdSrcModule, tdSrcDocType, tdSrcDocId);
        return records.map((record) => this.toPayload(record));
    }
    async softDelete(tdId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accTenderDetail.findFirst({
                where: { tdId, tdIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(tdId);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const modifiedOn = new Date();
            await this.softDeleteTenderLine(tx, existing, actor, modifiedOn, TENDER_DETAIL_AUDIT);
            return { tdId, deleted: true };
        });
    }
    async syncDocumentTenders(tx, scope, inputTenders, actorId, audit = TENDER_DETAIL_AUDIT) {
        const existing = await this.findDocumentTenders(tx, scope.tdSrcModule, scope.tdSrcDocType, scope.tdSrcDocId);
        if (inputTenders === undefined) {
            return existing.map((record) => this.toPayload(record));
        }
        const existingMap = new Map(existing.map((tender) => [tender.tdId, tender]));
        const keptIds = new Set();
        const seenRowNos = new Set();
        const now = new Date();
        const persisted = [];
        for (const [index, inputTender] of inputTenders.entries()) {
            const rowNo = inputTender.tdRowNo ?? index + 1;
            if (seenRowNos.has(rowNo)) {
                (0, module_service_utils_1.throwAccountsConflict)('Duplicate tender line number', [
                    {
                        field: 'tdRowNo',
                        message: `A tender line with number ${rowNo} already exists on this document`,
                    },
                ]);
            }
            seenRowNos.add(rowNo);
            const existingTender = inputTender.tdId ? existingMap.get(inputTender.tdId) : undefined;
            if (inputTender.tdId && !existingTender) {
                this.throwNotFound(inputTender.tdId);
            }
            this.ensureDocumentMatchesScope(inputTender, scope);
            if (existingTender) {
                persisted.push(await this.updateTenderLine(tx, existingTender, inputTender, rowNo, actorId, now, audit));
                keptIds.add(existingTender.tdId);
                continue;
            }
            const created = await this.insertTenderLine(tx, scope, inputTender, rowNo, actorId, now, audit);
            keptIds.add(created.tdId);
            persisted.push(created);
        }
        for (const removed of existing.filter((tender) => !keptIds.has(tender.tdId))) {
            await this.softDeleteTenderLine(tx, removed, actorId, now, audit);
        }
        return persisted.sort((left, right) => left.tdRowNo - right.tdRowNo);
    }
    findDocumentTenders(client, tdSrcModule, tdSrcDocType, tdSrcDocId) {
        return client.accTenderDetail.findMany({
            where: { tdSrcModule, tdSrcDocType, tdSrcDocId, tdIsDeleted: false, tdIsVoided: false },
            include: this.displayJoins(),
            orderBy: { tdRowNo: 'asc' },
        });
    }
    async softDeleteDocumentTenders(tx, tdSrcModule, tdSrcDocType, tdSrcDocId, actorId, modifiedOn = new Date()) {
        await tx.accTenderDetail.updateMany({
            where: { tdSrcModule, tdSrcDocType, tdSrcDocId, tdIsDeleted: false },
            data: {
                tdIsDeleted: true,
                tdModifiedOn: modifiedOn,
                tdModifiedBy: actorId,
            },
        });
    }
    async createTenderDetail(saveTenderDetailDto) {
        const now = new Date();
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const scope = {
            tdSrcModule: this.requireField(saveTenderDetailDto.tdSrcModule, 'tdSrcModule'),
            tdSrcDocType: this.requireField(saveTenderDetailDto.tdSrcDocType, 'tdSrcDocType'),
            tdSrcDocId: this.requireField(saveTenderDetailDto.tdSrcDocId, 'tdSrcDocId'),
            tdCompanyId: this.requireField(saveTenderDetailDto.tdCompanyId, 'tdCompanyId'),
            tdBranchId: this.requireField(saveTenderDetailDto.tdBranchId, 'tdBranchId'),
            tdTenantId: saveTenderDetailDto.tdTenantId ?? null,
            tdAccYear: (0, module_service_utils_1.normalizeRequiredText)(this.requireField(saveTenderDetailDto.tdAccYear, 'tdAccYear'), 'tdAccYear'),
            tdDocDate: toDateOrNull(this.requireField(saveTenderDetailDto.tdDocDate, 'tdDocDate'), 'tdDocDate'),
            tdPartyLedgerId: this.requireField(saveTenderDetailDto.tdPartyLedgerId, 'tdPartyLedgerId'),
            tdUserId: this.requireField(saveTenderDetailDto.tdUserId, 'tdUserId'),
            tdSessionId: saveTenderDetailDto.tdSessionId ?? null,
            tdDeviceId: saveTenderDetailDto.tdDeviceId ?? null,
            tdDrCr: this.requireField(saveTenderDetailDto.tdDrCr, 'tdDrCr'),
        };
        try {
            return await this.prisma.$transaction(async (tx) => {
                const rowNo = await this.resolveRowNo(tx, scope, saveTenderDetailDto.tdRowNo ?? null);
                return this.insertTenderLine(tx, scope, saveTenderDetailDto, rowNo, actor, now, TENDER_DETAIL_AUDIT);
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateTenderDetail(saveTenderDetailDto) {
        const tdId = saveTenderDetailDto.tdId;
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.accTenderDetail.findFirst({
                    where: { tdId, tdIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound(tdId);
                }
                this.ensureDocumentIsUnchanged(saveTenderDetailDto, existing);
                const rowNo = saveTenderDetailDto.tdRowNo === undefined
                    ? existing.tdRowNo
                    : await this.resolveRowNo(tx, {
                        tdSrcModule: existing.tdSrcModule,
                        tdSrcDocType: existing.tdSrcDocType,
                        tdSrcDocId: existing.tdSrcDocId,
                    }, saveTenderDetailDto.tdRowNo, tdId);
                return this.updateTenderLine(tx, existing, saveTenderDetailDto, rowNo, actor, new Date(), TENDER_DETAIL_AUDIT);
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async insertTenderLine(tx, scope, saveTenderDetailDto, rowNo, actorId, now, audit) {
        const tenderId = this.requireField(saveTenderDetailDto.tdTenderId, 'tdTenderId');
        const tender = await this.ensureTenderExists(tx, tenderId);
        const tenderTypeId = saveTenderDetailDto.tdTenderTypeId === undefined
            ? tender.tndTypeId
            : this.toTenderTypeId(saveTenderDetailDto.tdTenderTypeId);
        if (tenderTypeId !== tender.tndTypeId) {
            await this.ensureTenderTypeExists(tx, tenderTypeId);
        }
        const tenderLedgerId = saveTenderDetailDto.tdTenderLedgerId ?? tender.tndLedgerId;
        const ledgerName = await this.ensureLedgerExists(tx, tenderLedgerId, 'tdTenderLedgerId');
        const partyLedgerId = this.requireField(saveTenderDetailDto.tdPartyLedgerId ?? scope.tdPartyLedgerId, 'tdPartyLedgerId');
        await this.ensureLedgerExists(tx, partyLedgerId, 'tdPartyLedgerId');
        if (saveTenderDetailDto.tdSettleLedgerId) {
            await this.ensureLedgerExists(tx, saveTenderDetailDto.tdSettleLedgerId, 'tdSettleLedgerId');
        }
        if (saveTenderDetailDto.tdSurchargeLedgerId) {
            await this.ensureLedgerExists(tx, saveTenderDetailDto.tdSurchargeLedgerId, 'tdSurchargeLedgerId');
        }
        const data = {
            tdSrcModule: scope.tdSrcModule,
            tdSrcDocType: scope.tdSrcDocType,
            tdSrcDocId: scope.tdSrcDocId,
            tdRowNo: rowNo,
            tdCompanyId: saveTenderDetailDto.tdCompanyId ?? scope.tdCompanyId,
            tdBranchId: saveTenderDetailDto.tdBranchId ?? scope.tdBranchId,
            tdTenantId: saveTenderDetailDto.tdTenantId === undefined
                ? scope.tdTenantId
                : saveTenderDetailDto.tdTenantId,
            tdAccYear: saveTenderDetailDto.tdAccYear === undefined
                ? scope.tdAccYear
                : (0, module_service_utils_1.normalizeRequiredText)(saveTenderDetailDto.tdAccYear, 'tdAccYear'),
            tdDocDate: saveTenderDetailDto.tdDocDate === undefined
                ? scope.tdDocDate
                : toDateOrNull(saveTenderDetailDto.tdDocDate, 'tdDocDate'),
            tdPartyLedgerId: partyLedgerId,
            tdTenderId: tenderId,
            tdTenderTypeId: tenderTypeId,
            tdTenderLedgerId: tenderLedgerId,
            tdDrCr: saveTenderDetailDto.tdDrCr ?? scope.tdDrCr,
            tdUserId: saveTenderDetailDto.tdUserId ?? scope.tdUserId,
            tdSessionId: saveTenderDetailDto.tdSessionId === undefined
                ? scope.tdSessionId
                : saveTenderDetailDto.tdSessionId,
            tdDeviceId: saveTenderDetailDto.tdDeviceId === undefined
                ? scope.tdDeviceId
                : saveTenderDetailDto.tdDeviceId,
            tdCreatedOn: now,
            tdCreatedBy: (0, module_service_utils_1.resolveActor)(saveTenderDetailDto.tdCreatedBy, actorId),
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveTenderDetailDto, TENDER_DETAIL_OPTIONAL_FIELDS, TENDER_DETAIL_FIELD_TRANSFORMS);
        const totalAmt = this.resolveTotalAmt(saveTenderDetailDto, undefined);
        data.tdTotalAmt = totalAmt;
        const last4 = await this.guardReference(tx, tender, {
            tdId: null,
            tdTenderId: tenderId,
            tdTenderTypeId: tenderTypeId,
            tdDrCr: data.tdDrCr,
            tdRefNo: data.tdRefNo ?? null,
            tdAuthCode: data.tdAuthCode ?? null,
            tdCardLast4: data.tdCardLast4 ?? null,
            tdTotalAmt: totalAmt,
            tdCompanyId: data.tdCompanyId,
            tdBranchId: data.tdBranchId,
            tdAccYear: data.tdAccYear,
            tdSrcDocType: data.tdSrcDocType,
            tdSrcDocId: data.tdSrcDocId,
            tdSessionId: data.tdSessionId ?? null,
        });
        if (last4 && !data.tdCardLast4) {
            data.tdCardLast4 = last4;
        }
        await this.defaultSettlement(tx, data, tender, saveTenderDetailDto);
        this.ensureValuesAreAllowed(saveTenderDetailDto, undefined, data);
        const created = await tx.accTenderDetail.create({ data });
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: audit.tableName,
            screenName: audit.screenName,
            screenType: 'transaction',
            pk: created.tdId,
            displayName: this.displayName(created, tender.tndName),
            originalRecord: null,
            modifiedRecord: this.toPayload(created),
            userId: created.tdCreatedBy,
            notes: `${audit.entityName} created`,
        }, tx);
        return this.toPayload(created, tender.tndName, ledgerName);
    }
    async updateTenderLine(tx, existing, saveTenderDetailDto, rowNo, actorId, now, audit) {
        const tenderId = saveTenderDetailDto.tdTenderId ?? existing.tdTenderId;
        const tender = await this.ensureTenderExists(tx, tenderId);
        const tenderChanged = tenderId !== existing.tdTenderId;
        const tenderTypeId = saveTenderDetailDto.tdTenderTypeId === undefined
            ? tenderChanged
                ? tender.tndTypeId
                : existing.tdTenderTypeId
            : this.toTenderTypeId(saveTenderDetailDto.tdTenderTypeId);
        if (tenderTypeId !== tender.tndTypeId && tenderTypeId !== existing.tdTenderTypeId) {
            await this.ensureTenderTypeExists(tx, tenderTypeId);
        }
        const tenderLedgerId = saveTenderDetailDto.tdTenderLedgerId ??
            (tenderChanged ? tender.tndLedgerId : existing.tdTenderLedgerId);
        const ledgerName = await this.ensureLedgerExists(tx, tenderLedgerId, 'tdTenderLedgerId');
        if (saveTenderDetailDto.tdPartyLedgerId &&
            saveTenderDetailDto.tdPartyLedgerId !== existing.tdPartyLedgerId) {
            await this.ensureLedgerExists(tx, saveTenderDetailDto.tdPartyLedgerId, 'tdPartyLedgerId');
        }
        if (saveTenderDetailDto.tdSettleLedgerId &&
            saveTenderDetailDto.tdSettleLedgerId !== existing.tdSettleLedgerId) {
            await this.ensureLedgerExists(tx, saveTenderDetailDto.tdSettleLedgerId, 'tdSettleLedgerId');
        }
        if (saveTenderDetailDto.tdSurchargeLedgerId &&
            saveTenderDetailDto.tdSurchargeLedgerId !== existing.tdSurchargeLedgerId) {
            await this.ensureLedgerExists(tx, saveTenderDetailDto.tdSurchargeLedgerId, 'tdSurchargeLedgerId');
        }
        const data = {
            tdRowNo: rowNo,
            tdTenderId: tenderId,
            tdTenderTypeId: tenderTypeId,
            tdTenderLedgerId: tenderLedgerId,
            tdDrCr: saveTenderDetailDto.tdDrCr ?? existing.tdDrCr,
            tdModifiedOn: now,
            tdModifiedBy: (0, module_service_utils_1.resolveActor)(saveTenderDetailDto.tdModifiedBy, actorId),
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveTenderDetailDto, TENDER_DETAIL_OPTIONAL_FIELDS, TENDER_DETAIL_FIELD_TRANSFORMS);
        if (saveTenderDetailDto.tdCompanyId !== undefined) {
            data.tdCompanyId = saveTenderDetailDto.tdCompanyId;
        }
        if (saveTenderDetailDto.tdBranchId !== undefined) {
            data.tdBranchId = saveTenderDetailDto.tdBranchId;
        }
        if (saveTenderDetailDto.tdTenantId !== undefined) {
            data.tdTenantId = saveTenderDetailDto.tdTenantId;
        }
        if (saveTenderDetailDto.tdDocDate !== undefined) {
            data.tdDocDate = toDateOrNull(saveTenderDetailDto.tdDocDate, 'tdDocDate');
        }
        if (saveTenderDetailDto.tdPartyLedgerId !== undefined) {
            data.tdPartyLedgerId = saveTenderDetailDto.tdPartyLedgerId;
        }
        if (saveTenderDetailDto.tdUserId !== undefined) {
            data.tdUserId = saveTenderDetailDto.tdUserId;
        }
        data.tdTotalAmt = this.resolveTotalAmt(saveTenderDetailDto, existing);
        const pick = (value, stored) => (value === undefined ? stored : value);
        const merged = {
            tdId: existing.tdId,
            tdTenderId: tenderId,
            tdTenderTypeId: tenderTypeId,
            tdDrCr: String(pick(data.tdDrCr, existing.tdDrCr)),
            tdRefNo: pick(data.tdRefNo, existing.tdRefNo),
            tdAuthCode: pick(data.tdAuthCode, existing.tdAuthCode),
            tdCardLast4: pick(data.tdCardLast4, existing.tdCardLast4),
            tdTotalAmt: new client_1.Prisma.Decimal(String(pick(data.tdTotalAmt, existing.tdTotalAmt) ?? 0)),
            tdCompanyId: String(pick(data.tdCompanyId, existing.tdCompanyId)),
            tdBranchId: String(pick(data.tdBranchId, existing.tdBranchId)),
            tdAccYear: existing.tdAccYear,
            tdSrcDocType: existing.tdSrcDocType,
            tdSrcDocId: existing.tdSrcDocId,
            tdSessionId: existing.tdSessionId,
        };
        const touched = tenderChanged ||
            merged.tdDrCr !== existing.tdDrCr ||
            merged.tdRefNo !== existing.tdRefNo ||
            merged.tdAuthCode !== existing.tdAuthCode ||
            merged.tdCardLast4 !== existing.tdCardLast4 ||
            !merged.tdTotalAmt.equals(existing.tdTotalAmt);
        if (touched) {
            const last4 = await this.guardReference(tx, tender, merged);
            if (last4 && !merged.tdCardLast4) {
                data.tdCardLast4 = last4;
            }
        }
        this.ensureValuesAreAllowed(saveTenderDetailDto, existing, data);
        const updated = await tx.accTenderDetail.update({
            where: { tdId_tdAccYear: { tdId: existing.tdId, tdAccYear: existing.tdAccYear } },
            data,
        });
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: audit.tableName,
            screenName: audit.screenName,
            screenType: 'transaction',
            pk: existing.tdId,
            displayName: this.displayName(updated, tender.tndName),
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(updated),
            userId: (0, module_service_utils_1.resolveActor)(saveTenderDetailDto.tdModifiedBy, actorId),
            notes: `${audit.entityName} updated`,
        }, tx);
        return this.toPayload(updated, tender.tndName, ledgerName);
    }
    async softDeleteTenderLine(tx, existing, actorId, now, audit) {
        const deleted = await tx.accTenderDetail.update({
            where: { tdId_tdAccYear: { tdId: existing.tdId, tdAccYear: existing.tdAccYear } },
            data: {
                tdIsDeleted: true,
                tdModifiedOn: now,
                tdModifiedBy: actorId,
            },
        });
        await this.auditLogService.logEntityChange({
            action: 'cancel',
            tableName: audit.tableName,
            screenName: audit.screenName,
            screenType: 'transaction',
            pk: existing.tdId,
            displayName: this.displayName(existing),
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(deleted),
            userId: actorId,
            notes: `${audit.entityName} soft deleted`,
        }, tx);
    }
    ensureDocumentIsUnchanged(saveTenderDetailDto, existing) {
        const details = [];
        if (saveTenderDetailDto.tdSrcModule &&
            saveTenderDetailDto.tdSrcModule !== existing.tdSrcModule) {
            details.push({
                field: 'tdSrcModule',
                message: `tdSrcModule cannot be changed (stored value is ${existing.tdSrcModule})`,
            });
        }
        if (saveTenderDetailDto.tdSrcDocType &&
            saveTenderDetailDto.tdSrcDocType !== existing.tdSrcDocType) {
            details.push({
                field: 'tdSrcDocType',
                message: `tdSrcDocType cannot be changed (stored value is ${existing.tdSrcDocType})`,
            });
        }
        if (saveTenderDetailDto.tdSrcDocId && saveTenderDetailDto.tdSrcDocId !== existing.tdSrcDocId) {
            details.push({
                field: 'tdSrcDocId',
                message: 'tdSrcDocId cannot be changed; delete the line and create it on the other document',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Tender line document is immutable', details);
        }
    }
    ensureDocumentMatchesScope(saveTenderDetailDto, scope) {
        const details = [];
        if (saveTenderDetailDto.tdSrcModule && saveTenderDetailDto.tdSrcModule !== scope.tdSrcModule) {
            details.push({
                field: 'tdSrcModule',
                message: `tdSrcModule must be ${scope.tdSrcModule} on this document`,
            });
        }
        if (saveTenderDetailDto.tdSrcDocType &&
            saveTenderDetailDto.tdSrcDocType !== scope.tdSrcDocType) {
            details.push({
                field: 'tdSrcDocType',
                message: `tdSrcDocType must be ${scope.tdSrcDocType} on this document`,
            });
        }
        if (saveTenderDetailDto.tdSrcDocId && saveTenderDetailDto.tdSrcDocId !== scope.tdSrcDocId) {
            details.push({
                field: 'tdSrcDocId',
                message: 'tdSrcDocId must be the parent document; a tender line cannot be moved off it',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Tender line document is immutable', details);
        }
    }
    async guardReference(tx, tender, row) {
        if (row.tdDrCr.trim() !== String(tender_detail_api_types_1.TenderDrCr.DR)) {
            return null;
        }
        const type = await tx.accTenderType.findFirst({
            where: { ttmTypeId: row.tdTenderTypeId },
            select: { ttmTypeName: true, ttmNeedsRef: true },
        });
        if (type?.ttmTypeName !== 'CARD') {
            return null;
        }
        const field = 'tdCardLast4';
        const refuse = (message, code, status, f = field) => {
            throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, [{ field: f, message, code }]), status);
        };
        const ref = row.tdRefNo?.trim() ?? '';
        const last4 = row.tdCardLast4?.trim() || (/^\d{4}$/.test(ref) ? ref : null);
        if (row.tdCardLast4 && !/^\d{4}$/.test(row.tdCardLast4.trim())) {
            refuse('The card’s last 4 must be four digits', exports.TENDER_REF_REQUIRED, 422);
        }
        if ((tender.tndNeedsRef ?? type.ttmNeedsRef) && !last4) {
            refuse(`${tender.tndName}: key the last 4 digits of the card (in the reference)`, exports.TENDER_REF_REQUIRED, 422);
        }
        const auth = row.tdAuthCode?.trim().toUpperCase() ?? '';
        if (auth && !/^[A-Z0-9]{6}$/.test(auth)) {
            refuse('The approval code on the slip is 6 letters / digits', exports.TENDER_REF_REQUIRED, 422, 'tdAuthCode');
        }
        if (!auth || !last4) {
            return last4;
        }
        const [twin] = await tx.$queryRaw `
      SELECT t.td_id::text, t.td_src_doc_type, t.td_src_doc_id::text
        FROM accounts.acc_tender_detail t
       WHERE t.td_company_id = ${row.tdCompanyId}::uuid
         AND t.td_tender_id  = ${row.tdTenderId}::uuid
         AND t.td_is_deleted = false AND t.td_is_voided = false
         AND trim(t.td_dr_cr) = 'DR'
         AND upper(t.td_auth_code) = ${auth}
         AND t.td_card_last4 = ${last4}
         AND t.td_total_amt  = ${row.tdTotalAmt}::numeric
         AND t.td_src_doc_id <> ${row.tdSrcDocId}::uuid
         AND (${row.tdId}::uuid IS NULL OR t.td_id <> ${row.tdId}::uuid)
       LIMIT 1`;
        if (!twin) {
            return last4;
        }
        const mode = this.appSettings
            ? (0, tender_settlement_settings_1.readTenderSettings)(await this.appSettings.resolveEffective({
                companyId: row.tdCompanyId,
                branchId: row.tdBranchId,
                deviceId: null,
                userId: null,
            })).duplicateRef
            : 'BLOCK';
        if (mode === 'WARN') {
            return last4;
        }
        await this.logDuplicate(row, { auth, last4, twin });
        return refuse(`Approval code ${auth} on card …${last4} for ${row.tdTotalAmt.toFixed(2)} is already on another ${twin.td_src_doc_type.toLowerCase().replace('_', ' ')}`, exports.TENDER_REF_DUPLICATE, 409, 'tdAuthCode');
    }
    async logDuplicate(row, hit) {
        if (!this.tillEvents) {
            return;
        }
        try {
            const session = row.tdSessionId
                ? await this.prisma.tillSession.findFirst({
                    where: { tssId: row.tdSessionId, tssIsDeleted: false },
                    select: { tssId: true, tssDayId: true, tssCounterId: true },
                })
                : null;
            await this.tillEvents.log(this.prisma, {
                companyId: row.tdCompanyId,
                branchId: row.tdBranchId,
                accYear: row.tdAccYear,
                code: till_enum_1.TillEventCode.DUPLICATE_REF_BLOCKED,
                sessionId: session?.tssId ?? null,
                dayId: session?.tssDayId ?? null,
                counterId: session?.tssCounterId ?? null,
                deviceId: this.requestContextService.getDeviceId() ?? null,
                userId: this.requestContextService.getUserId() ?? null,
                srcDocType: row.tdSrcDocType,
                srcDocId: row.tdSrcDocId,
                amount: row.tdTotalAmt,
                payload: {
                    tenderId: row.tdTenderId,
                    authCode: hit.auth,
                    cardLast4: hit.last4,
                    otherTdId: hit.twin.td_id,
                    otherDocType: hit.twin.td_src_doc_type,
                    otherDocId: hit.twin.td_src_doc_id,
                },
            });
        }
        catch {
        }
    }
    async defaultSettlement(tx, data, tender, saveTenderDetailDto) {
        if (saveTenderDetailDto.tdSettleStatus !== undefined || !tender.tndSettlementLedgerId) {
            return;
        }
        const type = await tx.accTenderType.findFirst({
            where: { ttmTypeId: data.tdTenderTypeId },
            select: { ttmTypeName: true, ttmCloseMode: true },
        });
        if (!type ||
            !STATEMENT_SETTLED_TYPES.includes(type.ttmTypeName) ||
            !['SLIPS', 'STATEMENT'].includes(type.ttmCloseMode)) {
            return;
        }
        data.tdSettleStatus = tender_detail_api_types_1.TenderSettleStatus.PENDING;
        if (data.tdExpectedSettleOn === undefined || data.tdExpectedSettleOn === null) {
            const docDate = new Date(data.tdDocDate);
            docDate.setUTCDate(docDate.getUTCDate() + Math.max(0, tender.tndSettlementDays));
            data.tdExpectedSettleOn = docDate;
        }
    }
    async ensureTenderExists(tx, tenderId) {
        const tender = await tx.accTenderMaster.findFirst({
            where: { tndId: tenderId, tndIsDeleted: false, tndIsActive: true },
            select: {
                tndName: true,
                tndTypeId: true,
                tndLedgerId: true,
                tndSettlementLedgerId: true,
                tndSettlementDays: true,
                tndNeedsRef: true,
            },
        });
        if (!tender) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Tender does not exist', [
                { field: 'tdTenderId', message: `No active tender found with id ${tenderId}` },
            ]);
        }
        return tender;
    }
    async ensureTenderTypeExists(tx, tenderTypeId) {
        const tenderType = await tx.accTenderType.findFirst({
            where: { ttmTypeId: tenderTypeId, ttmIsDeleted: false },
            select: { ttmTypeId: true },
        });
        if (!tenderType) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Tender type does not exist', [
                {
                    field: 'tdTenderTypeId',
                    message: `No active tender type found with id ${tenderTypeId.toString()}`,
                },
            ]);
        }
    }
    async ensureLedgerExists(tx, ledgerId, field) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: { ledId: ledgerId, ledIsDeleted: false },
            select: { ledName: true },
        });
        if (!ledger) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Ledger does not exist', [
                { field, message: `No active account ledger found with id ${ledgerId}` },
            ]);
        }
        return ledger.ledName;
    }
    async resolveRowNo(tx, scope, requested, excludeId) {
        const document = {
            tdSrcModule: scope.tdSrcModule,
            tdSrcDocType: scope.tdSrcDocType,
            tdSrcDocId: scope.tdSrcDocId,
            tdIsDeleted: false,
        };
        if (requested === null) {
            const highest = await tx.accTenderDetail.aggregate({
                where: document,
                _max: { tdRowNo: true },
            });
            return (highest._max.tdRowNo ?? 0) + 1;
        }
        const clash = await tx.accTenderDetail.findFirst({
            where: {
                ...document,
                tdRowNo: requested,
                ...(excludeId ? { tdId: { not: excludeId } } : {}),
            },
            select: { tdId: true },
        });
        if (clash) {
            (0, module_service_utils_1.throwAccountsConflict)('Duplicate tender line number', [
                {
                    field: 'tdRowNo',
                    message: `A tender line with number ${requested} already exists on this document`,
                },
            ]);
        }
        return requested;
    }
    resolveTotalAmt(saveTenderDetailDto, existing) {
        const amount = this.mergedDecimal(saveTenderDetailDto.tdAmount, existing?.tdAmount);
        const surcharge = this.mergedDecimal(saveTenderDetailDto.tdSurchargeAmt, existing?.tdSurchargeAmt);
        const computed = amount.plus(surcharge).toDecimalPlaces(2);
        if (saveTenderDetailDto.tdTotalAmt === undefined) {
            return computed;
        }
        const requested = this.toDecimal(saveTenderDetailDto.tdTotalAmt, 'tdTotalAmt');
        if (!requested.equals(computed)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Invalid tender line value', [
                {
                    field: 'tdTotalAmt',
                    message: `tdTotalAmt must equal tdAmount + tdSurchargeAmt (${computed.toString()})`,
                },
            ]);
        }
        return requested;
    }
    ensureValuesAreAllowed(saveTenderDetailDto, existing, data) {
        const details = [];
        const values = {
            tdSrcModule: data.tdSrcModule ?? existing?.tdSrcModule,
            tdSrcDocType: data.tdSrcDocType ?? existing?.tdSrcDocType,
            tdDrCr: data.tdDrCr ?? existing?.tdDrCr,
            tdSettleStatus: data.tdSettleStatus ?? existing?.tdSettleStatus ?? undefined,
        };
        for (const guard of tender_detail_api_types_1.TENDER_DETAIL_VALUE_GUARDS) {
            const value = values[guard.field];
            if (value === undefined) {
                continue;
            }
            if (value === null) {
                details.push({ field: guard.field, message: `${guard.field} is required` });
                continue;
            }
            if (!guard.allowed.includes(value)) {
                details.push({
                    field: guard.field,
                    message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
                });
            }
        }
        const received = this.mergedDecimal(saveTenderDetailDto.tdReceivedAmt, existing?.tdReceivedAmt);
        const change = this.mergedDecimal(saveTenderDetailDto.tdChangeAmt, existing?.tdChangeAmt);
        if (!received.isZero() && received.lessThan(change)) {
            details.push({
                field: 'tdChangeAmt',
                message: 'tdChangeAmt cannot exceed tdReceivedAmt',
            });
        }
        const conversionRate = this.mergedDecimal(saveTenderDetailDto.tdConversionRate, existing?.tdConversionRate, 1);
        if (conversionRate.lessThanOrEqualTo(0)) {
            details.push({
                field: 'tdConversionRate',
                message: 'tdConversionRate must be greater than 0',
            });
        }
        const settleStatus = values.tdSettleStatus ?? tender_detail_api_types_1.TenderSettleStatus.NA;
        const settledOn = saveTenderDetailDto.tdSettledOn === undefined
            ? (existing?.tdSettledOn ?? null)
            : saveTenderDetailDto.tdSettledOn;
        if (settleStatus === String(tender_detail_api_types_1.TenderSettleStatus.SETTLED) && !settledOn) {
            details.push({
                field: 'tdSettledOn',
                message: 'tdSettledOn is required when tdSettleStatus is SETTLED',
            });
        }
        const isPdc = saveTenderDetailDto.tdIsPdc ?? existing?.tdIsPdc ?? false;
        const instrumentDate = saveTenderDetailDto.tdInstrumentDate === undefined
            ? (existing?.tdInstrumentDate ?? null)
            : saveTenderDetailDto.tdInstrumentDate;
        if (isPdc && !instrumentDate) {
            details.push({
                field: 'tdInstrumentDate',
                message: 'tdInstrumentDate is required when tdIsPdc is true',
            });
        }
        const cardLast4 = saveTenderDetailDto.tdCardLast4 === undefined
            ? (existing?.tdCardLast4 ?? null)
            : saveTenderDetailDto.tdCardLast4;
        if (cardLast4 && !CARD_LAST4_PATTERN.test(cardLast4)) {
            details.push({
                field: 'tdCardLast4',
                message: 'tdCardLast4 must be exactly 4 digits',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Invalid tender line value', details);
        }
    }
    mergedDecimal(sent, stored, columnDefault = 0) {
        if (sent !== undefined && sent !== null) {
            return this.toDecimal(sent, 'amount');
        }
        if (stored !== undefined && stored !== null) {
            return new client_1.Prisma.Decimal(stored);
        }
        return new client_1.Prisma.Decimal(columnDefault);
    }
    toDecimal(value, field) {
        try {
            return new client_1.Prisma.Decimal(value);
        }
        catch {
            return (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field, message: `${field} must be a valid number` },
            ]);
        }
    }
    toTenderTypeId(value) {
        const parsed = typeof value === 'number' ? value : Number(value);
        if (!Number.isInteger(parsed)) {
            return (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field: 'tdTenderTypeId', message: 'tdTenderTypeId must be an integer' },
            ]);
        }
        return parsed;
    }
    requireField(value, field) {
        if (!value) {
            (0, module_service_utils_1.throwAccountsBadRequest)(`${field} is required`, [
                { field, message: `${field} must be provided when creating a tender line` },
            ]);
        }
        return value;
    }
    displayJoins() {
        return {
            tender: { select: { tndName: true } },
            ledger: { select: { ledName: true } },
        };
    }
    handleWriteError(error) {
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    message: 'One of the referenced tender / ledger / company / branch / user records does not exist',
                },
            ]);
        }
    }
    throwNotFound(tdId) {
        (0, module_service_utils_1.throwAccountsNotFound)('Tender line not found', 'tdId', `No active tender line found with id ${tdId}`);
    }
    displayName(record, tenderName) {
        return tenderName || `Tender ${record.tdRowNo}`;
    }
    toOutputDateOnly(value) {
        return value === null ? null : value.toISOString().slice(0, 10);
    }
    toPayload(record, tenderName = null, tenderLedgerName = null) {
        return {
            tdId: record.tdId,
            tdCompanyId: record.tdCompanyId,
            tdBranchId: record.tdBranchId,
            tdTenantId: record.tdTenantId,
            tdAccYear: record.tdAccYear,
            tdSrcModule: record.tdSrcModule,
            tdSrcDocType: record.tdSrcDocType,
            tdSrcDocId: record.tdSrcDocId,
            tdRowNo: record.tdRowNo,
            tdDocDate: this.toOutputDateOnly(record.tdDocDate),
            tdPartyLedgerId: record.tdPartyLedgerId,
            tdVoucherId: record.tdVoucherId,
            tdTenderId: record.tdTenderId,
            tdTenderName: record.tender?.tndName ?? tenderName,
            tdTenderTypeId: record.tdTenderTypeId.toString(),
            tdTenderLedgerId: record.tdTenderLedgerId,
            tdTenderLedgerName: record.ledger?.ledName ?? tenderLedgerName,
            tdDrCr: record.tdDrCr,
            tdAmount: (0, module_service_utils_1.toNumber)(record.tdAmount),
            tdSurchargePerc: (0, module_service_utils_1.toNumber)(record.tdSurchargePerc),
            tdSurchargeAmt: (0, module_service_utils_1.toNumber)(record.tdSurchargeAmt),
            tdSurchargeLedgerId: record.tdSurchargeLedgerId,
            tdTotalAmt: (0, module_service_utils_1.toNumber)(record.tdTotalAmt),
            tdReceivedAmt: (0, module_service_utils_1.toNumber)(record.tdReceivedAmt),
            tdChangeAmt: (0, module_service_utils_1.toNumber)(record.tdChangeAmt),
            tdUnitsUsed: (0, module_service_utils_1.toNumber)(record.tdUnitsUsed),
            tdConversionRate: (0, module_service_utils_1.toNumber)(record.tdConversionRate),
            tdRefNo: record.tdRefNo,
            tdAuthCode: record.tdAuthCode,
            tdCardLast4: record.tdCardLast4,
            tdBankName: record.tdBankName,
            tdPayerVpa: record.tdPayerVpa,
            tdInstrumentDate: this.toOutputDateOnly(record.tdInstrumentDate),
            tdIsPdc: record.tdIsPdc,
            tdSettleStatus: record.tdSettleStatus,
            tdSettleLedgerId: record.tdSettleLedgerId,
            tdExpectedSettleOn: this.toOutputDateOnly(record.tdExpectedSettleOn),
            tdSettledOn: this.toOutputDateOnly(record.tdSettledOn),
            tdSettleAmount: (0, module_service_utils_1.toNullableNumber)(record.tdSettleAmount),
            tdMdrAmt: (0, module_service_utils_1.toNumber)(record.tdMdrAmt),
            tdSettleRefNo: record.tdSettleRefNo,
            tdSettleVoucherId: record.tdSettleVoucherId,
            tdSessionId: record.tdSessionId,
            tdDeviceId: record.tdDeviceId,
            tdUserId: record.tdUserId,
            tdNotes: record.tdNotes,
            tdIsVoided: record.tdIsVoided,
            tdVoidReason: record.tdVoidReason,
            tdVoidedOn: record.tdVoidedOn ? record.tdVoidedOn.toISOString() : null,
            tdVoidedBy: record.tdVoidedBy,
            tdIsDeleted: record.tdIsDeleted,
            tdSyncDate: record.tdSyncDate ? record.tdSyncDate.toISOString() : null,
            tdCreatedOn: record.tdCreatedOn.toISOString(),
            tdCreatedBy: record.tdCreatedBy,
            tdModifiedOn: record.tdModifiedOn ? record.tdModifiedOn.toISOString() : null,
            tdModifiedBy: record.tdModifiedBy,
        };
    }
};
exports.TenderDetailService = TenderDetailService;
exports.TenderDetailService = TenderDetailService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService,
        till_event_service_1.TillEventService])
], TenderDetailService);
//# sourceMappingURL=tender-detail.service.js.map