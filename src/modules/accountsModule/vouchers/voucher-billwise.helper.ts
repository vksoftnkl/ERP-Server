import { Prisma } from '@prisma/client';
import type { BillKey } from '../billBalance/bill-balance-recompute.service';
import type { DrCr } from './types/vouchers-api.types';
import type { InternalAllocation, InternalBill } from './voucher-derive';
import { opposite } from './voucher-derive';

/**
 * §7.3 step 10 — the bill a party leg RAISES and the allocations it makes,
 * written as `acc_bill_balance` / `acc_bill_adjustment` rows.
 *
 * The rows are the truth and the bill's cached totals are re-derived from
 * them by `BillBalanceRecomputeService` (the TypeScript `fn_abl_recompute`)
 * in the same transaction — never incremented by hand here, so the receipt,
 * the sale bill and the register all agree on what "allocated" means.
 *
 * Shapes (ck_abj_against decides which):
 *   · DEMAND (Receipt / Payment Voucher) — money from outside settles the
 *     party's bills: ONE `ALLOCATION` row per bill, no opposite bill.
 *   · RAISE / OPTIONAL — the voucher raises its own bill for the WHOLE party
 *     amount, and an allocation is a two-sided settlement between that bill
 *     and an existing one: a PAIR of rows, one moving each, pointing at each
 *     other (`ADVANCE_ADJUST` when the existing bill is an advance,
 *     `TRANSFER` on a Journal, `NOTE_ADJUST` for a note or an accounting
 *     invoice). Unallocated, the raised bill stays OPEN — the credit the
 *     Receipt screen's credits band reads.
 *
 * A row's `abj_dr_cr` is the movement that REDUCES the bill it names: a DR
 * bill is settled by CR, a CR bill by DR (the receipt's and the sale bill's
 * convention).
 */

export interface BillWriteContext {
  companyId: string;
  branchId: string;
  tenantId: string | null;
  accYear: string;
  voucherId: string;
  voucherTypeId: number;
  voucherNo: bigint;
  voucherDate: string;
  voucherRefno: string;
  docDate: string | null;
  userId: string;
  sessionId: string | null;
  actor: string;
  now: Date;
}

export interface RaisedBill extends BillKey {
  lineRowNo: number;
}

export async function raiseBill(
  tx: Prisma.TransactionClient,
  ctx: BillWriteContext,
  bill: InternalBill,
  legAvId: string | null,
): Promise<RaisedBill> {
  const row = await tx.accBillBalance.create({
    data: {
      ablCompanyId: ctx.companyId,
      ablBranchId: ctx.branchId,
      ablTenantId: ctx.tenantId,
      ablAccYear: ctx.accYear,
      ablPartyId: bill.party.ledId,
      ablBillType: bill.billType,
      ablSrcModule: 'ACCOUNTS',
      ablSrcDocType: 'VOUCHER',
      ablSrcDocId: ctx.voucherId,
      ablSrcAccYear: ctx.accYear,
      // ck_abl_voucher: a non-OPENING bill names its voucher and type.
      ablVoucherId: ctx.voucherId,
      ablVoucherLineId: legAvId,
      ablVoucherTypeId: ctx.voucherTypeId,
      ablVoucherNo: ctx.voucherNo,
      ablVoucherDate: new Date(`${ctx.voucherDate}T00:00:00Z`),
      ablVoucherRefno: ctx.voucherRefno,
      // Both NOT NULL: the party's own document, else the voucher's.
      ablDocRefno: bill.docRefno ?? ctx.voucherRefno,
      ablDocDate: new Date(`${ctx.docDate ?? ctx.voucherDate}T00:00:00Z`),
      ablDueDate: new Date(`${bill.dueDate}T00:00:00Z`),
      ablCreditDays: bill.dueDays,
      ablDrCr: bill.side,
      ablBillAmount: bill.amount,
      ablNarration: `${bill.billType} bill raised by voucher ${ctx.voucherRefno}`,
      ablCreatedBy: ctx.actor,
    },
    select: { ablId: true, ablAccYear: true },
  });
  return { billId: row.ablId, accYear: row.ablAccYear.trim(), lineRowNo: bill.lineRowNo };
}

/** Writes every allocation row; returns the bills whose cached totals must be re-derived. */
export async function writeAllocations(
  tx: Prisma.TransactionClient,
  ctx: BillWriteContext,
  allocations: readonly InternalAllocation[],
  raisedByLine: ReadonlyMap<number, RaisedBill>,
  legAvIdByRow: ReadonlyMap<number, string>,
): Promise<BillKey[]> {
  const touched = new Map<string, BillKey>();
  let rowNo = 0;
  const adjDate = new Date(`${ctx.voucherDate}T00:00:00Z`);
  const common = (
    a: InternalAllocation,
  ): Omit<
    Prisma.AccBillAdjustmentUncheckedCreateInput,
    | 'abjBillId'
    | 'abjBillAccYear'
    | 'abjRowNo'
    | 'abjDrCr'
    | 'abjAmount'
    | 'abjAgainstBillId'
    | 'abjAgainstBillAccYear'
  > => ({
    abjCompanyId: ctx.companyId,
    abjBranchId: ctx.branchId,
    abjTenantId: ctx.tenantId,
    abjAccYear: ctx.accYear,
    abjPartyId: a.party.ledId,
    abjVoucherId: ctx.voucherId,
    abjVoucherAccYear: ctx.accYear,
    abjVoucherLineId: legAvIdByRow.get(a.legRowNo) ?? null,
    abjAdjType: a.adjType,
    abjAdjDate: adjDate,
    abjSettlementMode: a.settlementMode,
    abjUserId: ctx.userId,
    abjSessionId: ctx.sessionId,
    abjCreatedOn: ctx.now,
    abjCreatedBy: ctx.actor,
  });

  for (const a of allocations) {
    const existing: BillKey = { billId: a.bill.ablId, accYear: a.bill.ablAccYear };
    touched.set(`${existing.billId}|${existing.accYear}`, existing);
    if (a.adjType === 'ALLOCATION') {
      await tx.accBillAdjustment.create({
        data: {
          ...common(a),
          abjBillId: existing.billId,
          abjBillAccYear: existing.accYear,
          abjRowNo: ++rowNo,
          abjDrCr: opposite(a.bill.side),
          abjAmount: a.amount,
          abjAgainstBillId: null,
          abjAgainstBillAccYear: null,
        },
      });
      continue;
    }
    const raised = raisedByLine.get(a.lineRowNo);
    if (!raised) {
      throw new Error(
        `voucher ${ctx.voucherRefno}: allocation on line ${a.lineRowNo} has no raised bill to pair with`,
      );
    }
    touched.set(`${raised.billId}|${raised.accYear}`, raised);
    const raisedSide: DrCr = opposite(a.bill.side);
    // Row 1 — moves the RAISED bill. Row 2 — moves the EXISTING one.
    await tx.accBillAdjustment.create({
      data: {
        ...common(a),
        abjBillId: raised.billId,
        abjBillAccYear: raised.accYear,
        abjAgainstBillId: existing.billId,
        abjAgainstBillAccYear: existing.accYear,
        abjRowNo: ++rowNo,
        abjDrCr: opposite(raisedSide),
        abjAmount: a.amount,
      },
    });
    await tx.accBillAdjustment.create({
      data: {
        ...common(a),
        abjBillId: existing.billId,
        abjBillAccYear: existing.accYear,
        abjAgainstBillId: raised.billId,
        abjAgainstBillAccYear: raised.accYear,
        abjRowNo: ++rowNo,
        abjDrCr: opposite(a.bill.side),
        abjAmount: a.amount,
      },
    });
  }
  return [...touched.values()];
}

/**
 * §8.3 step 3 — every live row this voucher wrote gets a NEGATIVE counter-row
 * (`abj_reversal_of_id`, ck_abj_reversal_sign), filed against the REVERSAL
 * voucher so the trail names what undid it. Never a delete.
 */
export async function reverseVoucherAllocations(
  tx: Prisma.TransactionClient,
  params: {
    voucherId: string;
    accYear: string;
    reversalVoucherId: string;
    reason: string;
    actor: string;
    now: Date;
  },
): Promise<{ count: number; touched: BillKey[] }> {
  const forward = await tx.accBillAdjustment.findMany({
    where: {
      abjVoucherId: params.voucherId,
      abjVoucherAccYear: params.accYear,
      abjIsDeleted: false,
      abjReversalOfId: null,
    },
    orderBy: { abjRowNo: 'asc' },
  });
  const reversed = new Set(
    (
      await tx.accBillAdjustment.findMany({
        where: { abjReversalOfId: { in: forward.map((r) => r.abjId) }, abjIsDeleted: false },
        select: { abjReversalOfId: true },
      })
    ).map((r) => r.abjReversalOfId as string),
  );
  const rows = forward.filter((r) => !reversed.has(r.abjId));
  let rowNo = 0;
  for (const r of rows) {
    await tx.accBillAdjustment.create({
      data: {
        abjCompanyId: r.abjCompanyId,
        abjBranchId: r.abjBranchId,
        abjTenantId: r.abjTenantId,
        abjAccYear: r.abjAccYear,
        abjBillId: r.abjBillId,
        abjBillAccYear: r.abjBillAccYear,
        abjPartyId: r.abjPartyId,
        abjRowNo: ++rowNo,
        abjAgainstBillId: r.abjAgainstBillId,
        abjAgainstBillAccYear: r.abjAgainstBillAccYear,
        abjVoucherId: params.reversalVoucherId,
        abjVoucherAccYear: params.accYear,
        abjVoucherLineId: null,
        abjAdjType: r.abjAdjType,
        abjAdjDate: r.abjAdjDate,
        abjIsPostDated: r.abjIsPostDated,
        abjDrCr: r.abjDrCr.trim() === 'DR' ? 'CR' : 'DR',
        abjAmount: r.abjAmount.negated(),
        abjSettlementMode: r.abjSettlementMode,
        abjSettlementLedgerId: r.abjSettlementLedgerId,
        abjApprovedBy: r.abjApprovedBy,
        abjReversalOfId: r.abjId,
        abjReversalReason: params.reason.slice(0, 250),
        abjUserId: r.abjUserId,
        abjSessionId: r.abjSessionId,
        abjCreatedOn: params.now,
        abjCreatedBy: params.actor,
      },
    });
  }
  const touched = new Map<string, BillKey>();
  for (const r of forward) {
    touched.set(`${r.abjBillId}|${r.abjBillAccYear.trim()}`, {
      billId: r.abjBillId,
      accYear: r.abjBillAccYear.trim(),
    });
  }
  return { count: rows.length, touched: [...touched.values()] };
}

/**
 * §8.3 step 2 — another voucher has settled against a bill THIS voucher
 * raised: names the other voucher's refno, or null when nothing has.
 */
export async function otherVoucherOnRaisedBills(
  tx: Prisma.TransactionClient,
  voucherId: string,
  accYear: string,
): Promise<{ voucherRefno: string | null; billRefno: string }[]> {
  return tx.$queryRaw<{ voucherRefno: string | null; billRefno: string }[]>`
    SELECT DISTINCT h.avh_voucher_refno AS "voucherRefno", b.abl_doc_refno AS "billRefno"
      FROM accounts.acc_bill_balance b
      JOIN accounts.acc_bill_adjustment j
        ON (j.abj_bill_id = b.abl_id OR j.abj_against_bill_id = b.abl_id)
      LEFT JOIN accounts.acc_voucher_header h
        ON h.avh_voucher_id = j.abj_voucher_id AND h.avh_acc_year = j.abj_voucher_acc_year
     WHERE b.abl_voucher_id = ${voucherId}::uuid
       AND b.abl_acc_year   = ${accYear}::char(9)
       AND b.abl_is_deleted = false
       AND j.abj_is_deleted = false
       AND j.abj_reversal_of_id IS NULL
       AND j.abj_amount > 0
       AND (j.abj_voucher_id IS NULL OR j.abj_voucher_id <> ${voucherId}::uuid)
       AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x
                        WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)`;
}
