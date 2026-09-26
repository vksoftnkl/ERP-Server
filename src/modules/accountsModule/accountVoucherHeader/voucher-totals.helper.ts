import { Prisma } from '@prisma/client';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';

/**
 * What a voucher's legs come to — a READ.
 *
 * ── Who writes the columns ───────────────────────────────────────────────
 * `accounts.tr_av_refresh_totals`, the trigger migration 20260915120000 adds
 * for the plan's §2.4. `avh_total_debit` / `avh_total_credit` are DERIVED, and
 * nothing in the application may write them.
 *
 * That is not the tidier of two options, it is the only correct one.
 * `ck_avh_balanced` is
 *
 *     CHECK (avh_voucher_status <> 'POSTED' OR avh_total_debit = avh_total_credit)
 *
 * so while the columns are stamped by whoever writes the header, the constraint
 * compares a writer's own two numbers with each other and cannot fail. It has
 * to hold for EVERY writer of `acc_vouchers` — the payment voucher, the
 * journal, the contra, every accounts screen after this one — and a TypeScript
 * helper only protects the callers that remember to call it. A trigger protects
 * the table.
 *
 * ── So what is this for ──────────────────────────────────────────────────
 * A legible failure. A posting service calls it just before it flips a header
 * to POSTED, and refuses with "rct00018 is out by 1000.00 (debit 25200.00,
 * credit 24200.00)" instead of letting the constraint answer with a 23514 that
 * names no voucher and no amount. The trigger is what makes the figures true;
 * this is what makes the failure readable.
 *
 * It re-derives from the LEGS rather than reading the header, so it is also the
 * check on the trigger itself: if the two ever disagreed, this is what would
 * notice.
 */

const ZERO = new Prisma.Decimal(0);

export interface VoucherTotals {
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  /** Debit − credit. Zero on a voucher that may be posted. */
  difference: Prisma.Decimal;
}

export async function deriveVoucherTotals(
  client: AccountsWriteClient,
  voucherId: string,
  accYear: string,
): Promise<VoucherTotals> {
  const legs = await client.accVoucher.findMany({
    where: { avVoucherId: voucherId, avAccYear: accYear, avIsDeleted: false },
    select: { avDrCr: true, avAmount: true },
  });

  let totalDebit = ZERO;
  let totalCredit = ZERO;
  for (const leg of legs) {
    if (leg.avDrCr === 'DR') {
      totalDebit = totalDebit.plus(leg.avAmount);
    } else {
      totalCredit = totalCredit.plus(leg.avAmount);
    }
  }
  totalDebit = totalDebit.toDecimalPlaces(2);
  totalCredit = totalCredit.toDecimalPlaces(2);

  return { totalDebit, totalCredit, difference: totalDebit.minus(totalCredit) };
}
