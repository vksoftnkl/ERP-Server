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
const SRC_RECEIVE = 'TILL_RECEIVE';
const SRC_REMIT_CONFIRM = 'TILL_REMIT_CONFIRM';
const REMIT_VOUCHER_TYPE = till_enum_1.MOVEMENT_VOUCHER_TYPE[till_enum_1.TillMovementKind.REMIT] ?? 'CRem';
const CASH_SHORT_EXCESS = 'CASH_SHORT_EXCESS';
const TENDER_SUSPENSE = 'TENDER_SUSPENSE';
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
        const awaiting = input.awaitingLedgerId ?? null;
        if (awaiting && !till_enum_1.RECEIPT_MOVEMENTS.includes(kind)) {
            throw new Error(`Till movement ${kind} never waits for a receipt`);
        }
        const other = kind === till_enum_1.TillMovementKind.PAID_IN
            ? (input.ledgerId ?? null)
            : (awaiting ?? safe?.ledgerId ?? null);
        if (typeCode && !other) {
            throw new Error(`Till movement ${kind} has no ledger to post against`);
        }
        const otherLabel = kind === till_enum_1.TillMovementKind.PAID_IN
            ? 'ledger'
            : awaiting
                ? `awaiting receipt into ${safe?.name ?? 'the safe'}`
                : (safe?.name ?? 'safe');
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
                tcmWitnessVerifiedOn: input.witnessVerifiedOn ?? null,
                tcmApprovalId: input.approvalId ?? null,
                tcmVoucherId: voucherId,
                tcmVoucherAccYear: voucherId ? session.tssAccYear : null,
                tcmStatus: 'POSTED',
                tcmDeviceId: input.deviceId ?? session.tssDeviceId,
                tcmNotes: input.notes ?? null,
                tcmCreatedBy: caller.actorName,
                tcmReceiptStatus: awaiting ? till_enum_1.TillReceiptStatus.AWAITING : null,
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
                witnessVerifiedOn: input.witnessVerifiedOn?.toISOString() ?? null,
                receipt: awaiting ? till_enum_1.TillReceiptStatus.AWAITING : null,
            },
        });
        return { tcmId, docNo, voucherId };
    }
    async postRemit(tx, input) {
        const { scope, safe, caller } = input;
        const tcmId = input.tcmId ?? (await this.newId(tx));
        const cit = input.mode === till_enum_1.TillRemitMode.CIT;
        const debit = cit ? input.transitLedgerId : input.bankLedgerId;
        if (!debit) {
            throw new Error('A CIT remittance posts to Cash in transit, and none was resolved');
        }
        const size = money(input.amount);
        const voucher = await this.posting.postLegs(tx, {
            header: {
                companyId: scope.companyId,
                branchId: scope.branchId,
                tenantId: scope.tenantId,
                accYear: scope.accYear,
                voucherTypeId: await this.voucherTypeId(tx, REMIT_VOUCHER_TYPE),
                voucherDate: scope.date,
                srcModule: SRC_MODULE,
                srcDocType: SRC_MOVEMENT,
                srcDocId: tcmId,
                docLabel: cit ? 'Cash remittance (in transit)' : 'Cash remittance (bank deposit)',
                docRefno: input.slipNo ?? null,
                docAmount: size,
                partyId: null,
                userId: caller.userId,
                sessionId: null,
                deviceType: caller.deviceId ? 'POS' : null,
                deviceId: caller.deviceId,
                remarks: input.notes ??
                    `Cash from ${safe.name} ${cit ? `to ${input.citAgency ?? 'the CIT agency'}` : 'paid into the bank'}`,
                createdBy: caller.actorName,
            },
            legs: [
                { ledgerId: debit, drCr: 'DR', amount: size, oppLedgerId: safe.ledgerId },
                { ledgerId: safe.ledgerId, drCr: 'CR', amount: size, oppLedgerId: debit },
            ],
        });
        const docNo = voucher.voucherRefno ?? voucher.voucherNo ?? tcmId;
        const status = cit ? till_enum_1.TillRemitStatus.IN_TRANSIT : till_enum_1.TillRemitStatus.DEPOSITED;
        await tx.tillCashMovement.create({
            data: {
                tcmId,
                tcmCompanyId: scope.companyId,
                tcmBranchId: scope.branchId,
                tcmTenantId: scope.tenantId,
                tcmAccYear: scope.accYear,
                tcmKind: till_enum_1.TillMovementKind.REMIT,
                tcmDocNo: docNo,
                tcmDocDate: new Date(`${scope.date}T00:00:00.000Z`),
                tcmDayId: scope.dayId,
                tcmSessionId: null,
                tcmSafeId: safe.safeId,
                tcmAmount: input.amount,
                tcmLedgerId: input.bankLedgerId,
                tcmRefNo: input.slipNo ?? null,
                tcmRefDate: input.slipDate ? new Date(`${input.slipDate}T00:00:00.000Z`) : null,
                tcmCountId: input.countId ?? null,
                tcmBagNo: input.bagNo ?? null,
                tcmSealNo: input.sealNo ?? null,
                tcmCitAgency: input.citAgency ?? null,
                tcmDoneBy: caller.userId,
                tcmApprovalId: input.approvalId ?? null,
                tcmVoucherId: voucher.voucherId,
                tcmVoucherAccYear: scope.accYear,
                tcmStatus: 'POSTED',
                tcmDeviceId: caller.deviceId,
                tcmNotes: input.notes ?? null,
                tcmCreatedBy: caller.actorName,
                tcmRemitMode: input.mode,
                tcmRemitStatus: status,
            },
        });
        await this.events.log(tx, {
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
            code: till_enum_1.TillEventCode.MOVEMENT_POSTED,
            dayId: scope.dayId,
            deviceId: caller.deviceId,
            userId: caller.userId,
            srcDocType: SRC_MOVEMENT,
            srcDocId: tcmId,
            srcRefno: docNo,
            amount: input.amount,
            approvalId: input.approvalId ?? null,
            payload: {
                kind: till_enum_1.TillMovementKind.REMIT,
                mode: input.mode,
                status,
                safeId: safe.safeId,
                bankLedgerId: input.bankLedgerId,
                voucherId: voucher.voucherId,
                bagNo: input.bagNo ?? null,
                sealNo: input.sealNo ?? null,
                citAgency: input.citAgency ?? null,
                slipNo: input.slipNo ?? null,
            },
        });
        return { tcmId, docNo, voucherId: voucher.voucherId };
    }
    async postRemitConfirm(tx, input) {
        const { movement, scope, caller } = input;
        if (!movement.tcmLedgerId) {
            throw new Error(`Remittance ${movement.tcmDocNo} names no bank`);
        }
        let voucherId = null;
        if (input.bankAmount.greaterThan(0)) {
            const size = money(input.bankAmount);
            const voucher = await this.posting.postLegs(tx, {
                header: {
                    companyId: scope.companyId,
                    branchId: scope.branchId,
                    tenantId: scope.tenantId,
                    accYear: scope.accYear,
                    voucherTypeId: await this.voucherTypeId(tx, REMIT_VOUCHER_TYPE),
                    voucherDate: scope.date,
                    srcModule: SRC_MODULE,
                    srcDocType: SRC_REMIT_CONFIRM,
                    srcDocId: movement.tcmId,
                    docLabel: `Cash remittance confirmed (${movement.tcmDocNo})`,
                    docRefno: input.bankRef,
                    docAmount: size,
                    partyId: null,
                    userId: caller.userId,
                    sessionId: null,
                    deviceType: caller.deviceId ? 'POS' : null,
                    deviceId: caller.deviceId,
                    remarks: input.notes ?? `${movement.tcmDocNo} credited by the bank, ref ${input.bankRef}`,
                    createdBy: caller.actorName,
                },
                legs: [
                    {
                        ledgerId: movement.tcmLedgerId,
                        drCr: 'DR',
                        amount: size,
                        oppLedgerId: input.transitLedgerId,
                    },
                    {
                        ledgerId: input.transitLedgerId,
                        drCr: 'CR',
                        amount: size,
                        oppLedgerId: movement.tcmLedgerId,
                    },
                ],
            });
            voucherId = voucher.voucherId;
        }
        const now = new Date();
        await tx.tillCashMovement.update({
            where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
            data: {
                tcmRemitStatus: till_enum_1.TillRemitStatus.CONFIRMED,
                tcmBankDate: new Date(`${input.bankDate}T00:00:00.000Z`),
                tcmBankRef: input.bankRef,
                tcmBankAmount: input.bankAmount,
                tcmConfirmedBy: caller.userId,
                tcmConfirmedOn: now,
                tcmConfirmVoucherId: voucherId,
                tcmConfirmVoucherAccYear: voucherId ? scope.accYear : null,
                tcmModifiedOn: now,
                tcmModifiedBy: caller.actorName,
            },
        });
        await this.events.log(tx, {
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: movement.tcmAccYear,
            code: till_enum_1.TillEventCode.REMIT_CONFIRMED,
            dayId: movement.tcmDayId,
            deviceId: caller.deviceId,
            userId: caller.userId,
            srcDocType: SRC_MOVEMENT,
            srcDocId: movement.tcmId,
            srcRefno: movement.tcmDocNo,
            amount: input.bankAmount,
            payload: {
                sent: movement.tcmAmount.toFixed(2),
                credited: input.bankAmount.toFixed(2),
                difference: input.bankAmount.minus(movement.tcmAmount).toFixed(2),
                bankDate: input.bankDate,
                bankRef: input.bankRef,
                safeId: movement.tcmSafeId,
                voucherId,
            },
        });
        return voucherId;
    }
    async postReceive(tx, input) {
        const { movement, session, safe, caller } = input;
        let voucherId = null;
        if (input.received.greaterThan(0)) {
            const size = money(input.received);
            const voucher = await this.posting.postLegs(tx, {
                header: {
                    companyId: session.tssCompanyId,
                    branchId: session.tssBranchId,
                    tenantId: session.tssTenantId,
                    accYear: input.on.accYear,
                    voucherTypeId: await this.voucherTypeId(tx, till_enum_1.RECEIVE_VOUCHER_TYPE),
                    voucherDate: input.on.date,
                    srcModule: SRC_MODULE,
                    srcDocType: SRC_RECEIVE,
                    srcDocId: movement.tcmId,
                    docLabel: `Till cash received (${movement.tcmDocNo})`,
                    docRefno: movement.tcmDocNo,
                    docAmount: size,
                    partyId: null,
                    userId: caller.userId,
                    sessionId: session.tssId,
                    deviceType: 'POS',
                    deviceId: caller.deviceId ?? session.tssDeviceId,
                    remarks: input.notes ??
                        `${movement.tcmKind} ${movement.tcmDocNo} (${session.sessionNo}) received into ${safe.name}`,
                    createdBy: caller.actorName,
                },
                legs: [
                    {
                        ledgerId: safe.ledgerId,
                        drCr: 'DR',
                        amount: size,
                        oppLedgerId: input.awaitingLedgerId,
                    },
                    {
                        ledgerId: input.awaitingLedgerId,
                        drCr: 'CR',
                        amount: size,
                        oppLedgerId: safe.ledgerId,
                    },
                ],
            });
            voucherId = voucher.voucherId;
        }
        const now = new Date();
        await tx.tillCashMovement.update({
            where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
            data: {
                tcmReceiptStatus: till_enum_1.TillReceiptStatus.RECEIVED,
                tcmReceivedBy: caller.userId,
                tcmReceivedOn: now,
                tcmReceivedAmount: input.received,
                tcmReceiveCountId: input.countId,
                tcmReceiveVoucherId: voucherId,
                tcmReceiveVoucherAccYear: voucherId ? input.on.accYear : null,
                tcmModifiedOn: now,
                tcmModifiedBy: caller.actorName,
            },
        });
        await this.events.log(tx, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            accYear: session.tssAccYear,
            code: till_enum_1.TillEventCode.CASH_RECEIVED,
            sessionId: session.tssId,
            dayId: session.tssDayId,
            counterId: session.tssCounterId,
            deviceId: caller.deviceId ?? session.tssDeviceId,
            userId: caller.userId,
            srcDocType: SRC_MOVEMENT,
            srcDocId: movement.tcmId,
            srcRefno: movement.tcmDocNo,
            amount: input.received,
            payload: {
                kind: movement.tcmKind,
                handedOver: movement.tcmAmount.toFixed(2),
                received: input.received.toFixed(2),
                difference: input.received.minus(movement.tcmAmount).toFixed(2),
                safeId: safe.safeId,
                countId: input.countId,
                voucherId,
                receivedOn: input.on.date,
            },
        });
        return voucherId;
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
            companyId: session?.tssCompanyId ?? input.companyId,
            branchId: session?.tssBranchId ?? input.branchId,
            accYear: movement.tcmAccYear,
            code: till_enum_1.TillEventCode.MOVEMENT_VOIDED,
            sessionId: session?.tssId ?? null,
            dayId: session?.tssDayId ?? input.dayId ?? null,
            counterId: session?.tssCounterId ?? null,
            deviceId: caller.deviceId ?? session?.tssDeviceId ?? null,
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
    async reverseVariance(tx, input) {
        const { variance, caller } = input;
        let reversalId = null;
        if (variance.tvrVoucherId && variance.tvrVoucherAccYear) {
            const reversed = await this.posting.reverseLegs(tx, variance.tvrVoucherId, variance.tvrVoucherAccYear, `Till variance reversed: ${input.reasonText}`, caller.actorName);
            reversalId = reversed?.voucherId ?? null;
        }
        await tx.tillVariance.update({
            where: { tvrId_tvrAccYear: { tvrId: variance.tvrId, tvrAccYear: variance.tvrAccYear } },
            data: {
                tvrStatus: 'REVERSED',
                tvrModifiedOn: new Date(),
                tvrModifiedBy: caller.actorName,
            },
        });
        return reversalId;
    }
    async postVariance(tx, input) {
        const { session } = input;
        const on = input.on ?? { date: session.businessDate, accYear: session.tssAccYear };
        const voucherId = await this.postVarianceVoucher(tx, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            tenantId: session.tssTenantId,
            on,
            sessionId: session.tssId,
            deviceId: session.tssDeviceId,
            tvrId: input.tvrId,
            tenderLedgerId: input.tenderLedgerId,
            tenderLabel: input.tenderLabel,
            variance: input.variance,
            treatment: input.treatment,
            recoveryLedgerId: input.recoveryLedgerId ?? null,
            caller: input.caller,
        });
        await this.markVariancePosted(tx, input.tvrId, session.tssAccYear, voucherId, on, input.caller);
        return voucherId;
    }
    async postSafeVariance(tx, input) {
        const on = { date: input.scope.date, accYear: input.scope.accYear };
        const voucherId = await this.postVarianceVoucher(tx, {
            companyId: input.scope.companyId,
            branchId: input.scope.branchId,
            tenantId: input.scope.tenantId,
            on,
            sessionId: null,
            deviceId: input.caller.deviceId,
            tvrId: input.tvrId,
            tenderLedgerId: input.ledgerId,
            tenderLabel: input.label,
            variance: input.variance,
            treatment: input.treatment,
            recoveryLedgerId: null,
            caller: input.caller,
        });
        await this.markVariancePosted(tx, input.tvrId, input.tvrAccYear, voucherId, on, input.caller);
        return voucherId;
    }
    async postVarianceVoucher(tx, input) {
        const { variance, caller, on } = input;
        if (variance.isZero()) {
            return null;
        }
        const counter = await this.varianceCounterLedger(tx, { companyId: input.companyId, branchId: input.branchId }, input.treatment, input.recoveryLedgerId);
        const size = money(variance.abs());
        const short = variance.isNegative();
        const legs = short
            ? [
                {
                    ledgerId: counter.ledgerId,
                    drCr: 'DR',
                    amount: size,
                    roleTag: counter.roleTag,
                    oppLedgerId: input.tenderLedgerId,
                },
                {
                    ledgerId: input.tenderLedgerId,
                    drCr: 'CR',
                    amount: size,
                    oppLedgerId: counter.ledgerId,
                },
            ]
            : [
                {
                    ledgerId: input.tenderLedgerId,
                    drCr: 'DR',
                    amount: size,
                    oppLedgerId: counter.ledgerId,
                },
                {
                    ledgerId: counter.ledgerId,
                    drCr: 'CR',
                    amount: size,
                    roleTag: counter.roleTag,
                    oppLedgerId: input.tenderLedgerId,
                },
            ];
        const voucher = await this.posting.postLegs(tx, {
            header: {
                companyId: input.companyId,
                branchId: input.branchId,
                tenantId: input.tenantId,
                accYear: on.accYear,
                voucherTypeId: await this.voucherTypeId(tx, till_enum_1.VARIANCE_VOUCHER_TYPE),
                voucherDate: on.date,
                srcModule: SRC_MODULE,
                srcDocType: SRC_VARIANCE,
                srcDocId: input.tvrId,
                docLabel: `Till variance (${input.tenderLabel})`,
                docAmount: size,
                partyId: null,
                userId: caller.userId,
                sessionId: input.sessionId,
                deviceType: input.deviceId ? 'POS' : null,
                deviceId: input.deviceId,
                remarks: `${input.tenderLabel} ${short ? 'short' : 'excess'} ${size.toFixed(2)} (${input.treatment})`,
                createdBy: caller.actorName,
            },
            legs,
        });
        return voucher.voucherId;
    }
    async markVariancePosted(tx, tvrId, tvrAccYear, voucherId, on, caller) {
        await tx.tillVariance.update({
            where: { tvrId_tvrAccYear: { tvrId, tvrAccYear } },
            data: {
                tvrStatus: 'POSTED',
                tvrVoucherId: voucherId,
                tvrVoucherAccYear: voucherId ? on.accYear : null,
                tvrModifiedOn: new Date(),
                tvrModifiedBy: caller.actorName,
            },
        });
    }
    async varianceCounterLedger(tx, scope, treatment, recoveryLedgerId) {
        switch (treatment) {
            case till_enum_1.TillVarianceTreatment.RECOVER:
                if (!recoveryLedgerId) {
                    (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, 'RECOVER posts to the cashier’s staff advance ledger, and this variance names none', 'treatment', { treatment });
                }
                return { ledgerId: recoveryLedgerId, roleTag: null };
            case till_enum_1.TillVarianceTreatment.SUSPENSE:
                return {
                    ledgerId: await this.ledger.roleLedger(tx, TENDER_SUSPENSE, scope.companyId, scope.branchId),
                    roleTag: TENDER_SUSPENSE,
                };
            default:
                return {
                    ledgerId: await this.ledger.roleLedger(tx, CASH_SHORT_EXCESS, scope.companyId, scope.branchId),
                    roleTag: CASH_SHORT_EXCESS,
                };
        }
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