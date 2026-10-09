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
exports.TillPostingService = void 0;
const common_1 = require("@nestjs/common");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const till_errors_1 = require("../till-errors");
const till_event_service_1 = require("./till-event.service");
const till_ledger_service_1 = require("./till-ledger.service");
const till_enum_1 = require("../types/till-enum");
const SRC_MODULE = 'TILL';
const SRC_MOVEMENT = 'TILL_MOVEMENT';
const SRC_VARIANCE = 'TILL_VARIANCE';
const CASH_SHORT_EXCESS = 'CASH_SHORT_EXCESS';
const INTO_TILL = [
    till_enum_1.TillMovementKind.FLOAT_ISSUE,
    till_enum_1.TillMovementKind.TOP_UP,
    till_enum_1.TillMovementKind.PAID_IN,
];
let TillPostingService = class TillPostingService {
    posting;
    ledger;
    events;
    constructor(posting, ledger, events) {
        this.posting = posting;
        this.ledger = ledger;
        this.events = events;
    }
    async postMovement(tx, input) {
        const { session, kind, amount, safe, tillCash, caller } = input;
        const typeCode = till_enum_1.MOVEMENT_VOUCHER_TYPE[kind];
        const tcmId = input.tcmId ?? (await this.newId(tx));
        const other = kind === till_enum_1.TillMovementKind.PAID_IN ? (input.ledgerId ?? null) : (safe?.ledgerId ?? null);
        if (typeCode && !other) {
            throw new Error(`Till movement ${kind} has no ledger to post against`);
        }
        const otherLabel = kind === till_enum_1.TillMovementKind.PAID_IN ? 'ledger' : (safe?.name ?? 'safe');
        let voucherId = null;
        let docNo;
        if (typeCode && other) {
            const size = money(amount);
            const legs = INTO_TILL.includes(kind)
                ? [
                    { ledgerId: tillCash.ledgerId, drCr: 'DR', amount: size, oppLedgerId: other },
                    { ledgerId: other, drCr: 'CR', amount: size, oppLedgerId: tillCash.ledgerId },
                ]
                : [
                    { ledgerId: other, drCr: 'DR', amount: size, oppLedgerId: tillCash.ledgerId },
                    { ledgerId: tillCash.ledgerId, drCr: 'CR', amount: size, oppLedgerId: other },
                ];
            const voucher = await this.posting.postLegs(tx, {
                header: {
                    companyId: session.tssCompanyId,
                    branchId: session.tssBranchId,
                    tenantId: session.tssTenantId,
                    accYear: session.tssAccYear,
                    voucherTypeId: await this.voucherTypeId(tx, typeCode),
                    voucherDate: session.businessDate,
                    srcModule: SRC_MODULE,
                    srcDocType: SRC_MOVEMENT,
                    srcDocId: tcmId,
                    docLabel: `Till ${kind.toLowerCase().replace('_', ' ')}`,
                    docRefno: input.refNo ?? null,
                    docAmount: size,
                    partyId: null,
                    userId: input.doneBy ?? caller.userId,
                    sessionId: session.tssId,
                    deviceType: 'POS',
                    deviceId: input.deviceId ?? session.tssDeviceId,
                    remarks: input.notes ?? `${kind} ${otherLabel}`,
                    createdBy: caller.actorName,
                },
                legs,
            });
            voucherId = voucher.voucherId;
            docNo = voucher.voucherRefno ?? voucher.voucherNo ?? tcmId;
        }
        else {
            const [row] = await tx.$queryRaw `
        SELECT count(*)::int AS n FROM accounts.till_cash_movement
         WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_acc_year = ${session.tssAccYear}::char(9)
           AND tcm_kind = ${kind}`;
            docNo = `${session.sessionNo}/X${(row?.n ?? 0) + 1}`;
        }
        await tx.tillCashMovement.create({
            data: {
                tcmId,
                tcmCompanyId: session.tssCompanyId,
                tcmBranchId: session.tssBranchId,
                tcmTenantId: session.tssTenantId,
                tcmAccYear: session.tssAccYear,
                tcmKind: kind,
                tcmDocNo: docNo,
                tcmDocDate: new Date(`${session.businessDate}T00:00:00.000Z`),
                tcmDayId: session.tssDayId,
                tcmSessionId: session.tssId,
                tcmSafeId: safe?.safeId ?? null,
                tcmAmount: amount,
                tcmLedgerId: kind === till_enum_1.TillMovementKind.PAID_IN ? (input.ledgerId ?? null) : null,
                tcmReasonId: input.reasonId ?? null,
                tcmRefNo: input.refNo ?? null,
                tcmRefDate: input.refDate ? new Date(`${input.refDate}T00:00:00.000Z`) : null,
                tcmPartyName: input.partyName ?? null,
                tcmCountId: input.countId ?? null,
                tcmBagNo: input.bagNo ?? null,
                tcmSealNo: input.sealNo ?? null,
                tcmDoneBy: input.doneBy ?? caller.userId,
                tcmWitnessBy: input.witnessBy ?? null,
                tcmApprovalId: input.approvalId ?? null,
                tcmVoucherId: voucherId,
                tcmVoucherAccYear: voucherId ? session.tssAccYear : null,
                tcmStatus: 'POSTED',
                tcmDeviceId: input.deviceId ?? session.tssDeviceId,
                tcmNotes: input.notes ?? null,
                tcmCreatedBy: caller.actorName,
            },
        });
        await this.events.log(tx, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            accYear: session.tssAccYear,
            code: till_enum_1.TillEventCode.MOVEMENT_POSTED,
            sessionId: session.tssId,
            dayId: session.tssDayId,
            counterId: session.tssCounterId,
            deviceId: input.deviceId ?? session.tssDeviceId,
            userId: caller.userId,
            srcDocType: SRC_MOVEMENT,
            srcDocId: tcmId,
            srcRefno: docNo,
            amount,
            reasonId: input.reasonId ?? null,
            payload: {
                kind,
                safeId: safe?.safeId ?? null,
                ledgerId: input.ledgerId ?? null,
                voucherId,
                doneBy: input.doneBy ?? caller.userId,
                witnessBy: input.witnessBy ?? null,
            },
        });
        return { tcmId, docNo, voucherId };
    }
    async voidMovement(tx, input) {
        const { movement, session, caller } = input;
        let reversalId = null;
        if (movement.tcmVoucherId && movement.tcmVoucherAccYear) {
            const reversed = await this.posting.reverseLegs(tx, movement.tcmVoucherId, movement.tcmVoucherAccYear, `Till ${movement.tcmKind} ${movement.tcmDocNo} voided: ${input.reasonText}`, caller.actorName);
            reversalId = reversed?.voucherId ?? null;
        }
        await tx.tillCashMovement.update({
            where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
            data: {
                tcmStatus: 'VOIDED',
                tcmVoidReasonId: input.reasonId,
                tcmVoidedOn: new Date(),
                tcmVoidedBy: caller.userId,
                tcmVoidApprovalId: input.approvalId ?? null,
                tcmModifiedOn: new Date(),
                tcmModifiedBy: caller.actorName,
            },
        });
        await this.events.log(tx, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            accYear: session.tssAccYear,
            code: till_enum_1.TillEventCode.MOVEMENT_VOIDED,
            sessionId: session.tssId,
            dayId: session.tssDayId,
            counterId: session.tssCounterId,
            deviceId: caller.deviceId ?? session.tssDeviceId,
            userId: caller.userId,
            srcDocType: SRC_MOVEMENT,
            srcDocId: movement.tcmId,
            srcRefno: movement.tcmDocNo,
            amount: movement.tcmAmount,
            reasonId: input.reasonId,
            payload: { kind: movement.tcmKind, reversalVoucherId: reversalId },
        });
        return reversalId;
    }
    async postVariance(tx, input) {
        const { session, variance, caller } = input;
        let voucherId = null;
        if (!variance.isZero()) {
            const shortExcess = await this.ledger.roleLedger(tx, CASH_SHORT_EXCESS, session.tssCompanyId, session.tssBranchId);
            const size = money(variance.abs());
            const short = variance.isNegative();
            const legs = short
                ? [
                    {
                        ledgerId: shortExcess,
                        drCr: 'DR',
                        amount: size,
                        roleTag: CASH_SHORT_EXCESS,
                        oppLedgerId: input.tenderLedgerId,
                    },
                    { ledgerId: input.tenderLedgerId, drCr: 'CR', amount: size, oppLedgerId: shortExcess },
                ]
                : [
                    { ledgerId: input.tenderLedgerId, drCr: 'DR', amount: size, oppLedgerId: shortExcess },
                    {
                        ledgerId: shortExcess,
                        drCr: 'CR',
                        amount: size,
                        roleTag: CASH_SHORT_EXCESS,
                        oppLedgerId: input.tenderLedgerId,
                    },
                ];
            const voucher = await this.posting.postLegs(tx, {
                header: {
                    companyId: session.tssCompanyId,
                    branchId: session.tssBranchId,
                    tenantId: session.tssTenantId,
                    accYear: session.tssAccYear,
                    voucherTypeId: await this.voucherTypeId(tx, till_enum_1.VARIANCE_VOUCHER_TYPE),
                    voucherDate: session.businessDate,
                    srcModule: SRC_MODULE,
                    srcDocType: SRC_VARIANCE,
                    srcDocId: input.tvrId,
                    docLabel: `Till variance (${input.tenderLabel})`,
                    docAmount: size,
                    partyId: null,
                    userId: caller.userId,
                    sessionId: session.tssId,
                    deviceType: 'POS',
                    deviceId: session.tssDeviceId,
                    remarks: `${input.tenderLabel} ${short ? 'short' : 'excess'} ${size.toFixed(2)} (${input.treatment})`,
                    createdBy: caller.actorName,
                },
                legs,
            });
            voucherId = voucher.voucherId;
        }
        await tx.tillVariance.update({
            where: { tvrId_tvrAccYear: { tvrId: input.tvrId, tvrAccYear: session.tssAccYear } },
            data: {
                tvrStatus: 'POSTED',
                tvrVoucherId: voucherId,
                tvrVoucherAccYear: voucherId ? session.tssAccYear : null,
                tvrModifiedOn: new Date(),
                tvrModifiedBy: caller.actorName,
            },
        });
        return voucherId;
    }
    async voucherTypeId(tx, code) {
        const type = await tx.accVoucherType.findFirst({
            where: { vchrTypeCode: code, vchrIsActive: true },
            select: { vchrTypeId: true },
        });
        if (!type) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, `Voucher type ${code} is missing or inactive (migration 20261008100000 creates it)`, 'voucherType', { voucherType: code });
        }
        return type.vchrTypeId;
    }
    async newId(tx) {
        const [row] = await tx.$queryRaw `SELECT uuidv7()::text AS id`;
        return row.id;
    }
};
exports.TillPostingService = TillPostingService;
exports.TillPostingService = TillPostingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [voucher_posting_service_1.VoucherPostingService,
        till_ledger_service_1.TillLedgerService,
        till_event_service_1.TillEventService])
], TillPostingService);
function money(value) {
    return Number(value.toFixed(2));
}
//# sourceMappingURL=till-posting.service.js.map