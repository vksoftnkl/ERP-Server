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
exports.IssuedChequesService = exports.ISSUED_CHEQUES_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const cheques_guards_1 = require("../cheques/cheques.guards");
const cheques_utils_1 = require("../cheques/cheques.utils");
const cheque_voucher_helper_1 = require("../cheques/cheque-voucher.helper");
const cheque_reversal_helper_1 = require("../cheques/cheque-reversal.helper");
const cheque_ledger_roles_1 = require("../cheques/cheque-ledger-roles");
const cheque_enum_1 = require("../cheques/types/cheque-enum");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const voucher_derive_1 = require("../vouchers/voucher-derive");
const voucher_books_helper_1 = require("../vouchers/voucher-books.helper");
const voucher_register_service_1 = require("../vouchers/voucher-register.service");
const vouchers_errors_1 = require("../vouchers/vouchers.errors");
exports.ISSUED_CHEQUES_MENU_ID = 52;
const TX = { maxWait: 15_000, timeout: 120_000 };
const ZERO = new client_1.Prisma.Decimal(0);
let IssuedChequesService = class IssuedChequesService {
    prisma;
    requestContext;
    recompute;
    register;
    constructor(prisma, requestContext, recompute, register) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.recompute = recompute;
        this.register = register;
    }
    caller() {
        const userId = this.requestContext.getUserId() ?? null;
        return { userId, actor: userId ?? module_service_utils_1.DEFAULT_ACTOR };
    }
    async rights(tx, userId) {
        if (!userId) {
            (0, vouchers_errors_1.throwRight)('No user on the request', vouchers_errors_1.VCH.RIGHT_VIEW);
        }
        return (0, rights_1.loadRights)(tx, userId, exports.ISSUED_CHEQUES_MENU_ID);
    }
    async requireRight(tx, userId, right, code, verb) {
        const r = await this.rights(tx, userId);
        if (!r[right]) {
            (0, vouchers_errors_1.throwRight)(`This user may not ${verb} on Issued Cheques (menu 52)`, code);
        }
    }
    async get(keys) {
        const tx = this.prisma;
        await this.requireRight(tx, this.caller().userId, 'view', vouchers_errors_1.VCH.RIGHT_VIEW, 'view');
        return this.load(tx, keys);
    }
    async history(keys) {
        const tx = this.prisma;
        await this.requireRight(tx, this.caller().userId, 'view', vouchers_errors_1.VCH.RIGHT_VIEW, 'view');
        const cheque = await this.load(tx, keys);
        const entries = await this.prisma.txnStatusLog.findMany({
            where: {
                tslSrcDocType: txn_status_log_helper_1.TxnStatusDocType.CHEQUE_ISSUED,
                tslSrcDocId: cheque.apdId,
                tslAccYear: cheque.apdAccYear,
            },
            orderBy: { tslSeqNo: 'asc' },
            select: {
                tslSeqNo: true,
                tslEvent: true,
                tslFromStatus: true,
                tslToStatus: true,
                tslChangedOn: true,
                tslChangedBy: true,
                tslRemarks: true,
            },
        });
        return {
            apdId: cheque.apdId,
            apdAccYear: cheque.apdAccYear,
            leaf: cheque.leaf,
            issuedOn: cheque.issuedOn,
            issuedBy: cheque.createdBy,
            voucherRefno: cheque.voucherRefno,
            entries: entries.map((e) => ({
                seqNo: e.tslSeqNo,
                event: e.tslEvent,
                fromStatus: e.tslFromStatus,
                toStatus: e.tslToStatus,
                changedOn: e.tslChangedOn.toISOString(),
                changedBy: e.tslChangedBy,
                remarks: e.tslRemarks,
            })),
        };
    }
    async presented(dto) {
        const { userId, actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            await this.requireRight(tx, userId, 'post', vouchers_errors_1.VCH.RIGHT_POST, 'mark cheques presented');
            const cheque = await this.lock(tx, dto);
            this.assertHeld(cheque, 'presented');
            const day = isoDate(cheque.apdInstrumentDate);
            if (dto.date < day) {
                (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo} is dated ${day}; the bank cannot have paid it on ${dto.date}`, vouchers_errors_1.VCH.CHEQUE_STATE, 'date');
            }
            const on = new Date(`${dto.date}T00:00:00Z`);
            const now = new Date();
            await tx.$executeRaw `
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'CLEARED', apd_status_on = ${now}, apd_status_by = ${actor},
               apd_deposit_date = ${on}::date, apd_clear_date = ${on}::date,
               apd_present_count = apd_present_count + 1,
               apd_remarks = COALESCE(${dto.remarks ?? null}, apd_remarks),
               apd_modified_on = ${now}, apd_modified_by = ${actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
            await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                fromStatus: receipt_enum_1.PdcStatus.HELD,
                toStatus: receipt_enum_1.PdcStatus.CLEARED,
                event: txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED,
                remarks: `Presented and paid on ${dto.date}${dto.remarks ? ` — ${dto.remarks}` : ''}`,
                actor,
                changedOn: now,
            });
            return this.load(tx, dto);
        }, TX);
    }
    async returned(dto) {
        return this.unwindRoute(dto, 'RETURNED', dto.date, dto.reason, dto.charges ?? 0);
    }
    async stop(dto) {
        return this.unwindRoute(dto, 'STOPPED', dto.date, dto.reason, dto.charges ?? 0);
    }
    async void(dto) {
        return this.unwindRoute(dto, 'VOIDED', dto.date ?? todayIso(), dto.reason, 0);
    }
    async unwindRoute(keys, how, date, reason, charges) {
        const { userId, actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            await this.requireRight(tx, userId, 'cancel', vouchers_errors_1.VCH.RIGHT_CANCEL, 'unwind cheques');
            const cheque = await this.lock(tx, keys);
            this.assertHeld(cheque, how.toLowerCase());
            await this.unwind(tx, cheque, { how, date, reason, charges, actor, userId });
            return this.load(tx, keys);
        }, TX);
    }
    async unwind(tx, cheque, o) {
        const bank = cheque.apdBankLedgerId;
        if (!bank || !cheque.apdVoucherId || !cheque.apdVoucherAccYear) {
            (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo} names no bank or voucher — it did not come from a Payment Voucher`, vouchers_errors_1.VCH.CHEQUE_STATE);
        }
        const accYear = (0, voucher_derive_1.accYearOfDate)(o.date);
        const on = new Date(`${o.date}T00:00:00Z`);
        const now = new Date();
        const [standing] = await tx.$queryRaw `
      SELECT SUM(j.abj_amount) AS total
        FROM accounts.acc_bill_adjustment j
       WHERE j.abj_cheque_id = ${cheque.apdId}::uuid
         AND j.abj_cheque_acc_year = ${cheque.apdAccYear}::char(9)
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment r
                          WHERE r.abj_reversal_of_id = j.abj_id AND r.abj_is_deleted = false)`;
        const billPart = new client_1.Prisma.Decimal(standing?.total ?? 0);
        const onAccount = await this.onAccountShare(tx, cheque, billPart, o.how);
        const gross = standing?.total == null && onAccount.share.isZero()
            ? cheque.apdAmount
            : billPart.plus(onAccount.share);
        const lineTds = gross.greaterThan(cheque.apdAmount) ? gross.minus(cheque.apdAmount) : ZERO;
        const [root] = await tx.$queryRaw `
      SELECT COALESCE(h.avh_against_voucher_id, h.avh_voucher_id) AS voucher_id,
             COALESCE(h.avh_against_acc_year, h.avh_acc_year) AS acc_year
        FROM accounts.acc_voucher_header h
       WHERE h.avh_voucher_id = ${cheque.apdVoucherId}::uuid
         AND h.avh_acc_year = ${cheque.apdVoucherAccYear}::char(9)`;
        let tdsRow = null;
        let tdsLedgerId = null;
        if (lineTds.greaterThan(0)) {
            [tdsRow] = await tx.$queryRaw `
        SELECT t.atd_id, t.atd_challan_no FROM accounts.acc_tds_register t
         WHERE t.atd_voucher_id = ${root.voucher_id}::uuid
           AND t.atd_voucher_acc_year = ${root.acc_year}::char(9)
           AND t.atd_party_id = ${cheque.apdPartyId}::uuid
           AND t.atd_is_deleted = false AND t.atd_reversal_of_id IS NULL
         ORDER BY t.atd_created_on LIMIT 1`;
            if (tdsRow?.atd_challan_no) {
                (0, vouchers_errors_1.throwState)(`The TDS on cheque ${cheque.apdInstrumentNo} was deposited under challan ${tdsRow.atd_challan_no} — correct it with a 26Q revision first`, vouchers_errors_1.VCH.TDS_DEPOSITED);
            }
            const [leg] = await tx.$queryRaw `
        SELECT v.av_ledger_id FROM accounts.acc_vouchers v
         WHERE v.av_voucher_id IN (${root.voucher_id}::uuid, ${cheque.apdVoucherId}::uuid)
           AND v.av_role = 'TDS_PAYABLE' AND v.av_is_deleted = false
         LIMIT 1`;
            tdsLedgerId = leg?.av_ledger_id ?? null;
            if (!tdsLedgerId) {
                (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo}: its line had TDS deducted, but the payment carries no TDS Payable leg`, vouchers_errors_1.VCH.TDS_UNMAPPED);
            }
        }
        const fee = new client_1.Prisma.Decimal(o.charges).toDecimalPlaces(2);
        let bankCharges = null;
        if (fee.greaterThan(0)) {
            const roles = await (0, cheque_ledger_roles_1.requireChequeRoleLedgers)(tx, [cheque_enum_1.ChequeLedgerRole.BANK_CHARGES], {
                companyId: cheque.apdCompanyId,
                branchId: cheque.apdBranchId,
            });
            bankCharges = (0, cheque_ledger_roles_1.ledgerForRole)(roles, cheque_enum_1.ChequeLedgerRole.BANK_CHARGES)?.ledgerId ?? null;
        }
        const label = {
            RETURNED: 'returned unpaid',
            STOPPED: 'stopped',
            VOIDED: 'voided',
            REPLACED: 'stopped for replacement',
        }[o.how];
        const legs = [
            {
                drCr: receipt_enum_1.DrCr.DR,
                ledgerId: bank,
                amount: cheque.apdAmount,
                remarks: `Cheque ${cheque.apdInstrumentNo} ${label}`,
                reconDate: o.how === 'RETURNED' ? on : null,
            },
            ...(lineTds.greaterThan(0)
                ? [
                    {
                        drCr: receipt_enum_1.DrCr.DR,
                        ledgerId: tdsLedgerId,
                        amount: lineTds,
                        role: 'TDS_PAYABLE',
                        remarks: `TDS on cheque ${cheque.apdInstrumentNo} given back`,
                    },
                ]
                : []),
            {
                drCr: receipt_enum_1.DrCr.CR,
                ledgerId: cheque.apdPartyId,
                amount: gross,
                remarks: `Cheque ${cheque.apdInstrumentNo} ${label}: ${o.reason}`.slice(0, 250),
            },
            ...(bankCharges
                ? [
                    {
                        drCr: receipt_enum_1.DrCr.DR,
                        ledgerId: bankCharges,
                        amount: fee,
                        role: cheque_enum_1.ChequeLedgerRole.BANK_CHARGES,
                        remarks: `Bank charges on cheque ${cheque.apdInstrumentNo}`,
                    },
                    {
                        drCr: receipt_enum_1.DrCr.CR,
                        ledgerId: bank,
                        amount: fee,
                        remarks: `Bank charges on cheque ${cheque.apdInstrumentNo}`,
                    },
                ]
                : []),
        ];
        const voucher = await (0, cheque_voucher_helper_1.writeChequeVoucher)(tx, {
            typeCode: 'ChqBnc',
            field: 'apdId',
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            accYear,
            voucherDate: on,
            partyId: cheque.apdPartyId,
            docAmount: cheque.apdAmount,
            remarks: `Issued cheque ${cheque.apdInstrumentNo} ${label}: ${o.reason}`.slice(0, 250),
            againstVoucherId: cheque.apdVoucherId,
            againstAccYear: cheque.apdVoucherAccYear,
            userId: o.userId ?? o.actor,
            actor: o.actor,
            legs,
        });
        const reversed = await (0, cheque_reversal_helper_1.reverseChequeAdjustments)(tx, cheque, {
            voucherId: voucher.ref.voucherId,
            accYear: voucher.ref.accYear,
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            userId: o.userId ?? o.actor,
            sessionId: null,
            actor: o.actor,
            reason: `Cheque ${cheque.apdInstrumentNo} ${label}`,
        });
        let rowNo = reversed.nextRowNo;
        const takenBack = onAccount.takes.map((take) => ({
            abjCompanyId: cheque.apdCompanyId,
            abjBranchId: cheque.apdBranchId,
            abjTenantId: cheque.apdTenantId,
            abjAccYear: voucher.ref.accYear,
            abjBillId: take.billId,
            abjBillAccYear: take.accYear,
            abjPartyId: cheque.apdPartyId,
            abjRowNo: rowNo++,
            abjVoucherId: voucher.ref.voucherId,
            abjVoucherAccYear: voucher.ref.accYear,
            abjAdjType: receipt_enum_1.BillAdjType.ALLOCATION,
            abjAdjDate: on,
            abjIsPostDated: false,
            abjDrCr: receipt_enum_1.DrCr.CR,
            abjAmount: take.amount,
            abjSettlementMode: receipt_enum_1.BillSettlementMode.CHEQUE,
            abjChequeId: cheque.apdId,
            abjChequeAccYear: cheque.apdAccYear,
            abjRemarks: `Cheque ${cheque.apdInstrumentNo} ${label}: its on-account share taken back`,
            abjUserId: o.userId ?? o.actor,
            abjCreatedBy: o.actor,
        }));
        if (takenBack.length > 0) {
            await tx.accBillAdjustment.createMany({ data: takenBack });
        }
        const touched = [
            ...reversed.bills,
            ...onAccount.takes.map((take) => ({ billId: take.billId, accYear: take.accYear })),
        ];
        if (touched.length > 0) {
            await this.recompute.recomputeBills(tx, touched, now);
        }
        if (tdsRow && lineTds.greaterThan(0)) {
            await tx.$executeRaw `
        INSERT INTO accounts.acc_tds_register (
          atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
          atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
          atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
          atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_reversal_of_id,
          atd_remarks, atd_created_by
        )
        SELECT o.atd_company_id, o.atd_branch_id, o.atd_tenant_id, o.atd_acc_year, o.atd_quarter, o.atd_direction,
               o.atd_party_id, o.atd_pan, o.atd_party_name, o.atd_deductee_type, o.atd_section, o.atd_rate,
               o.atd_rate_source, ${gross.toFixed(2)}::numeric, ${lineTds.negated().toFixed(2)}::numeric,
               ${voucher.ref.voucherId}::uuid, ${voucher.ref.accYear}::char(9),
               o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
               ${`Cheque ${cheque.apdInstrumentNo} ${label}: ${o.reason}`.slice(0, 250)}, ${o.actor}
          FROM accounts.acc_tds_register o WHERE o.atd_id = ${tdsRow.atd_id}::uuid`;
        }
        const to = o.how === 'RETURNED'
            ? receipt_enum_1.PdcStatus.BOUNCED
            : o.how === 'REPLACED'
                ? receipt_enum_1.PdcStatus.REPLACED
                : receipt_enum_1.PdcStatus.CANCELLED;
        const why = `${o.how}: ${o.reason}`.slice(0, 250);
        if (o.how === 'RETURNED') {
            await tx.$executeRaw `
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'BOUNCED', apd_status_on = ${now}, apd_status_by = ${o.actor},
               apd_deposit_date = COALESCE(apd_deposit_date, ${on}::date),
               apd_bounce_date = ${on}::date, apd_bounce_reason = ${o.reason.slice(0, 200)},
               apd_bounce_charges = ${fee.toFixed(2)}::numeric,
               apd_bounce_voucher_id = ${voucher.ref.voucherId}::uuid,
               apd_bounce_acc_year = ${voucher.ref.accYear}::char(9),
               apd_present_count = apd_present_count + 1,
               apd_modified_on = ${now}, apd_modified_by = ${o.actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
        }
        else if (o.how !== 'REPLACED') {
            await tx.$executeRaw `
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'CANCELLED', apd_status_on = ${now}, apd_status_by = ${o.actor},
               apd_cancel_date = ${on}::date, apd_cancel_reason = ${why},
               apd_bounce_charges = ${fee.toFixed(2)}::numeric,
               apd_bounce_voucher_id = ${voucher.ref.voucherId}::uuid,
               apd_bounce_acc_year = ${voucher.ref.accYear}::char(9),
               apd_modified_on = ${now}, apd_modified_by = ${o.actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
        }
        else {
            await tx.$executeRaw `
        UPDATE accounts.acc_pdc_register
           SET apd_cancel_date = ${on}::date, apd_cancel_reason = ${why},
               apd_bounce_voucher_id = ${voucher.ref.voucherId}::uuid,
               apd_bounce_acc_year = ${voucher.ref.accYear}::char(9),
               apd_modified_on = ${now}, apd_modified_by = ${o.actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
        }
        if (o.how !== 'REPLACED') {
            await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                fromStatus: receipt_enum_1.PdcStatus.HELD,
                toStatus: to,
                event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
                remarks: `${label} on ${o.date}: ${o.reason} — reversed by ${voucher.ref.voucherRefno ?? voucher.ref.voucherId}`,
                actor: o.actor,
                changedOn: now,
            });
        }
        await (0, voucher_books_helper_1.assertVoucherBooksReconcile)(tx, {
            companyId: cheque.apdCompanyId,
            accYear: voucher.ref.accYear,
            ledgerIds: [cheque.apdPartyId, bank],
        });
        return {
            voucherId: voucher.ref.voucherId,
            accYear: voucher.ref.accYear,
            voucherRefno: voucher.ref.voucherRefno ?? null,
            gross: Number(gross.toFixed(2)),
            tds: Number(lineTds.toFixed(2)),
            charges: Number(fee.toFixed(2)),
            allocationsReversed: reversed.count,
            onAccount: Number(onAccount.share.toFixed(2)),
        };
    }
    async replace(dto) {
        const { userId, actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            await this.requireRight(tx, userId, 'amend', vouchers_errors_1.VCH.RIGHT_AMEND, 'replace cheques');
            const cheque = await this.lock(tx, dto);
            const status = cheque.apdStatus;
            const replaceable = [receipt_enum_1.PdcStatus.HELD, receipt_enum_1.PdcStatus.BOUNCED, receipt_enum_1.PdcStatus.CANCELLED];
            if (!replaceable.includes(status)) {
                (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo} is ${status} — only an outstanding, returned, stopped or voided cheque is replaced`, vouchers_errors_1.VCH.CHEQUE_STATE);
            }
            let reversal;
            if (status === receipt_enum_1.PdcStatus.HELD) {
                const r = await this.unwind(tx, cheque, {
                    how: 'REPLACED',
                    date: dto.date,
                    reason: dto.reason,
                    charges: 0,
                    actor,
                    userId,
                });
                reversal = { voucherId: r.voucherId, accYear: r.accYear };
            }
            else if (cheque.apdBounceVoucherId && cheque.apdBounceAccYear) {
                reversal = {
                    voucherId: cheque.apdBounceVoucherId,
                    accYear: cheque.apdBounceAccYear.trim(),
                };
            }
            else {
                (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo} was ${status} without a reversal voucher — nothing to pay again`, vouchers_errors_1.VCH.CHEQUE_STATE);
            }
            const restore = await (0, cheque_reversal_helper_1.allocationsReversedBy)(tx, cheque, reversal);
            const gross = restore.reduce((s, a) => s.plus(a.amount), ZERO);
            const hadTds = gross.greaterThan(cheque.apdAmount);
            const [old] = await tx.$queryRaw `
        SELECT t.td_tender_id, p.apd_favouring, p.apd_ac_payee
          FROM accounts.acc_pdc_register p
          LEFT JOIN accounts.acc_tender_detail t ON t.td_id = p.apd_tender_id
         WHERE p.apd_id = ${cheque.apdId}::uuid AND p.apd_acc_year = ${cheque.apdAccYear}::char(9)`;
            if (!old?.td_tender_id) {
                (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo} has no tender row to take the cheque tender from`, vouchers_errors_1.VCH.CHEQUE_STATE);
            }
            const [book] = await tx.$queryRaw `
        SELECT acb_bank_ledger_id FROM accounts.acc_cheque_book WHERE acb_id = ${dto.chequeBookId}::uuid`;
            const payload = {
                header: {
                    companyId: cheque.apdCompanyId,
                    branchId: cheque.apdBranchId,
                    accYear: (0, voucher_derive_1.accYearOfDate)(dto.date),
                    typeCode: 'PmtV',
                    date: dto.date,
                    remarks: `Replaces cheque ${cheque.apdInstrumentNo}: ${dto.reason}`.slice(0, 250),
                },
                lines: [
                    {
                        rowNo: 1,
                        drCr: 'DR',
                        ledgerId: cheque.apdPartyId,
                        amount: Number(cheque.apdAmount.toFixed(2)),
                        tdsBase: hadTds,
                        instrument: {
                            tenderId: old.td_tender_id,
                            bankLedgerId: dto.bankLedgerId ?? book?.acb_bank_ledger_id ?? cheque.apdBankLedgerId,
                            chequeBookId: dto.chequeBookId,
                            instrumentDate: dto.instrumentDate ?? dto.date,
                            favouring: dto.favouring ?? old.apd_favouring,
                            acPayee: dto.acPayee ?? old.apd_ac_payee,
                        },
                    },
                ],
                allocations: restore.map((a) => ({
                    lineRowNo: 1,
                    billId: a.billId,
                    billAccYear: a.billAccYear,
                    amount: Number(a.amount.toFixed(2)),
                })),
            };
            const posted = await this.register.postWithin(tx, payload);
            const ins = posted.instruments.find((i) => i.pdcId);
            if (!ins?.pdcId || !ins.pdcAccYear) {
                throw new Error(`replacement of ${cheque.apdInstrumentNo}: the new cheque was not registered`);
            }
            const now = new Date();
            await tx.$executeRaw `
        UPDATE accounts.acc_pdc_register
           SET apd_status = 'REPLACED', apd_status_on = ${now}, apd_status_by = ${actor},
               apd_replaced_by_id = ${ins.pdcId}::uuid,
               apd_replaced_by_acc_year = ${ins.pdcAccYear}::char(9),
               apd_cancel_date = COALESCE(apd_cancel_date, ${new Date(`${dto.date}T00:00:00Z`)}::date),
               apd_cancel_reason = COALESCE(apd_cancel_reason, ${`REPLACED: ${dto.reason}`.slice(0, 250)}),
               apd_modified_on = ${now}, apd_modified_by = ${actor}
         WHERE apd_id = ${cheque.apdId}::uuid AND apd_acc_year = ${cheque.apdAccYear}::char(9)`;
            await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                fromStatus: status,
                toStatus: receipt_enum_1.PdcStatus.REPLACED,
                event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
                remarks: `Replaced by cheque ${ins.refNo ?? ''} on ${posted.header.voucherRefno ?? ''}: ${dto.reason}`,
                actor,
                changedOn: now,
            });
            return {
                replaced: await this.load(tx, dto),
                replacement: await this.load(tx, {
                    apdId: ins.pdcId,
                    apdAccYear: ins.pdcAccYear,
                    companyId: cheque.apdCompanyId,
                    branchId: cheque.apdBranchId,
                }),
            };
        }, TX);
    }
    async lock(tx, keys) {
        const got = await (0, cheques_guards_1.lockCheques)(tx, [{ apdId: keys.apdId, apdAccYear: keys.apdAccYear }]);
        const cheque = got.get((0, cheques_guards_1.chequeKey)(keys.apdId, keys.apdAccYear));
        if (!cheque ||
            cheque.apdIsDeleted ||
            cheque.apdCompanyId !== keys.companyId ||
            cheque.apdBranchId !== keys.branchId ||
            cheque.apdTraType.trim() !== 'P') {
            (0, vouchers_errors_1.throwMissing)(`No issued cheque ${keys.apdId} in ${keys.apdAccYear} at this company / branch`, vouchers_errors_1.VCH.CHEQUE_NOT_FOUND, 'apdId');
        }
        return cheque;
    }
    async onAccountShare(tx, cheque, billPart, how) {
        const none = { share: ZERO, takes: [] };
        const rest = cheque.apdAmount.minus(billPart);
        if (rest.lessThanOrEqualTo(0) || !cheque.apdVoucherId || !cheque.apdVoucherAccYear) {
            return none;
        }
        const advances = await tx.accBillBalance.findMany({
            where: {
                ablVoucherId: cheque.apdVoucherId,
                ablAccYear: cheque.apdVoucherAccYear,
                ablPartyId: cheque.apdPartyId,
                ablBillType: receipt_enum_1.BillType.ADVANCE,
                ablDrCr: receipt_enum_1.DrCr.DR,
                ablIsDeleted: false,
            },
            orderBy: [{ ablCreatedOn: 'asc' }, { ablId: 'asc' }],
            select: {
                ablId: true,
                ablAccYear: true,
                ablDocRefno: true,
                ablBillAmount: true,
                ablPendingAmount: true,
            },
        });
        if (advances.length === 0) {
            return none;
        }
        const raised = advances.reduce((s, a) => s.plus(a.ablBillAmount), ZERO);
        const open = advances.reduce((s, a) => s.plus(a.ablPendingAmount ?? ZERO), ZERO);
        const share = client_1.Prisma.Decimal.min(rest, raised);
        if (open.lessThan(share)) {
            const users = await tx.$queryRaw `
        SELECT DISTINCT h.avh_voucher_refno AS voucher_refno, ab.abl_doc_refno AS against_refno
          FROM accounts.acc_bill_adjustment j
          LEFT JOIN accounts.acc_voucher_header h
                 ON h.avh_voucher_id = j.abj_voucher_id AND h.avh_acc_year = j.abj_voucher_acc_year
          LEFT JOIN accounts.acc_bill_balance ab
                 ON ab.abl_id = j.abj_against_bill_id AND ab.abl_acc_year = j.abj_against_bill_acc_year
         WHERE j.abj_bill_id = ANY(${advances.map((a) => a.ablId)}::uuid[])
           AND j.abj_bill_acc_year = ${cheque.apdVoucherAccYear}::char(9)
           AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment r
                            WHERE r.abj_reversal_of_id = j.abj_id AND r.abj_is_deleted = false)`;
            const named = users
                .map((u) => u.voucher_refno
                ? `${u.voucher_refno}${u.against_refno ? ` (against ${u.against_refno})` : ''}`
                : (u.against_refno ?? null))
                .filter((n) => Boolean(n));
            const verb = {
                RETURNED: 'recorded as returned',
                STOPPED: 'stopped',
                VOIDED: 'voided',
                REPLACED: 'replaced',
            }[how];
            (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo} paid ${share.toFixed(2)} on account, held as the advance ` +
                `on ${advances[0].ablDocRefno}, and only ${open.toFixed(2)} of that advance is still open — ` +
                `${raised.minus(open).toFixed(2)} of it was used by ${named.length > 0 ? named.join(', ') : 'a later document'}. ` +
                `Reverse that use first; then the cheque can be ${verb}.`, vouchers_errors_1.VCH.ADVANCE_SPENT, 'apdId');
        }
        const takes = [];
        let left = share;
        for (const advance of advances) {
            if (left.lessThanOrEqualTo(0)) {
                break;
            }
            const take = client_1.Prisma.Decimal.min(left, advance.ablPendingAmount ?? ZERO);
            if (take.greaterThan(0)) {
                takes.push({ billId: advance.ablId, accYear: advance.ablAccYear, amount: take });
                left = left.minus(take);
            }
        }
        return { share, takes };
    }
    assertHeld(cheque, action) {
        if (cheque.apdStatus !== receipt_enum_1.PdcStatus.HELD) {
            const next = {
                CLEARED: 'it was paid — nothing to undo',
                BOUNCED: 'replace it',
                CANCELLED: 'replace it',
                REPLACED: 'see its replacement',
            };
            (0, vouchers_errors_1.throwState)(`Cheque ${cheque.apdInstrumentNo} is ${cheque.apdStatus}; only an outstanding cheque can be ${action} — ${next[cheque.apdStatus] ?? 'nothing more to do'}`, vouchers_errors_1.VCH.CHEQUE_STATE);
        }
    }
    async load(tx, keys) {
        const [r] = await tx.$queryRaw `
      SELECT p.apd_id, p.apd_acc_year, p.apd_company_id, p.apd_branch_id, p.apd_tra_type,
             p.apd_instrument_no, p.apd_instrument_date, p.apd_received_on, p.apd_amount,
             p.apd_party_id, s.led_name AS party_name, p.apd_favouring, p.apd_ac_payee,
             p.apd_bank_ledger_id, bk.led_name AS bank_name,
             p.apd_cheque_book_id, b.acb_book_no,
             p.apd_status, p.apd_status_on, p.apd_clear_date, p.apd_bounce_date, p.apd_bounce_reason,
             p.apd_bounce_charges, p.apd_cancel_date, p.apd_cancel_reason,
             p.apd_voucher_id, p.apd_voucher_acc_year, h.avh_voucher_refno, h.avh_voucher_date,
             vt.vchr_type_code, h.avh_against_voucher_id,
             p.apd_bounce_voucher_id, p.apd_bounce_acc_year, rv.avh_voucher_refno AS reversal_refno,
             p.apd_replaced_by_id, p.apd_replaced_by_acc_year, rp.apd_instrument_no AS replaced_by_leaf,
             (SELECT o.apd_id FROM accounts.acc_pdc_register o
               WHERE o.apd_replaced_by_id = p.apd_id AND o.apd_replaced_by_acc_year = p.apd_acc_year
               LIMIT 1) AS replaces_id,
             p.apd_print_count, p.apd_printed_on, p.apd_remarks, p.apd_created_by, p.apd_created_on
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_ledger_master s ON s.led_id = p.apd_party_id
        LEFT JOIN accounts.acc_ledger_master bk ON bk.led_id = p.apd_bank_ledger_id
        LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year
        LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_voucher_header rv
               ON rv.avh_voucher_id = p.apd_bounce_voucher_id AND rv.avh_acc_year = p.apd_bounce_acc_year
        LEFT JOIN accounts.acc_pdc_register rp
               ON rp.apd_id = p.apd_replaced_by_id AND rp.apd_acc_year = p.apd_replaced_by_acc_year
       WHERE p.apd_id = ${keys.apdId}::uuid AND p.apd_acc_year = ${keys.apdAccYear}::char(9)
         AND p.apd_company_id = ${keys.companyId}::uuid AND p.apd_branch_id = ${keys.branchId}::uuid
         AND p.apd_is_deleted = false`;
        if (!r || r.apd_tra_type.trim() !== 'P') {
            (0, vouchers_errors_1.throwMissing)(`No issued cheque ${keys.apdId} in ${keys.apdAccYear} at this company / branch`, vouchers_errors_1.VCH.CHEQUE_NOT_FOUND, 'apdId');
        }
        const n = (v) => v === null ? null : Number(new client_1.Prisma.Decimal(v).toFixed(2));
        return {
            apdId: r.apd_id,
            apdAccYear: r.apd_acc_year.trim(),
            companyId: r.apd_company_id,
            branchId: r.apd_branch_id,
            leaf: r.apd_instrument_no,
            chequeDate: isoDate(r.apd_instrument_date),
            issuedOn: isoDate(r.apd_received_on),
            amount: n(r.apd_amount),
            partyId: r.apd_party_id,
            partyName: r.party_name,
            favouring: r.apd_favouring,
            acPayee: r.apd_ac_payee,
            bankLedgerId: r.apd_bank_ledger_id,
            bankName: r.bank_name,
            chequeBookId: r.apd_cheque_book_id,
            bookNo: r.acb_book_no,
            status: r.apd_status,
            isPostDated: r.apd_status === 'HELD' && isoDate(r.apd_instrument_date) > todayIso(),
            statusOn: r.apd_status_on?.toISOString() ?? null,
            presentedOn: r.apd_clear_date ? isoDate(r.apd_clear_date) : null,
            returnedOn: r.apd_bounce_date ? isoDate(r.apd_bounce_date) : null,
            returnReason: r.apd_bounce_reason,
            charges: n(r.apd_bounce_charges),
            cancelledOn: r.apd_cancel_date ? isoDate(r.apd_cancel_date) : null,
            cancelReason: r.apd_cancel_reason,
            voucherId: r.apd_voucher_id,
            voucherAccYear: r.apd_voucher_acc_year?.trim() ?? null,
            voucherRefno: r.avh_voucher_refno,
            voucherDate: r.avh_voucher_date ? isoDate(r.avh_voucher_date) : null,
            typeCode: r.vchr_type_code,
            paymentVoucherId: r.avh_against_voucher_id ?? r.apd_voucher_id,
            reversalVoucherId: r.apd_bounce_voucher_id,
            reversalAccYear: r.apd_bounce_acc_year?.trim() ?? null,
            reversalRefno: r.reversal_refno,
            replacedById: r.apd_replaced_by_id,
            replacedByAccYear: r.apd_replaced_by_acc_year?.trim() ?? null,
            replacedByLeaf: r.replaced_by_leaf,
            replacesId: r.replaces_id,
            printCount: r.apd_print_count,
            printedOn: r.apd_printed_on?.toISOString() ?? null,
            remarks: r.apd_remarks,
            createdBy: r.apd_created_by,
        };
    }
};
exports.IssuedChequesService = IssuedChequesService;
exports.IssuedChequesService = IssuedChequesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService,
        voucher_register_service_1.VoucherRegisterService])
], IssuedChequesService);
function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
function todayIso() {
    return new Date().toISOString().slice(0, 10);
}
//# sourceMappingURL=issued-cheques.service.js.map