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
exports.TenderSettlementExceptionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const rights_1 = require("../../../common/posting/rights");
const till_event_service_1 = require("../../till/services/till-event.service");
const till_enum_1 = require("../../till/types/till-enum");
const receipt_guards_1 = require("../receipt/receipt.guards");
const voucher_derive_1 = require("../vouchers/voucher-derive");
const settlement_format_1 = require("./settlement-format");
const tender_settlement_errors_1 = require("./tender-settlement-errors");
const tender_settlement_service_1 = require("./tender-settlement.service");
const tender_settlement_enum_1 = require("./types/tender-settlement-enum");
const TX = { maxWait: 15_000, timeout: 60_000 };
const num = (d) => Number(d.toFixed(2));
let TenderSettlementExceptionService = class TenderSettlementExceptionService {
    prisma;
    requestContext;
    posting;
    events;
    settlement;
    constructor(prisma, requestContext, posting, events, settlement) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.posting = posting;
        this.events = events;
        this.settlement = settlement;
    }
    async resolve(dto) {
        await this.requireOverride(tender_settlement_enum_1.SettlementErrorCode.RESOLVE_NEEDS_APPROVAL, 'resolve a statement line');
        const caller = await this.settlement.caller();
        const result = await this.prisma.$transaction(async (tx) => {
            const { head, line } = await this.settlement.lockLine(tx, dto);
            if (head.asiStatus !== tender_settlement_enum_1.SettlementImportStatus.POSTED) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `The payout is ${head.asiStatus}: before it is posted a line is simply matched (confirm with a tdId)`, 'aslId');
            }
            if (line.aslKind !== tender_settlement_enum_1.SettlementLineKind.SALE ||
                line.aslMatchStatus !== tender_settlement_enum_1.SettlementMatchStatus.UNMATCHED) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `Line ${line.aslRowNo} is a ${line.aslKind} line, ${line.aslMatchStatus}: only an unmatched SALE line waits in Tender suspense`, 'aslId');
            }
            await this.requireReason(tx, head.asiCompanyId, dto.reasonId);
            const gross = new client_1.Prisma.Decimal(line.aslGrossAmount);
            const suspense = await this.settlement.roleLedger(tx, tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE, head);
            const today = (0, settlement_format_1.istDate)(new Date());
            let row = null;
            let creditLedger = null;
            if (dto.resolution === tender_settlement_enum_1.SettlementResolution.LINKED) {
                if (!dto.tdId || !dto.tdAccYear) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.TD_NOT_CANDIDATE, 'LINKED names the bill’s tender row: send tdId and tdAccYear (re-tender the bill to this tender first if it was keyed as another)', 'tdId');
                }
                row = await this.settlement.candidateRow(tx, head, line, dto.tdId, dto.tdAccYear);
                await this.settlement.assertTdFree(tx, line, row.tdId, row.tdAccYear);
                creditLedger = row.ledgerId;
            }
            else if (dto.resolution === tender_settlement_enum_1.SettlementResolution.INCOME) {
                creditLedger = await this.incomeLedger(tx, head.asiCompanyId, dto.incomeLedgerId ?? null);
            }
            let voucher = null;
            if (creditLedger) {
                const accYear = (0, voucher_derive_1.accYearOfDate)(today);
                await (0, receipt_guards_1.assertAccYearWritable)(tx, head.asiCompanyId, accYear, 'accYear');
                await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, accYear, 'accYear');
                const posted = await this.posting.postLegs(tx, {
                    header: {
                        companyId: head.asiCompanyId,
                        branchId: head.asiBranchId,
                        tenantId: head.asiTenantId,
                        accYear,
                        voucherTypeId: await this.settlement.voucherTypeId(tx, tender_settlement_enum_1.SETTLEMENT_VOUCHER_TYPE_CODE),
                        voucherDate: today,
                        srcModule: tender_settlement_enum_1.SETTLEMENT_SRC_MODULE,
                        srcDocType: tender_settlement_enum_1.RESOLVE_SRC_DOC_TYPE,
                        srcDocId: line.aslId,
                        docLabel: 'Settlement line resolved',
                        docRefno: head.asiPayoutRef,
                        docDate: today,
                        docAmount: num(gross),
                        partyId: null,
                        userId: caller.userId,
                        deviceId: this.requestContext.getDeviceId() ?? null,
                        remarks: `${head.asiProvider} line ${line.aslRowNo} (${line.aslRefNo ?? 'no ref'}) ${dto.resolution}`,
                        createdBy: caller.actorName,
                    },
                    legs: [
                        {
                            ledgerId: suspense,
                            drCr: 'DR',
                            amount: num(gross),
                            roleTag: tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE,
                            oppLedgerId: creditLedger,
                        },
                        { ledgerId: creditLedger, drCr: 'CR', amount: num(gross), oppLedgerId: suspense },
                    ],
                });
                voucher = { voucherId: posted.voucherId, voucherRefno: posted.voucherRefno, accYear };
            }
            if (row && voucher) {
                const diff = gross.minus(row.amount);
                await tx.$executeRaw `
          UPDATE accounts.acc_tender_detail
             SET td_settle_status     = ${diff.isZero() ? 'SETTLED' : 'PARTIAL'},
                 td_settled_on        = ${head.asiPayoutDate}::date,
                 td_settle_amount     = ${gross}::numeric,
                 td_settle_ref_no     = ${(head.asiPayoutRef ?? head.asiFileName).slice(0, 60)},
                 td_settle_voucher_id = ${voucher.voucherId}::uuid,
                 td_modified_on       = now(),
                 td_modified_by       = ${caller.actorName}
           WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
            }
            const updated = await tx.accSettlementLine.update({
                where: { aslId_aslAccYear: { aslId: line.aslId, aslAccYear: line.aslAccYear } },
                data: {
                    aslMatchStatus: tender_settlement_enum_1.SettlementMatchStatus.RESOLVED,
                    aslMatchRule: null,
                    aslResolution: dto.resolution,
                    aslTdId: row?.tdId ?? null,
                    aslTdAccYear: row?.tdAccYear ?? null,
                    aslAmountDiff: row ? gross.minus(row.amount) : new client_1.Prisma.Decimal(0),
                    aslReasonId: dto.reasonId,
                    aslResolutionVoucherId: voucher?.voucherId ?? null,
                    aslResolutionAccYear: voucher?.accYear ?? null,
                    aslNotes: dto.notes ?? line.aslNotes,
                    aslModifiedOn: new Date(),
                },
            });
            return { line: updated, voucher };
        }, TX);
        return {
            line: await this.settlement.linePayloadOf(this.prisma, result.line),
            voucherId: result.voucher?.voucherId ?? null,
            voucherRefno: result.voucher?.voucherRefno ?? null,
            legs: await this.settlement.legsOf(result.voucher?.voucherId ?? null, result.voucher?.accYear ?? null),
            approvalEvent: 'SETTLEMENT_RESOLVE',
        };
    }
    async writeOff(dto) {
        await this.requireOverride(tender_settlement_enum_1.SettlementErrorCode.WRITE_OFF_NEEDS_APPROVAL, 'write off a card / UPI amount');
        const caller = await this.settlement.caller();
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT td_id FROM accounts.acc_tender_detail
         WHERE td_id = ${dto.tdId}::uuid AND td_acc_year = ${dto.tdAccYear}::char(9) FOR UPDATE`;
            const row = (await this.settlement.rowsOf(tx, [{ tdId: dto.tdId, tdAccYear: dto.tdAccYear }])).get(dto.tdId);
            if (!row || row.companyId !== dto.companyId || row.branchId !== dto.branchId) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.NOT_FOUND, `No tender row ${dto.tdId} in this store`, 'tdId');
            }
            if (row.isDeleted || row.isVoided || row.drCr !== 'DR' || row.tenderTypeId === 1) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, 'Only a live money-in card / UPI / wallet row is written off', 'tdId');
            }
            const scope = { asiCompanyId: row.companyId, asiBranchId: row.branchId };
            const suspense = await this.settlement.roleLedger(tx, tender_settlement_enum_1.SettlementRole.TENDER_SUSPENSE, scope);
            const chargeback = await this.chargebackOf(tx, row);
            const held = await tx.$queryRaw `
        SELECT count(*)::int AS n
          FROM accounts.acc_settlement_line l
          JOIN accounts.acc_settlement_import i ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
         WHERE l.asl_td_id = ${row.tdId}::uuid AND l.asl_td_acc_year = ${row.tdAccYear}::char(9)
           AND l.asl_kind = 'SALE' AND l.asl_match_status IN ('MATCHED','SUGGESTED')
           AND i.asi_status IN ('IMPORTED','MATCHED') AND i.asi_is_deleted = false`;
            if (held[0].n > 0) {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, 'A statement not yet posted already pays this row: post (or unlink) it first', 'tdId');
            }
            let amount;
            let creditLedger;
            if (row.settleStatus === 'PENDING' || row.settleStatus === 'PARTIAL') {
                amount =
                    row.settleStatus === 'PARTIAL' && row.settleAmount
                        ? row.amount.minus(row.settleAmount)
                        : row.amount;
                if (!amount.greaterThan(0)) {
                    (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.POSTED_LOCKED, 'The provider paid this row in full (or more): nothing is missing', 'tdId');
                }
                creditLedger = (await this.settlement.parkedRows(tx, [row.tdId])).has(row.tdId)
                    ? suspense
                    : row.ledgerId;
            }
            else if (row.settleStatus === 'FAILED' && chargeback && !chargeback.writtenOff) {
                amount = chargeback.amount;
                creditLedger = suspense;
            }
            else if (row.settleStatus === 'SETTLED') {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.POSTED_LOCKED, 'A posted payout settled this row: nothing to write off', 'tdId');
            }
            else {
                (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.STATE, `The row is ${row.settleStatus}${row.settleStatus === 'FAILED' ? ' and already written off' : ''}: it waits for no statement`, 'tdId');
            }
            await this.requireReason(tx, dto.companyId, dto.reasonId);
            const debitLedger = dto.treatment === tender_settlement_enum_1.WriteOffTreatment.SUSPENSE
                ? suspense
                : dto.treatment === tender_settlement_enum_1.WriteOffTreatment.LOSS
                    ? await this.settlement.roleLedger(tx, tender_settlement_enum_1.SettlementRole.WRITE_OFF, scope)
                    : await this.recoveryLedger(tx, dto.companyId, dto.recoveryLedgerId ?? null);
            const today = (0, settlement_format_1.istDate)(new Date());
            const accYear = (0, voucher_derive_1.accYearOfDate)(today);
            let voucher = null;
            if (debitLedger !== creditLedger) {
                await (0, receipt_guards_1.assertAccYearWritable)(tx, dto.companyId, accYear, 'accYear');
                await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, accYear, 'accYear');
                const session = await this.realSession(tx, row.sessionId);
                voucher = await this.posting.postLegs(tx, {
                    header: {
                        companyId: row.companyId,
                        branchId: row.branchId,
                        accYear,
                        voucherTypeId: await this.settlement.voucherTypeId(tx, tender_settlement_enum_1.WRITE_OFF_VOUCHER_TYPE_CODE),
                        voucherDate: today,
                        srcModule: tender_settlement_enum_1.SETTLEMENT_SRC_MODULE,
                        srcDocType: tender_settlement_enum_1.WRITE_OFF_SRC_DOC_TYPE,
                        srcDocId: row.tdId,
                        docLabel: 'Non-cash write-off',
                        docAmount: num(amount),
                        partyId: null,
                        userId: caller.userId,
                        sessionId: session?.tssId ?? null,
                        deviceId: this.requestContext.getDeviceId() ?? null,
                        remarks: `${chargeback ? 'Chargeback' : 'Not received'} ${num(amount).toFixed(2)} (${dto.treatment})`,
                        createdBy: caller.actorName,
                    },
                    legs: [
                        { ledgerId: debitLedger, drCr: 'DR', amount: num(amount), oppLedgerId: creditLedger },
                        { ledgerId: creditLedger, drCr: 'CR', amount: num(amount), oppLedgerId: debitLedger },
                    ],
                });
            }
            await tx.$executeRaw `
        UPDATE accounts.acc_tender_detail
           SET td_settle_status     = 'FAILED',
               td_settle_voucher_id = COALESCE(${voucher?.voucherId ?? null}::uuid, td_settle_voucher_id),
               td_modified_on       = now(),
               td_modified_by       = ${caller.actorName}
         WHERE td_id = ${row.tdId}::uuid AND td_acc_year = ${row.tdAccYear}::char(9)`;
            const session = await this.realSession(tx, row.sessionId);
            await this.events.log(tx, {
                companyId: row.companyId,
                branchId: row.branchId,
                accYear: session?.tssAccYear ?? accYear,
                code: till_enum_1.TillEventCode.NONCASH_WRITTEN_OFF,
                sessionId: session?.tssId ?? null,
                dayId: session?.tssDayId ?? null,
                counterId: session?.tssCounterId ?? null,
                deviceId: this.requestContext.getDeviceId() ?? null,
                userId: caller.userId,
                srcDocType: row.srcDocType,
                srcDocId: row.srcDocId,
                srcRefno: voucher?.voucherRefno ?? null,
                amount,
                reasonId: dto.reasonId,
                payload: {
                    tdId: row.tdId,
                    treatment: dto.treatment,
                    chargeback: !!chargeback,
                    debitLedgerId: debitLedger,
                    creditLedgerId: creditLedger,
                    voucherId: voucher?.voucherId ?? null,
                    approval: { event: 'NONCASH_WRITE_OFF', standIn: 'menu 278 OVERRIDE', by: caller.userId },
                    notes: dto.notes ?? null,
                },
            });
            return {
                tdId: row.tdId,
                tdAccYear: row.tdAccYear,
                treatment: dto.treatment,
                amount: num(amount),
                debitLedgerId: debitLedger,
                creditLedgerId: creditLedger,
                voucherId: voucher?.voucherId ?? null,
                voucherRefno: voucher?.voucherRefno ?? null,
                voucherAccYear: voucher ? accYear : null,
                sessionId: session?.tssId ?? null,
                approvalEvent: 'NONCASH_WRITE_OFF',
            };
        }, TX);
    }
    async requireOverride(code, action) {
        const userId = this.requestContext.getUserId();
        const rights = userId ? await (0, rights_1.loadRights)(this.prisma, userId, tender_settlement_enum_1.SETTLEMENT_MENU_ID) : null;
        if (!rights?.override) {
            (0, tender_settlement_errors_1.throwSettlement)(code, `Only an approver may ${action}: OVERRIDE on Settlement Reconciliation (menu ${tender_settlement_enum_1.SETTLEMENT_MENU_ID}) stands in for the approval until the approval gate ships`, 'userId', {
                event: code === tender_settlement_enum_1.SettlementErrorCode.WRITE_OFF_NEEDS_APPROVAL
                    ? 'NONCASH_WRITE_OFF'
                    : 'SETTLEMENT_RESOLVE',
                requiredRole: 'STORE_MANAGER',
            });
        }
    }
    async requireReason(tx, companyId, reasonId) {
        const reason = await tx.tillReason.findFirst({
            where: {
                trsId: reasonId,
                trsCategory: tender_settlement_enum_1.NONCASH_REASON_CATEGORY,
                trsIsActive: true,
                trsIsDeleted: false,
                OR: [{ trsCompanyId: null }, { trsCompanyId: companyId }],
            },
            select: { trsId: true },
        });
        if (!reason) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.REASON_INVALID, 'Name a live NONCASH reason (Till Masters → reasons)', 'reasonId');
        }
    }
    async chargebackOf(tx, row) {
        const [hit] = await tx.$queryRaw `
      SELECT l.asl_gross_amount AS gross,
             EXISTS (SELECT 1 FROM accounts.acc_voucher_header w
                      WHERE w.avh_voucher_id = ${row.settleVoucherId}::uuid
                        AND w.avh_src_doc_type = ${tender_settlement_enum_1.WRITE_OFF_SRC_DOC_TYPE}) AS written_off
        FROM accounts.acc_settlement_line l
        JOIN accounts.acc_settlement_import i ON i.asi_id = l.asl_import_id AND i.asi_acc_year = l.asl_acc_year
       WHERE l.asl_td_id = ${row.tdId}::uuid AND l.asl_td_acc_year = ${row.tdAccYear}::char(9)
         AND l.asl_kind = 'CHARGEBACK' AND l.asl_match_status = 'MATCHED'
         AND i.asi_status = 'POSTED' AND i.asi_is_deleted = false
       ORDER BY i.asi_posted_on DESC
       LIMIT 1`;
        return hit ? { amount: new client_1.Prisma.Decimal(hit.gross), writtenOff: hit.written_off } : null;
    }
    async recoveryLedger(tx, companyId, ledgerId) {
        if (!ledgerId) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.LEDGER_INVALID, 'RECOVER names the ledger the amount is recovered from (the cashier’s, say): send recoveryLedgerId', 'recoveryLedgerId');
        }
        const ledger = await tx.accLedgerMaster.findFirst({
            where: {
                ledId: ledgerId,
                ledIsDeleted: false,
                ledIsActive: true,
                OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
            },
            select: { ledId: true },
        });
        if (!ledger) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.LEDGER_INVALID, 'The recovery ledger is not a live ledger of this company', 'recoveryLedgerId');
        }
        return ledger.ledId;
    }
    async incomeLedger(tx, companyId, ledgerId) {
        if (!ledgerId) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.LEDGER_INVALID, 'INCOME names the income ledger the money is booked to: send incomeLedgerId', 'incomeLedgerId');
        }
        const [hit] = await tx.$queryRaw `
      WITH RECURSIVE up AS (
        SELECT g.acc_group_id, g.acc_group_parent_id, g.acc_group_nature, 0 AS d
          FROM accounts.acc_ledger_master l
          JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
         WHERE l.led_id = ${ledgerId}::uuid AND l.led_is_deleted = false AND l.led_is_active
           AND (l.led_company_id IS NULL OR l.led_company_id = ${companyId}::uuid)
        UNION ALL
        SELECT p.acc_group_id, p.acc_group_parent_id, p.acc_group_nature, up.d + 1
          FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
         WHERE up.d < 24
      )
      SELECT bool_or(acc_group_nature = 'Income') AS ok FROM up`;
        if (!hit?.ok) {
            (0, tender_settlement_errors_1.throwSettlement)(tender_settlement_enum_1.SettlementErrorCode.LEDGER_INVALID, 'The income ledger must be a live ledger of this company under an Income group', 'incomeLedgerId');
        }
        return ledgerId;
    }
    async realSession(tx, sessionId) {
        if (!sessionId)
            return null;
        return tx.tillSession.findFirst({
            where: { tssId: sessionId, tssIsDeleted: false },
            select: { tssId: true, tssAccYear: true, tssDayId: true, tssCounterId: true },
        });
    }
};
exports.TenderSettlementExceptionService = TenderSettlementExceptionService;
exports.TenderSettlementExceptionService = TenderSettlementExceptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        voucher_posting_service_1.VoucherPostingService,
        till_event_service_1.TillEventService,
        tender_settlement_service_1.TenderSettlementService])
], TenderSettlementExceptionService);
//# sourceMappingURL=tender-settlement-exceptions.service.js.map