import { HttpException, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { loadRights } from 'src/common/posting/rights';
import { appendTxnStatusLog, TxnStatusDocType, TxnStatusEvent, TxnStatusSrcModule } from 'src/common/txn-status-log/txn-status-log.helper';

/**
 * Payment hold (plan R19). A purchase bill on hold (pur_invoice.pi_payment_hold) is not paid:
 * Payment refuses to settle its bill-wise row unless the user holds the release right — the
 * OVERRIDE right on menu 24 (Purchase Entry) — and then the override is logged on the bill
 * (user, time, which payment). Release / hold themselves: /purchase/invoices/hold.
 */
export const PURCHASE_INVOICE_MENU = 24;

export interface BillHold { ablId: string; piId: string; accYear: string; companyId: string; branchId: string; refno: string; supplierInvNo: string; reason: string | null }

/** The held purchase bills among these bill-wise rows (ablId → hold). */
export async function holdsOfBills(tx: Prisma.TransactionClient, ablIds: string[]): Promise<Map<string, BillHold>> {
  if (!ablIds.length) return new Map();
  const rows = await tx.$queryRaw<{ abl_id: string; pi_id: string; pi_acc_year: string; pi_company_id: string; pi_branch_id: string; pi_refno: string; pi_supplier_inv_no: string; pi_hold_reason: string | null }[]>`
    SELECT b.abl_id, p.pi_id, p.pi_acc_year, p.pi_company_id, p.pi_branch_id, p.pi_refno, p.pi_supplier_inv_no, p.pi_hold_reason
      FROM accounts.acc_bill_balance b
      JOIN purchase.pur_invoice p ON p.pi_id = b.abl_src_doc_id AND p.pi_acc_year = b.abl_src_acc_year
     WHERE b.abl_id = ANY(${ablIds}::uuid[]) AND b.abl_src_module = 'PURCHASE' AND b.abl_src_doc_type = 'PURCHASE_BILL'
       AND p.pi_payment_hold AND NOT p.pi_is_deleted`;
  return new Map(rows.map((r) => [r.abl_id, {
    ablId: r.abl_id, piId: r.pi_id, accYear: r.pi_acc_year, companyId: r.pi_company_id, branchId: r.pi_branch_id,
    refno: r.pi_refno, supplierInvNo: r.pi_supplier_inv_no, reason: r.pi_hold_reason,
  }]));
}

/**
 * Called by Payment when it settles bills. Held bills without the release right → 409
 * PUR_PAYMENT_HOLD naming each; with it → allowed, and the override goes on each bill's trail.
 */
export async function assertPaymentHoldCleared(
  tx: Prisma.TransactionClient,
  bills: { billId: string; field: string }[],
  userId: string | null,
  paymentRef: string,
): Promise<void> {
  const holds = await holdsOfBills(tx, bills.map((b) => b.billId));
  if (!holds.size) return;
  const rights = userId ? await loadRights(tx as never, userId, PURCHASE_INVOICE_MENU) : null;
  const canOverride = !!(rights as { override?: boolean } | null)?.override;
  const held = bills.filter((b) => holds.has(b.billId));
  if (!canOverride) {
    const errors = held.map((b) => {
      const h = holds.get(b.billId)!;
      return { field: b.field, code: 'PUR_PAYMENT_HOLD',
        message: `Bill ${h.refno} (supplier invoice ${h.supplierInvNo}) is on payment hold${h.reason ? `: ${h.reason}` : ''}. Release it in Purchase Entry first — releasing needs the Override right there.` };
    });
    throw new HttpException({ success: false, message: errors[0].message, errors }, HttpStatus.CONFLICT);
  }
  for (const b of held) {
    const h = holds.get(b.billId)!;
    await appendTxnStatusLog(tx, {
      companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, srcModule: TxnStatusSrcModule.PURCHASE, srcDocType: TxnStatusDocType.PURCHASE_BILL,
      srcDocId: h.piId, srcDocRefno: h.refno, event: TxnStatusEvent.HOLD_OVERRIDE, fromStatus: 'POSTED', toStatus: 'POSTED',
      changedBy: userId ?? 'SYSTEM', remarks: `Paid while on hold, in ${paymentRef} (override right)${h.reason ? ` — hold: ${h.reason}` : ''}`,
    });
  }
}
