import { Prisma } from '@prisma/client';
import { resolveStatutoryLimit } from 'src/common/posting/statutory.service';
import { STATUTORY_CODES, type StatutoryEnforce } from 'src/common/posting/statutory.types';
import { CASH_TENDER_TYPE_ID } from '../../till/types/till-enum';

/** The code a 40A(3) warning or refusal carries (plan-till-receipt-payment-expense §3.4 / §4.5). */
export const STATUTORY_40A3 = 'STATUTORY_40A3';

export interface CashPaymentLimitFinding {
  code: typeof STATUTORY_40A3;
  /** WARN as shipped; REFUSE (or INFO) when the company's own row says so. */
  enforce: StatutoryEnforce;
  message: string;
  field: string;
  statutory: {
    code: string;
    value: number;
    effectiveFrom: string;
    isCompanyOverride: boolean;
    date: string;
    payeeLedgerId: string | null;
    /** This document's cash to the payee. */
    thisDocument: number;
    /** The payee's cash on other POSTED payments and expenses of the day. */
    earlierToday: number;
  };
}

/**
 * 40A(3) — cash paid to one person in a day above the limit (statutory row
 * CASH_PAYMENT_LIMIT_40A3, seeded by 48: 10,000, WARN) is not allowed as a
 * deduction. A company row may make it REFUSE, or raise it (35,000 for
 * goods-carriage hire).
 *
 * Summed per payee and date: the CASH tender rows (CR) of POSTED payments —
 * menu 100 and the voucher register's payment types, which both write
 * `PAYMENT` rows naming the party — and expense vouchers naming a supplier,
 * plus `cash` of the document being judged (`excludeDocId` keeps its own rows
 * out when it has some). An expense with no supplier names no payee: only its
 * own cash is judged. Above the limit (the section says "exceeds") → a
 * finding; no row, or no cash, → null. Never throws: the caller decides what
 * a WARN or a REFUSE does in its own guard context.
 */
export async function checkCashPaymentLimit(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    accYear: string;
    /** YYYY-MM-DD — the document's date. */
    onDate: string;
    payeeLedgerId: string | null;
    cash: Prisma.Decimal;
    excludeDocId: string | null;
    field: string;
  },
): Promise<CashPaymentLimitFinding | null> {
  if (input.cash.lessThanOrEqualTo(0)) {
    return null;
  }
  const limit = await resolveStatutoryLimit(
    tx,
    input.companyId,
    STATUTORY_CODES.CASH_PAYMENT_LIMIT_40A3,
    input.onDate,
  );
  if (!limit || limit.value === null) {
    return null;
  }
  let earlier = new Prisma.Decimal(0);
  let payeeName: string | null = null;
  if (input.payeeLedgerId) {
    const [row] = await tx.$queryRaw<{ paid: Prisma.Decimal; name: string | null }[]>`
      SELECT COALESCE((
               SELECT sum(t.td_amount)
                 FROM accounts.acc_tender_detail t
                 JOIN accounts.acc_voucher_header h
                   ON h.avh_voucher_id = t.td_src_doc_id AND h.avh_acc_year = t.td_acc_year
                WHERE t.td_company_id      = ${input.companyId}::uuid
                  AND t.td_acc_year        = ${input.accYear}::char(9)
                  AND t.td_party_ledger_id = ${input.payeeLedgerId}::uuid
                  AND t.td_doc_date        = ${input.onDate}::date
                  AND t.td_tender_type_id  = ${CASH_TENDER_TYPE_ID}::int
                  AND t.td_dr_cr           = 'CR'
                  AND t.td_src_doc_type IN ('PAYMENT', 'EXPENSE')
                  AND t.td_is_deleted = false
                  AND t.td_is_voided  = false
                  AND t.td_src_doc_id IS DISTINCT FROM ${input.excludeDocId}::uuid
                  AND h.avh_voucher_status = 'POSTED'
                  AND h.avh_is_deleted = false), 0) AS paid,
             (SELECT led_name FROM accounts.acc_ledger_master
               WHERE led_id = ${input.payeeLedgerId}::uuid) AS name`;
    earlier = new Prisma.Decimal(row?.paid ?? 0);
    payeeName = row?.name ?? null;
  }
  const total = earlier.plus(input.cash);
  const value = new Prisma.Decimal(limit.value);
  if (!total.greaterThan(value)) {
    return null;
  }
  const to = payeeName ? `to ${payeeName}` : 'to one payee';
  const split = earlier.greaterThan(0)
    ? ` (this document ${input.cash.toFixed(2)}, earlier that day ${earlier.toFixed(2)})`
    : '';
  return {
    code: STATUTORY_40A3,
    enforce: limit.enforce,
    message:
      `Cash paid ${to} on ${input.onDate} comes to ${total.toFixed(2)}${split}, above the ` +
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
