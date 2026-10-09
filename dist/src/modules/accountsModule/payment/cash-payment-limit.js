"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUTORY_40A3 = void 0;
exports.checkCashPaymentLimit = checkCashPaymentLimit;
const client_1 = require("@prisma/client");
const statutory_service_1 = require("../../../common/posting/statutory.service");
const statutory_types_1 = require("../../../common/posting/statutory.types");
const till_enum_1 = require("../../till/types/till-enum");
exports.STATUTORY_40A3 = 'STATUTORY_40A3';
async function checkCashPaymentLimit(tx, input) {
    if (input.cash.lessThanOrEqualTo(0)) {
        return null;
    }
    const limit = await (0, statutory_service_1.resolveStatutoryLimit)(tx, input.companyId, statutory_types_1.STATUTORY_CODES.CASH_PAYMENT_LIMIT_40A3, input.onDate);
    if (!limit || limit.value === null) {
        return null;
    }
    let earlier = new client_1.Prisma.Decimal(0);
    let payeeName = null;
    if (input.payeeLedgerId) {
        const [row] = await tx.$queryRaw `
      SELECT COALESCE((
               SELECT sum(t.td_amount)
                 FROM accounts.acc_tender_detail t
                 JOIN accounts.acc_voucher_header h
                   ON h.avh_voucher_id = t.td_src_doc_id AND h.avh_acc_year = t.td_acc_year
                WHERE t.td_company_id      = ${input.companyId}::uuid
                  AND t.td_acc_year        = ${input.accYear}::char(9)
                  AND t.td_party_ledger_id = ${input.payeeLedgerId}::uuid
                  AND t.td_doc_date        = ${input.onDate}::date
                  AND t.td_tender_type_id  = ${till_enum_1.CASH_TENDER_TYPE_ID}::int
                  AND t.td_dr_cr           = 'CR'
                  AND t.td_src_doc_type IN ('PAYMENT', 'EXPENSE')
                  AND t.td_is_deleted = false
                  AND t.td_is_voided  = false
                  AND t.td_src_doc_id IS DISTINCT FROM ${input.excludeDocId}::uuid
                  AND h.avh_voucher_status = 'POSTED'
                  AND h.avh_is_deleted = false), 0) AS paid,
             (SELECT led_name FROM accounts.acc_ledger_master
               WHERE led_id = ${input.payeeLedgerId}::uuid) AS name`;
        earlier = new client_1.Prisma.Decimal(row?.paid ?? 0);
        payeeName = row?.name ?? null;
    }
    const total = earlier.plus(input.cash);
    const value = new client_1.Prisma.Decimal(limit.value);
    if (!total.greaterThan(value)) {
        return null;
    }
    const to = payeeName ? `to ${payeeName}` : 'to one payee';
    const split = earlier.greaterThan(0)
        ? ` (this document ${input.cash.toFixed(2)}, earlier that day ${earlier.toFixed(2)})`
        : '';
    return {
        code: exports.STATUTORY_40A3,
        enforce: limit.enforce,
        message: `Cash paid ${to} on ${input.onDate} comes to ${total.toFixed(2)}${split}, above the ` +
            `${limit.section ?? '40A(3)'} limit of ${value.toFixed(2)}: a cash payment above it is not ` +
            'allowed as a deduction. Pay by bank, UPI or an account-payee cheque',
        field: input.field,
        statutory: {
            code: limit.code,
            value: limit.value,
            effectiveFrom: limit.effectiveFrom,
            isCompanyOverride: limit.isCompanyOverride,
            date: input.onDate,
            payeeLedgerId: input.payeeLedgerId,
            thisDocument: Number(input.cash.toFixed(2)),
            earlierToday: Number(earlier.toFixed(2)),
        },
    };
}
//# sourceMappingURL=cash-payment-limit.js.map