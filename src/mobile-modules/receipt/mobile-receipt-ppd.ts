import { Prisma } from '@prisma/client';
import { suggestPpdDiscount, type PpdSlab } from '../../modules/accountsModule/receipt/ppd-slab';

/** One step of a bill's prompt-payment discount, for a receipt dated up to tillDate. */
export interface MobilePpdStep {
  /** YYYY-MM-DD: the last receipt date this step applies to (the bill date + the slab's days). */
  tillDate: string;
  /** The percentage of what is pending, 3 decimals as text. */
  perc: string;
  /** What that percentage of today's pending comes to, 2 decimals as text (the D4 ceiling). */
  amount: string;
}

const DAY_MS = 86_400_000;

/**
 * GET /mobile/receipts/open-bills `ppdSchedule`: the prompt-payment discount
 * steps of one bill still ahead of `onDate`, so the phone can pick the one for
 * its own receipt date offline. The rule for the phone: the FIRST step whose
 * tillDate is on or after the receipt date; none = no discount.
 *
 * Built from ppd-slab.ts itself, so it cannot disagree with it: each slab
 * ends a step on (bill date + its days), and the step's figure is exactly
 * what suggestPpdDiscount answers for a receipt dated that day (the best
 * percentage among the slabs the bill still qualifies for). Steps whose
 * percentage the next step repeats are folded into it. Empty when there are
 * no slabs or nothing is pending.
 */
export function ppdScheduleOf(params: {
  docDate: Date;
  onDate: Date;
  pendingAmount: Prisma.Decimal;
  slabs: readonly PpdSlab[];
}): MobilePpdStep[] {
  const { docDate, onDate, pendingAmount, slabs } = params;
  if (slabs.length === 0 || pendingAmount.lessThanOrEqualTo(0)) {
    return [];
  }
  const days = [...new Set(slabs.map((slab) => slab.days))].sort((a, b) => a - b);
  const steps = days
    .map((day) => {
      const tillDate = new Date(docDate.getTime() + day * DAY_MS);
      const best = Math.max(...slabs.filter((slab) => slab.days >= day).map((slab) => slab.perc));
      return {
        tillDate,
        perc: best,
        amount: suggestPpdDiscount({ docDate, onDate: tillDate, pendingAmount, slabs }),
      };
    })
    .filter((step) => step.tillDate.getTime() >= onDate.getTime());
  return steps
    .filter((step, index) => index === steps.length - 1 || steps[index + 1].perc !== step.perc)
    .map((step) => ({
      tillDate: step.tillDate.toISOString().slice(0, 10),
      perc: new Prisma.Decimal(step.perc).toFixed(3),
      amount: step.amount.toFixed(2),
    }));
}
