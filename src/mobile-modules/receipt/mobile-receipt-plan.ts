import { Prisma } from '@prisma/client';
import { throwUnprocessable, type ModuleErrorDetail } from '../../common/utils/module-shared.utils';
import { suggestPpdDiscount, type PpdSlab } from '../../modules/accountsModule/receipt/ppd-slab';
import { MobileErrorCode } from '../common/mobile-error-codes';

/*
 * The phone's own settlement (VKSMAN receipt, canvas page 5b, approved
 * 2026-11-19): which bills its money and credits settle, with a prompt-payment
 * discount and a round-off per bill. The phone works offline from its last
 * Sync, so the bills may have moved by the time the upload arrives. Everything
 * here is pure (Decimal in, Decimal out); the service reads the bills under
 * the row lock and hands them in, and the desktop allocation engine still
 * checks every figure this answers, exactly as on /receipts/post.
 */

const ZERO = new Prisma.Decimal(0);

/** D5: a phone round-off takes off paise only. */
export const MOBILE_ROUNDOFF_MAX = new Prisma.Decimal('0.99');

/** The (id, year) key every bill is named by (acc_bill_balance is partitioned by year). */
export const billKeyOf = (row: { billId: string; billAccYear: string }): string =>
  `${row.billId}|${row.billAccYear.trim()}`;

/** One bill line of the phone: money and credits together, then its discount and round-off. */
export interface PlanLine {
  billId: string;
  billAccYear: string;
  amount: Prisma.Decimal;
  discount: Prisma.Decimal;
  roundoff: Prisma.Decimal;
}

/** One credit the phone spends (an advance, a sales return, a CR opening or journal). */
export interface PlanCredit {
  billId: string;
  billAccYear: string;
  amount: Prisma.Decimal;
}

/** A receivable as it stands now, read under the row lock. `live` = not deleted, something pending. */
export interface BillNow {
  billId: string;
  billAccYear: string;
  docRefno: string;
  docDate: Date;
  pending: Prisma.Decimal;
  live: boolean;
}

/** A credit as it stands now, read under the row lock. `live` = not deleted, something held. */
export interface CreditNow {
  billId: string;
  billAccYear: string;
  docRefno: string;
  held: Prisma.Decimal;
  live: boolean;
}

export interface PlanInput {
  /** The phone's lines, in its order. */
  lines: readonly PlanLine[];
  /** The phone's credits, in its order. */
  credits: readonly PlanCredit[];
  /** Every bill a line names, by billKeyOf. */
  billsNow: ReadonlyMap<string, BillNow>;
  /** Every credit the phone names, by billKeyOf. */
  creditsNow: ReadonlyMap<string, CreditNow>;
  /** The party's open bills now, in /receipts/open-items order (oldest first). */
  openOrder: readonly BillNow[];
  /** The money the bills can take: the instruments less the CR extras (moneyForBills). */
  money: Prisma.Decimal;
  /**
   * The phone sent no allocations key, only credits (a phone with no open bills
   * on it): the money and the credits fill the open bills oldest first, as an
   * older phone's money does, instead of only the money D1 freed.
   */
  fillAll?: boolean;
}

export interface PlanResult {
  /** The lines /receipts/post takes: the phone's (capped) in its order, then the freed money's. */
  allocations: PlanLine[];
  creditsApplied: PlanCredit[];
  /**
   * money + credits − allocations. Negative only when the phone allocated more
   * than it had: the caller then claims 0 and the engine refuses the receipt as
   * unbalanced (VCH_UNBALANCED), as it refuses a desktop one.
   */
  onAccount: Prisma.Decimal;
}

const sumOf = (values: readonly Prisma.Decimal[]): Prisma.Decimal =>
  values.reduce((total, value) => total.plus(value), ZERO);

const settles = (line: Pick<PlanLine, 'amount' | 'discount' | 'roundoff'>): Prisma.Decimal =>
  line.amount.plus(line.discount).plus(line.roundoff);

/**
 * D5 and D4, on the phone's own figures, before anything is capped. Refusals,
 * because a figure the phone may never send is a phone fault, not a bill that
 * moved:
 *  - D5: a round-off above 0.99 (422 MOBILE_RECEIPT_ROUNDOFF_TOO_BIG);
 *  - D4: a discount above what accounts.ppd_slabs suggests for that bill on
 *    the receipt's date (ppd-slab.ts, the figure /receipts/open-items offers):
 *    422 MOBILE_RECEIPT_DISCOUNT_ABOVE_PPD. No slabs = no discount allowed.
 *
 * The suggestion is a percentage of what the bill still owes. It is measured
 * on what is pending now, or on what the line itself settles when that is
 * more: a bill paid down in the office since the phone's Sync must not turn
 * a discount worked out on the older, larger pending into a refusal. A line
 * on a bill that is no longer open is not checked for D4: D1 drops it.
 */
export function assertPhoneLimits(
  lines: readonly PlanLine[],
  billsNow: ReadonlyMap<string, BillNow>,
  receiptDate: Date,
  slabs: readonly PpdSlab[],
): void {
  lines.forEach((line, index) => {
    const bill = billsNow.get(billKeyOf(line));
    const refno = bill?.docRefno ?? line.billId;
    if (line.roundoff.greaterThan(MOBILE_ROUNDOFF_MAX)) {
      throwUnprocessable<ModuleErrorDetail>('Round-off too big', [
        {
          field: `allocations.${index}.roundoff`,
          code: MobileErrorCode.RECEIPT_ROUNDOFF_TOO_BIG,
          message:
            `Round-off ${line.roundoff.toFixed(2)} on bill ${refno} is more than ` +
            `${MOBILE_ROUNDOFF_MAX.toFixed(2)}. A phone rounds off paise only.`,
        },
      ]);
    }
    if (!bill || !bill.live || line.discount.lessThanOrEqualTo(0)) {
      return;
    }
    const limit = suggestPpdDiscount({
      docDate: bill.docDate,
      onDate: receiptDate,
      pendingAmount: Prisma.Decimal.max(bill.pending, settles(line)),
      slabs,
    });
    if (line.discount.greaterThan(limit)) {
      throwUnprocessable<ModuleErrorDetail>('Discount above the prompt-payment slab', [
        {
          field: `allocations.${index}.discount`,
          code: MobileErrorCode.RECEIPT_DISCOUNT_ABOVE_PPD,
          message:
            `Discount ${line.discount.toFixed(2)} on bill ${refno} is more than the ` +
            `${limit.toFixed(2)} the prompt-payment slabs allow on ` +
            `${receiptDate.toISOString().slice(0, 10)}.`,
        },
      ]);
    }
  });
}

/**
 * D1, the user's rule for bills that moved since the phone's Sync (approved
 * 2026-11-19): a phone receipt is never refused for ACC_BILL_MOVED. Against the
 * bills and credits as they stand now (read under the row lock):
 *
 *  1. Each line is capped at what its bill can take now, after its discount
 *     and round-off. A bill no longer open (settled, cancelled) frees its whole
 *     line, and its discount and round-off are dropped. A bill that now owes
 *     less than the discount and round-off keeps only what it owes.
 *  2. Each credit is capped at what it still holds; a credit spent or
 *     cancelled meanwhile applies nothing.
 *  3. Less credit than the phone planned leaves the bills short of that much:
 *     the last lines give it back (never more than the credit lost).
 *  4. The money the capped lines freed goes to the party's open bills in
 *     /receipts/open-items order (oldest first), each up to what it still owes
 *     after this receipt's own line on it; what no bill takes is on account.
 *     Money the phone itself held on account stays there. With `fillAll` (no
 *     allocations key, only credits) all the money and credits fill them so.
 *  5. A credit may not be held on account again (the engine refuses
 *     ACC_CREDIT_OVERSPENT), so credits beyond what the bills take are cut,
 *     the last first.
 *
 * Lines that settle nothing are left out. The answer's adjusted[] reports
 * every change (adjustedAgainstPlan).
 */
export function reconcilePhonePlan(input: PlanInput): PlanResult {
  // 1 · lines capped at what each bill can take now
  let freed = ZERO;
  const lines: PlanLine[] = [];
  for (const line of input.lines) {
    const bill = input.billsNow.get(billKeyOf(line));
    if (!bill || !bill.live) {
      freed = freed.plus(line.amount);
      continue;
    }
    const roundoff = Prisma.Decimal.min(line.roundoff, bill.pending);
    const discount = Prisma.Decimal.min(line.discount, bill.pending.minus(roundoff));
    const room = bill.pending.minus(discount).minus(roundoff);
    const amount = Prisma.Decimal.min(line.amount, room);
    freed = freed.plus(line.amount.minus(amount));
    lines.push({
      billId: line.billId,
      billAccYear: line.billAccYear,
      amount,
      discount,
      roundoff,
    });
  }

  // 2 · credits capped at what each still holds
  let creditLost = ZERO;
  const credits: PlanCredit[] = input.credits.map((credit) => {
    const now = input.creditsNow.get(billKeyOf(credit));
    const held = now && now.live ? now.held : ZERO;
    const amount = Prisma.Decimal.min(credit.amount, held);
    creditLost = creditLost.plus(credit.amount.minus(amount));
    return { billId: credit.billId, billAccYear: credit.billAccYear, amount };
  });

  // 3 · a lost credit leaves the last lines short by as much
  const pool = input.money.plus(sumOf(credits.map((credit) => credit.amount)));
  const excess = sumOf(lines.map((line) => line.amount)).minus(pool);
  let giveBack = Prisma.Decimal.min(Prisma.Decimal.max(excess, ZERO), creditLost);
  for (let index = lines.length - 1; index >= 0 && giveBack.greaterThan(0); index -= 1) {
    const take = Prisma.Decimal.min(lines[index].amount, giveBack);
    lines[index] = { ...lines[index], amount: lines[index].amount.minus(take) };
    giveBack = giveBack.minus(take);
  }

  // 4 · the freed money (or, with fillAll, everything) to the open bills, oldest first
  const room = Prisma.Decimal.max(pool.minus(sumOf(lines.map((line) => line.amount))), ZERO);
  let spread = input.fillAll ? room : Prisma.Decimal.min(freed, room);
  const byKey = new Map(lines.map((line, index) => [billKeyOf(line), index]));
  for (const bill of input.openOrder) {
    if (spread.lessThanOrEqualTo(0)) {
      break;
    }
    if (!bill.live) {
      continue;
    }
    const index = byKey.get(billKeyOf(bill));
    const used = index === undefined ? ZERO : settles(lines[index]);
    const left = bill.pending.minus(used);
    if (left.lessThanOrEqualTo(0)) {
      continue;
    }
    const take = Prisma.Decimal.min(left, spread);
    if (index === undefined) {
      byKey.set(billKeyOf(bill), lines.length);
      lines.push({
        billId: bill.billId,
        billAccYear: bill.billAccYear,
        amount: take,
        discount: ZERO,
        roundoff: ZERO,
      });
    } else {
      lines[index] = { ...lines[index], amount: lines[index].amount.plus(take) };
    }
    spread = spread.minus(take);
  }

  const allocations = lines.filter((line) => settles(line).greaterThan(0));
  const allocated = sumOf(allocations.map((line) => line.amount));

  // 5 · credits land on bills only
  let over = sumOf(credits.map((credit) => credit.amount)).minus(allocated);
  for (let index = credits.length - 1; index >= 0 && over.greaterThan(0); index -= 1) {
    const take = Prisma.Decimal.min(credits[index].amount, over);
    credits[index] = { ...credits[index], amount: credits[index].amount.minus(take) };
    over = over.minus(take);
  }
  const creditsApplied = credits.filter((credit) => credit.amount.greaterThan(0));

  return {
    allocations,
    creditsApplied,
    onAccount: input.money
      .plus(sumOf(creditsApplied.map((credit) => credit.amount)))
      .minus(allocated),
  };
}

/** Why the server settled less than the phone planned. */
export enum MobileReceiptAdjustReason {
  /** The bill was no longer open (paid or cancelled since the phone's Sync): nothing posted on it. */
  BILL_SETTLED = 'BILL_SETTLED',
  /** The bill took less than planned (it owed less now, or a credit it was to get was spent). */
  BILL_REDUCED = 'BILL_REDUCED',
  /** The credit held less than planned (spent, cancelled), or the bills could not take it all. */
  CREDIT_REDUCED = 'CREDIT_REDUCED',
  /**
   * Reserved (D11): post-dated cheque money held on account under
   * accounts.pdc_posting_mode = ON_CLEARING. Never sent today: the desktop
   * refuses every receipt under ON_CLEARING (ACC_PDC_ALLOCATION).
   */
  PDC_ON_CLEARING = 'PDC_ON_CLEARING',
}

/** One change the server made to the phone's plan. Money as 2-decimal text. */
export interface MobileReceiptAdjusted {
  billId: string;
  billAccYear: string;
  docRefno: string;
  planned: string;
  applied: string;
  reason: MobileReceiptAdjustReason;
}

/** What a receipt settles now on one bill or credit, as numbers to compare with. */
export interface SettledFigure {
  amount: Prisma.Decimal;
  discount: Prisma.Decimal;
  roundoff: Prisma.Decimal;
}

/**
 * adjusted[]: the phone's plan against what the receipt settles now (read
 * back from the database), one row per bill or credit that got less. The same
 * function answers a fresh upload and a resend, so both carry the same rows.
 * `planned` and `applied` are the line's amount (money and credits; the
 * discount and round-off posted are in allocations[]). A bill that got nothing
 * at all is BILL_SETTLED, one that got less BILL_REDUCED (a smaller discount
 * or round-off counts too); a credit that applied less is CREDIT_REDUCED.
 */
export function adjustedAgainstPlan(
  plan: { lines: readonly PlanLine[]; credits: readonly PlanCredit[] },
  settled: {
    bills: ReadonlyMap<string, SettledFigure>;
    credits: ReadonlyMap<string, Prisma.Decimal>;
  },
  docRefnoOf: (key: string) => string,
): MobileReceiptAdjusted[] {
  const out: MobileReceiptAdjusted[] = [];
  for (const line of plan.lines) {
    const key = billKeyOf(line);
    const got = settled.bills.get(key) ?? { amount: ZERO, discount: ZERO, roundoff: ZERO };
    const lessMoney = got.amount.lessThan(line.amount);
    const lessReduction = got.discount
      .plus(got.roundoff)
      .lessThan(line.discount.plus(line.roundoff));
    if (!lessMoney && !lessReduction) {
      continue;
    }
    out.push({
      billId: line.billId,
      billAccYear: line.billAccYear.trim(),
      docRefno: docRefnoOf(key),
      planned: line.amount.toFixed(2),
      applied: got.amount.toFixed(2),
      reason: settles(got).isZero()
        ? MobileReceiptAdjustReason.BILL_SETTLED
        : MobileReceiptAdjustReason.BILL_REDUCED,
    });
  }
  for (const credit of plan.credits) {
    const key = billKeyOf(credit);
    const got = settled.credits.get(key) ?? ZERO;
    if (!got.lessThan(credit.amount)) {
      continue;
    }
    out.push({
      billId: credit.billId,
      billAccYear: credit.billAccYear.trim(),
      docRefno: docRefnoOf(key),
      planned: credit.amount.toFixed(2),
      applied: got.toFixed(2),
      reason: MobileReceiptAdjustReason.CREDIT_REDUCED,
    });
  }
  return out;
}
