import { Prisma } from '@prisma/client';
import { toAmount, toDateString } from '../receipt/receipt.utils';
import type { LockedCheque } from './cheques.guards';
import type { ChequeBillRef } from './types/cheque-api.types';

/**
 * A cheque tendered ON a sale bill — notes (46), item 4.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THE C4 CASCADE CANNOT SEE IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A receipt's cheque settles bills through `acc_bill_adjustment` rows carrying
 * `abj_cheque_id`, and a bounce reverses exactly those rows. A sale bill's own
 * tender writes NO adjustment row: it settles inside the bill's voucher, and
 * the bill posts its `acc_bill_balance` row with `abl_alloc_amount` already
 * seeded with everything tendered (bill-lifecycle.service.ts `writeBalanceRow`,
 * the same hand-maintained figure /bills/retender moves). So
 * `reverseChequeAdjustments` finds nothing and the bill would stay PAID on a
 * cheque that came back.
 *
 * The bounce therefore follows the tender instead:
 *     apd_tender_id → acc_tender_detail (SALES / SALE_BILL) → td_src_doc_id
 * and moves the seeded figure by the cheque's amount — down on a bounce or a
 * return, back up on a re-presentation — together with the bill header's
 * paid / balance / pay-status caches.
 *
 * Why not write an adjustment row for the bill's tender instead: the recompute
 * (BillBalanceRecomputeService) derives `abl_alloc_amount` from adjustment rows
 * ONLY, so a bill carrying one row for its cheque and a seeded figure for its
 * cash would lose the cash the first time anything recomputed it. Moving the
 * seed keeps the bill on the one model it already has.
 */

const SALE_BILL_SRC_MODULE = 'SALES';
const SALE_BILL_SRC_DOC_TYPE = 'SALE_BILL';

export interface SaleBillOfCheque {
  sbId: string;
  sbAccYear: string;
  /** The bill's live SALES receivable. */
  ablId: string;
  ablAccYear: string;
}

/**
 * The sale bill this cheque was tendered on, or null for a cheque that came in
 * any other way (a receipt, an order advance, a replacement).
 */
export async function findSaleBillOfCheque(
  tx: Prisma.TransactionClient,
  cheque: Pick<LockedCheque, 'apdTenderId'>,
): Promise<SaleBillOfCheque | null> {
  if (!cheque.apdTenderId) {
    return null;
  }
  const [row] = await tx.$queryRaw<
    { sb_id: string; sb_acc_year: string; abl_id: string; abl_acc_year: string }[]
  >`
    SELECT b.sb_id, b.sb_acc_year, l.abl_id, l.abl_acc_year
      FROM accounts.acc_tender_detail t
      JOIN sales.sale_bill b
        ON b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
      JOIN accounts.acc_bill_balance l
        ON l.abl_src_doc_id = b.sb_id AND l.abl_acc_year = b.sb_acc_year
       AND l.abl_src_doc_type = ${SALE_BILL_SRC_DOC_TYPE} AND l.abl_is_deleted = false
     WHERE t.td_id = ${cheque.apdTenderId}::uuid
       AND t.td_src_module = ${SALE_BILL_SRC_MODULE} AND t.td_src_doc_type = ${SALE_BILL_SRC_DOC_TYPE}
       AND b.sb_status = 'POSTED'
     LIMIT 1`;
  if (!row) {
    return null;
  }
  return {
    sbId: row.sb_id,
    sbAccYear: row.sb_acc_year.trim(),
    ablId: row.abl_id,
    ablAccYear: row.abl_acc_year.trim(),
  };
}

/**
 * Moves what the bill counts as settled by `delta` — negative to reopen it (a
 * bounce, a return), positive to settle it again (a re-presentation) — and
 * answers the bill as the cheque responses report it.
 *
 * Clamped both ways: never below nothing settled, never past what the bill is
 * worth net of its discounts and write-offs (ck_abl_settled).
 */
export async function moveSaleBillSettlement(
  tx: Prisma.TransactionClient,
  link: SaleBillOfCheque,
  delta: Prisma.Decimal,
  settledOn: Date,
  actor: string,
): Promise<ChequeBillRef> {
  const now = new Date();
  // Locked first, bill header then receivable, the order the bill's own
  // cancel / amend take them in.
  await tx.$queryRaw`
    SELECT sb_id FROM sales.sale_bill
     WHERE sb_id = ${link.sbId}::uuid AND sb_acc_year = ${link.sbAccYear}::char(9)
       FOR UPDATE`;
  const [abl] = await tx.$queryRaw<
    {
      abl_bill_type: string;
      abl_doc_refno: string;
      abl_doc_date: Date | null;
      abl_due_date: Date | null;
      abl_bill_amount: Prisma.Decimal;
      abl_pending_amount: Prisma.Decimal;
      old_alloc: Prisma.Decimal;
      new_alloc: Prisma.Decimal;
    }[]
  >`
    WITH locked AS (
      SELECT abl_id, abl_acc_year, abl_alloc_amount
        FROM accounts.acc_bill_balance
       WHERE abl_id = ${link.ablId}::uuid AND abl_acc_year = ${link.ablAccYear}::char(9)
         FOR UPDATE
    )
    UPDATE accounts.acc_bill_balance l
       SET abl_alloc_amount = GREATEST(0, LEAST(l.abl_bill_amount - l.abl_disc_amount - l.abl_writeoff_amount,
                                                l.abl_alloc_amount + ${delta}::numeric)),
           abl_settled_on = CASE
                              WHEN GREATEST(0, LEAST(l.abl_bill_amount - l.abl_disc_amount - l.abl_writeoff_amount,
                                                     l.abl_alloc_amount + ${delta}::numeric))
                                   >= l.abl_bill_amount - l.abl_disc_amount - l.abl_writeoff_amount
                              THEN COALESCE(l.abl_settled_on, ${settledOn}::date)
                              ELSE NULL END,
           abl_modified_on = ${now},
           abl_modified_by = ${actor}
      FROM locked
     WHERE l.abl_id = locked.abl_id AND l.abl_acc_year = locked.abl_acc_year
    RETURNING l.abl_bill_type, l.abl_doc_refno, l.abl_doc_date, l.abl_due_date, l.abl_bill_amount,
              (l.abl_bill_amount - l.abl_alloc_amount - l.abl_disc_amount - l.abl_writeoff_amount)
                AS abl_pending_amount,
              locked.abl_alloc_amount AS old_alloc, l.abl_alloc_amount AS new_alloc`;
  const moved = new Prisma.Decimal(abl.new_alloc).minus(abl.old_alloc);
  // The header's caches move by what the receivable actually moved, so a clamp
  // above is not overstated here.
  await tx.$executeRaw`
    UPDATE sales.sale_bill
       SET sb_paid_amt    = GREATEST(0, sb_paid_amt + ${moved}::numeric),
           sb_balance_amt = sb_bill_amt - GREATEST(0, sb_paid_amt + ${moved}::numeric),
           sb_pay_status  = CASE
                              WHEN sb_bill_amt - GREATEST(0, sb_paid_amt + ${moved}::numeric) <= 0.005 THEN 'PAID'
                              WHEN GREATEST(0, sb_paid_amt + ${moved}::numeric) > 0 THEN 'PARTIAL'
                              ELSE 'UNPAID' END,
           sb_modified_on = ${now}
     WHERE sb_id = ${link.sbId}::uuid AND sb_acc_year = ${link.sbAccYear}::char(9)`;
  return {
    billId: link.ablId,
    billAccYear: link.ablAccYear,
    billType: abl.abl_bill_type,
    docRefno: abl.abl_doc_refno,
    docDate: toDateString(abl.abl_doc_date) ?? '',
    dueDate: toDateString(abl.abl_due_date),
    billAmount: toAmount(abl.abl_bill_amount),
    pendingAmount: toAmount(abl.abl_pending_amount),
    settledByThisCheque: toAmount(moved),
  };
}
