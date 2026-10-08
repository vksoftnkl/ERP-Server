import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveRoleLedgers } from '../../accountsModule/ledgerRole/ledger-map.helper';
import { throwTill } from '../till-errors';
import {
  CASH_TENDER_TYPE_ID,
  TenderCloseMode,
  TillErrorCode,
  TillMovementKind,
} from '../types/till-enum';

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);

/** The session fields `expected()` reads. */
export interface ExpectationSession {
  tssId: string;
  tssAccYear: string;
  tssCompanyId: string;
  tssBranchId: string;
  tssFloatCounted: Prisma.Decimal;
  /**
   * Set once the session has CLOSED (REV 2 §2.9): a tender row voided AFTER it
   * — a later re-tender — still counts, so a recompute (a reopen) does not
   * drift from what the drawer was counted against.
   */
  tssClosedOn?: Date | null;
}

/** One tender's expectation — the split till_variance stores (47 §6 + 48 §2). */
export interface TenderExpectation {
  tenderTypeId: number;
  tenderTypeName: string;
  closeMode: TenderCloseMode;
  /** CASH: the till cash tender (all cash tenders share one drawer). */
  tenderId: string | null;
  tenderName: string | null;
  /** The ledger this tender's money sits in (acc_tender_master.tnd_ledger_id). */
  ledgerId: string | null;
  open: Prisma.Decimal;
  sales: Prisma.Decimal;
  refund: Prisma.Decimal;
  receipt: Prisma.Decimal;
  payment: Prisma.Decimal;
  expense: Prisma.Decimal;
  movedIn: Prisma.Decimal;
  movedOut: Prisma.Decimal;
  /**
   * 48 plan §2.1 — payments and expenses paid by a non-drawer tender (NEFT, a
   * company card, a cheque): information only, never in `expected`, so a card
   * slip count is not reduced because the store paid a bill from the bank.
   * Always zero on CASH.
   */
  paidFromBank: Prisma.Decimal;
  txnCount: number;
  /**
   * Non-cash plan §4.3 — money-in rows of this tender with no reference: what
   * the statement cannot match by REF, so the thing to chase. UPI is not asked
   * for one at billing yet (2026-10-08), so this is its watch figure. 0 on CASH.
   */
  noRefCount: number;
  /** open + sales − refund + receipt − payment − expense + in − out. */
  expected: Prisma.Decimal;
}

export interface TillCashTender {
  tenderId: string;
  tenderName: string;
  ledgerId: string;
}

export interface SafeRef {
  safeId: string;
  ledgerId: string;
  name: string;
}

/**
 * The till's view of the books (§5.4, §5.7): what a drawer SHOULD hold, and
 * which ledgers a till voucher hits.
 *
 * ── expected() is the one formula, server only (D4) ────────────────────────
 * The client never computes it; a blind cashier never sees it. It reads only
 * facts already in the database:
 *
 *   open      tss_float_counted (cash) — the COUNTED float, so a float mismatch
 *             is settled at open and not carried into the close
 *   sales     tender rows DR of a sale document (bill, order advance, re-tender)
 *   refunds   tender rows CR of a sale document (return cash settle …)
 *   receipts  tender rows DR of a money document (receipt, payment / expense DR side)
 *   payments  tender rows CR of a payment (48)
 *   expenses  tender rows CR of an expense voucher (48)
 *   in / out  TOP_UP + PAID_IN / PICKUP + DROP movements, POSTED
 *             (FLOAT_ISSUE is not added: the counted float already is it;
 *              CLOSE_HANDOVER is not subtracted: it happens after the count)
 *
 * A tender row counts only once its document is LIVE: a POSTED bill / return
 * (bill tender rows carry no voucher id, and a draft or cancelled bill keeps
 * its rows), or a POSTED voucher for everything else. Voided and deleted rows
 * never count. The amount is td_total_amt — what the tender took, surcharge
 * included; change given is already netted out of td_amount.
 */
@Injectable()
export class TillLedgerService {
  async expected(tx: Tx, session: ExpectationSession): Promise<TenderExpectation[]> {
    const cashTender = await this.tillCashTender(tx, session.tssCompanyId, session.tssBranchId);
    const types = await tx.$queryRaw<
      { ttm_type_id: number; ttm_type_name: string; ttm_close_mode: string }[]
    >`SELECT ttm_type_id, ttm_type_name, ttm_close_mode FROM accounts.acc_tender_types`;
    const typeById = new Map(types.map((t) => [t.ttm_type_id, t]));

    const rows = await tx.$queryRaw<
      {
        type_id: number;
        tender_id: string | null;
        tender_name: string | null;
        ledger_id: string | null;
        sales: Prisma.Decimal;
        refund: Prisma.Decimal;
        receipt: Prisma.Decimal;
        payment: Prisma.Decimal;
        expense: Prisma.Decimal;
        txn_count: number;
        no_ref_count: number;
      }[]
    >`
      SELECT t.td_tender_type_id AS type_id,
             t.td_tender_id      AS tender_id,
             max(m.tnd_name)     AS tender_name,
             max(m.tnd_ledger_id::text)::uuid AS ledger_id,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'DR'
                      AND t.td_src_doc_type IN ('SALE_BILL','SALES_ORDER','SALE_RETURN','OTHER')), 0) AS sales,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'CR'
                      AND t.td_src_doc_type IN ('SALE_BILL','SALES_ORDER','SALE_RETURN','OTHER')), 0) AS refund,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'DR'
                      AND t.td_src_doc_type IN ('RECEIPT','PAYMENT','EXPENSE')), 0)                 AS receipt,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'CR'
                      AND t.td_src_doc_type IN ('RECEIPT','PAYMENT')), 0)                          AS payment,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'CR'
                      AND t.td_src_doc_type = 'EXPENSE'), 0)                                       AS expense,
             count(*)::int AS txn_count,
             count(*) FILTER (WHERE t.td_dr_cr = 'DR' AND NULLIF(btrim(t.td_ref_no), '') IS NULL)::int AS no_ref_count
        FROM accounts.acc_tender_detail t
        LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = t.td_tender_id
        LEFT JOIN sales.sale_bill b
               ON t.td_src_doc_type = 'SALE_BILL'
              AND b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
        LEFT JOIN sales.sale_return r
               ON t.td_src_doc_type = 'SALE_RETURN'
              AND r.sr_id = t.td_src_doc_id AND r.sr_acc_year = t.td_acc_year
        LEFT JOIN accounts.acc_voucher_header h
               ON t.td_voucher_id IS NOT NULL AND h.avh_voucher_id = t.td_voucher_id
       WHERE t.td_session_id = ${session.tssId}::uuid
         AND t.td_acc_year   = ${session.tssAccYear}::char(9)
         AND t.td_is_deleted = false
         AND (t.td_is_voided = false
              OR (${session.tssClosedOn ?? null}::timestamptz IS NOT NULL
                  AND t.td_voided_on > ${session.tssClosedOn ?? null}::timestamptz))
         AND CASE t.td_src_doc_type
               WHEN 'SALE_BILL'   THEN b.sb_status = 'POSTED'
               WHEN 'SALE_RETURN' THEN r.sr_status = 'POSTED'
               ELSE h.avh_voucher_status = 'POSTED' AND h.avh_is_deleted = false
             END
       GROUP BY t.td_tender_type_id, t.td_tender_id`;

    const moved = await this.movementTotals(tx, session);
    const out: TenderExpectation[] = [];

    // CASH first, always — even an all-card session counts its float back.
    const cashType = typeById.get(CASH_TENDER_TYPE_ID);
    const cash: TenderExpectation = {
      tenderTypeId: CASH_TENDER_TYPE_ID,
      tenderTypeName: cashType?.ttm_type_name ?? 'CASH',
      closeMode: TenderCloseMode.DENOM,
      tenderId: cashTender.tenderId,
      tenderName: cashTender.tenderName,
      ledgerId: cashTender.ledgerId,
      open: session.tssFloatCounted,
      sales: ZERO,
      refund: ZERO,
      receipt: ZERO,
      payment: ZERO,
      expense: ZERO,
      movedIn: moved.in,
      movedOut: moved.out,
      paidFromBank: ZERO,
      txnCount: 0,
      noRefCount: 0,
      expected: ZERO,
    };
    out.push(cash);

    for (const row of rows) {
      if (row.type_id === CASH_TENDER_TYPE_ID) {
        // Every cash tender row lands in the ONE drawer.
        cash.sales = cash.sales.plus(row.sales);
        cash.refund = cash.refund.plus(row.refund);
        cash.receipt = cash.receipt.plus(row.receipt);
        cash.payment = cash.payment.plus(row.payment);
        cash.expense = cash.expense.plus(row.expense);
        cash.txnCount += row.txn_count;
        continue;
      }
      const type = typeById.get(row.type_id);
      out.push({
        tenderTypeId: row.type_id,
        tenderTypeName: type?.ttm_type_name ?? String(row.type_id),
        closeMode: (type?.ttm_close_mode as TenderCloseMode | undefined) ?? TenderCloseMode.NONE,
        tenderId: row.tender_id,
        tenderName: row.tender_name,
        ledgerId: row.ledger_id,
        open: ZERO,
        sales: new Prisma.Decimal(row.sales),
        refund: new Prisma.Decimal(row.refund),
        receipt: new Prisma.Decimal(row.receipt),
        // Only the drawer pays out (§2.1): a payment / expense on this tender is
        // the bank's, shown and never counted.
        payment: ZERO,
        expense: ZERO,
        movedIn: ZERO,
        movedOut: ZERO,
        paidFromBank: new Prisma.Decimal(row.payment).plus(row.expense),
        txnCount: row.txn_count,
        noRefCount: row.no_ref_count,
        expected: ZERO,
      });
    }

    for (const t of out) {
      t.expected = t.open
        .plus(t.sales)
        .minus(t.refund)
        .plus(t.receipt)
        .minus(t.payment)
        .minus(t.expense)
        .plus(t.movedIn)
        .minus(t.movedOut);
    }
    return out;
  }

  /** TOP_UP + PAID_IN in, PICKUP + DROP out, POSTED, this session. */
  private async movementTotals(
    tx: Tx,
    session: ExpectationSession,
  ): Promise<{ in: Prisma.Decimal; out: Prisma.Decimal }> {
    const [row] = await tx.$queryRaw<{ moved_in: Prisma.Decimal; moved_out: Prisma.Decimal }[]>`
      SELECT COALESCE(sum(tcm_amount) FILTER (WHERE tcm_kind IN (${TillMovementKind.TOP_UP}, ${TillMovementKind.PAID_IN})), 0) AS moved_in,
             COALESCE(sum(tcm_amount) FILTER (WHERE tcm_kind IN (${TillMovementKind.PICKUP}, ${TillMovementKind.DROP})), 0)      AS moved_out
        FROM accounts.till_cash_movement
       WHERE tcm_session_id = ${session.tssId}::uuid
         AND tcm_acc_year   = ${session.tssAccYear}::char(9)
         AND tcm_status     = 'POSTED'
         AND tcm_is_deleted = false`;
    return { in: new Prisma.Decimal(row.moved_in), out: new Prisma.Decimal(row.moved_out) };
  }

  /**
   * The till cash ledger = the branch's CASH tender ledger (D9) — ONE source of
   * truth, so a sale and a payout hit the same ledger. A branch row beats the
   * company row; the default beats the rest.
   */
  async tillCashTender(tx: Tx, companyId: string, branchId: string): Promise<TillCashTender> {
    const [row] = await tx.$queryRaw<{ tnd_id: string; tnd_name: string; tnd_ledger_id: string }[]>`
      SELECT tnd_id, tnd_name, tnd_ledger_id
        FROM accounts.acc_tender_master
       WHERE tnd_type_id    = ${CASH_TENDER_TYPE_ID}::int
         AND tnd_company_id = ${companyId}::uuid
         AND (tnd_branch_id = ${branchId}::uuid OR tnd_branch_id IS NULL)
         AND tnd_is_active  = true
         AND tnd_is_deleted = false
       ORDER BY (tnd_branch_id IS NULL), tnd_is_default DESC, tnd_display_position, tnd_created_on
       LIMIT 1`;
    if (!row) {
      throwTill(
        TillErrorCode.LEDGER_UNMAPPED,
        'This branch has no active CASH tender: the till cash ledger is the CASH tender’s ledger (Tender Master, menu 95)',
        'branchId',
        { role: 'TILL_CASH' },
      );
    }
    return { tenderId: row.tnd_id, tenderName: row.tnd_name, ledgerId: row.tnd_ledger_id };
  }

  /**
   * Where a counter's cash goes: its own safe, else the branch default safe,
   * else the branch's only safe. Null when none — the caller decides whether
   * that is fatal (a float to issue, cash to hand over) or not.
   */
  async safeFor(
    tx: Tx,
    scope: { companyId: string; branchId: string; counterSafeId: string | null },
  ): Promise<SafeRef | null> {
    const rows = await tx.$queryRaw<
      { tsf_id: string; tsf_ledger_id: string; tsf_name: string; tsf_is_default: boolean }[]
    >`
      SELECT tsf_id, tsf_ledger_id, tsf_name, tsf_is_default
        FROM accounts.till_safe
       WHERE tsf_company_id = ${scope.companyId}::uuid
         AND tsf_branch_id  = ${scope.branchId}::uuid
         AND tsf_is_active  = true
         AND tsf_is_deleted = false
       ORDER BY tsf_created_on`;
    const own = scope.counterSafeId
      ? rows.find((r) => r.tsf_id === scope.counterSafeId)
      : undefined;
    const pick =
      own ?? rows.find((r) => r.tsf_is_default) ?? (rows.length === 1 ? rows[0] : undefined);
    return pick ? { safeId: pick.tsf_id, ledgerId: pick.tsf_ledger_id, name: pick.tsf_name } : null;
  }

  /**
   * A till role's ledger, or 422 TILL_LEDGER_UNMAPPED naming it (§6: the map
   * rows are set on the Ledger Map screen). Resolved here rather than left to
   * the posting service, whose refusal is a generic 400.
   */
  async roleLedger(tx: Tx, role: string, companyId: string, branchId: string): Promise<string> {
    const resolved = await resolveRoleLedgers(tx, [{ role }], {
      companyId,
      branchId,
      where: 'till',
    });
    const hit = [...resolved.values()][0];
    if (!hit) {
      throwTill(
        TillErrorCode.LEDGER_UNMAPPED,
        `The till role ${role} has no ledger. Map it on the Ledger Map screen (menu 250).`,
        'role',
        { role },
      );
    }
    return hit.ledgerId;
  }
}
