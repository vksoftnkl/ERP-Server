import { Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

/** One open bill, in the order /receipts/open-items lists it, with what it owes NOW (read under lock). */
export interface OpenBillRoom {
  billId: string;
  billAccYear: string;
  pending: Prisma.Decimal;
}

/** One bill the money settles: the `allocations[]` row /receipts/post takes. */
export interface FilledBill {
  billId: string;
  billAccYear: string;
  amount: Prisma.Decimal;
}

/**
 * What a phone receipt's money can settle: the instruments, less the CR
 * other-ledger lines the draft save seeded from them (SURCHARGE_RECOVERED: the
 * surcharge is INSIDE tdAmount, notes 107, and pays no bill). These are the
 * engine's own terms: its identity is money + DR deductions + credits =
 * allocated + on account + CR extras. A phone receipt sends no other-ledger
 * line, so its only DR line is a seeded BANK_CHARGES, the MDR split of an
 * instrument, which the engine leaves out of the identity (isInstrumentSplit),
 * and so does this.
 */
export function moneyForBills(
  tenders: readonly { tdAmount: number | string | Prisma.Decimal }[],
  otherLines: readonly { drCr: string; amount: number | string | Prisma.Decimal }[],
): Prisma.Decimal {
  const money = tenders.reduce((total, t) => total.plus(t.tdAmount), ZERO);
  const extras = otherLines
    .filter((line) => line.drCr === 'CR')
    .reduce((total, line) => total.plus(line.amount), ZERO);
  return money.minus(extras);
}

/**
 * The user's rule for a phone receipt (2026-11-17, decision 4): the money
 * fills the customer's open bills in the order /receipts/open-items returns
 * them (accounts.receipt_bill_sort, due date first by default), each up to
 * what it still owes, until it runs out; the rest is held on account. It is
 * the Qt receipt screen's Auto-allocate step 3 (ReceiptAllocationEngine::
 * allocate) with nothing typed, no credits and no deductions, and it only
 * WRITES the per-bill figures: the allocation engine (allocation-engine.ts)
 * still splits them into adjustment rows and checks every one of them, and
 * the on-account figure, exactly as on /receipts/post.
 *
 * A bill that owes nothing now is passed over; no bill is named twice. Pure:
 * Decimal in, Decimal out, nothing rounded (both sides are already paise).
 */
export function fillOldestFirst(
  bills: readonly OpenBillRoom[],
  pool: Prisma.Decimal,
): { allocations: FilledBill[]; onAccount: Prisma.Decimal } {
  const allocations: FilledBill[] = [];
  const seen = new Set<string>();
  let left = pool.greaterThan(0) ? pool : ZERO;
  for (const bill of bills) {
    if (left.lessThanOrEqualTo(0)) {
      break;
    }
    const key = `${bill.billId}|${bill.billAccYear}`;
    if (seen.has(key) || bill.pending.lessThanOrEqualTo(0)) {
      continue;
    }
    seen.add(key);
    const take = Prisma.Decimal.min(left, bill.pending);
    allocations.push({ billId: bill.billId, billAccYear: bill.billAccYear, amount: take });
    left = left.minus(take);
  }
  return { allocations, onAccount: left };
}
