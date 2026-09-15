import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';

/**
 * `accounts.fn_abl_recompute` and `accounts.fn_abl_regularise_pdc`, in
 * TypeScript — the receipt plan's §2.1, written as a service instead of as a
 * trigger because that is what this project asked for.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT IT DOES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `accounts.acc_bill_balance` carries four columns that are not facts of their
 * own — they are sums over `accounts.acc_bill_adjustment`:
 *
 *     abl_alloc_amount     Σ ALLOCATION | ADVANCE_ADJUST | NOTE_ADJUST | TRANSFER
 *     abl_disc_amount      Σ DISCOUNT
 *     abl_writeoff_amount  Σ WRITEOFF
 *     abl_settled_on       the last adjustment date, once nothing is left
 *
 * and two more that Postgres derives from those — `abl_pending_amount` and
 * `abl_status` are GENERATED columns and are never written by anything.
 *
 * This service is the ONLY thing that may write the first four. §12: "no writes
 * to abl_alloc/_disc/_writeoff — the recompute owns them."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE POST-DATED RULE, WHICH IS THE WHOLE POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A row with `abj_is_post_dated` and `abj_adj_date` in the future is NOT
 * counted. That single exclusion is what makes R2 work: a post-dated cheque
 * posts its voucher and its adjustment rows TODAY, and the bill nevertheless
 * stays open until the cheque matures. Nothing has to be re-posted on the day;
 * the row was always there, it simply started counting.
 *
 * Which means a bill's pending amount is a function of the DATE, and a bill
 * whose only cheque matures tomorrow becomes closed at midnight with no writer
 * involved. `regularisePostDated` is what makes that visible in the stored
 * columns — Tally calls the same operation "Regularised".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE COST OF NOT BEING A TRIGGER, STATED PLAINLY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A trigger cannot be forgotten. This can. Every writer of
 * `acc_bill_adjustment` must call `recomputeBills` in the same transaction,
 * with the bills it touched, AFTER writing the rows — and a writer that forgets
 * leaves a bill reporting a pending amount it does not have. There is no
 * database-level backstop.
 *
 * What is gained: the recompute is one round-trip for a whole receipt instead
 * of one per row (a receipt touching 40 bills fired the trigger 40+ times), it
 * runs inside the same transaction and the same snapshot as the rows it is
 * summing, and a failure surfaces as an application error with a bill name in
 * it rather than as an opaque 500 from inside plpgsql.
 */

/** A bill is addressed by the pair, because the table is partitioned on the year. */
export interface BillKey {
  billId: string;
  accYear: string;
}

/** What one recompute changed, for a caller that wants to report it. */
export interface RecomputedBill extends BillKey {
  billAmount: Prisma.Decimal;
  allocAmount: Prisma.Decimal;
  discAmount: Prisma.Decimal;
  writeoffAmount: Prisma.Decimal;
  pendingAmount: Prisma.Decimal;
  settledOn: Date | null;
}

/** ck_abj_adj_type — the four that fold into abl_alloc_amount. */
const ALLOCATING_TYPES = ['ALLOCATION', 'ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER'];

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class BillBalanceRecomputeService {
  private readonly logger = new Logger(BillBalanceRecomputeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Re-derive the cached totals of every named bill.
   *
   * Takes the CALLER's client so it runs inside the posting transaction: the
   * rows it sums and the rows that caused the sum to change must commit or roll
   * back together, or a rolled-back receipt leaves a bill that believes it was
   * paid.
   *
   * `asOf` is the date the post-dated rule is evaluated against — today for a
   * live post, an explicit date when back-filling a day that was missed.
   *
   * Idempotent. Running it twice writes the same figures, which is what makes
   * it safe to call from a cron, from a repair script and from the posting path
   * without any of them having to know about the others.
   */
  async recomputeBills(
    client: AccountsWriteClient,
    bills: readonly BillKey[],
    asOf: Date = new Date(),
  ): Promise<RecomputedBill[]> {
    const unique = dedupe(bills);
    if (unique.length === 0) {
      return [];
    }

    const asOfDate = startOfDayUtc(asOf);

    // One read for every bill's rows, then the arithmetic in TypeScript. The
    // alternative — a GROUP BY with a FILTER per column — is one statement, but
    // it has to be raw SQL over a partitioned table with a composite key, and
    // this shape is what the module's tests can reason about.
    const adjustments = await client.accBillAdjustment.findMany({
      where: {
        abjIsDeleted: false,
        OR: unique.map((bill) => ({
          abjBillId: bill.billId,
          abjBillAccYear: bill.accYear,
        })),
      },
      select: {
        abjBillId: true,
        abjBillAccYear: true,
        abjAdjType: true,
        abjAmount: true,
        abjAdjDate: true,
        abjIsPostDated: true,
      },
    });

    const totals = new Map<string, Totals>();
    for (const bill of unique) {
      totals.set(keyOf(bill), emptyTotals());
    }

    for (const row of adjustments) {
      // §2.1: a post-dated cheque settles on maturity, not at post. Until its
      // date arrives the row exists, is visible, and counts for nothing.
      if (row.abjIsPostDated && startOfDayUtc(row.abjAdjDate) > asOfDate) {
        continue;
      }
      const bucket = totals.get(keyOf({ billId: row.abjBillId, accYear: row.abjBillAccYear }));
      if (!bucket) {
        continue;
      }
      if (ALLOCATING_TYPES.includes(row.abjAdjType)) {
        bucket.alloc = bucket.alloc.plus(row.abjAmount);
      } else if (row.abjAdjType === 'DISCOUNT') {
        bucket.disc = bucket.disc.plus(row.abjAmount);
      } else if (row.abjAdjType === 'WRITEOFF') {
        bucket.writeoff = bucket.writeoff.plus(row.abjAmount);
      }
      if (bucket.lastOn === null || row.abjAdjDate > bucket.lastOn) {
        bucket.lastOn = row.abjAdjDate;
      }
    }

    const stored = await client.accBillBalance.findMany({
      where: {
        OR: unique.map((bill) => ({ ablId: bill.billId, ablAccYear: bill.accYear })),
      },
      select: { ablId: true, ablAccYear: true, ablBillAmount: true },
    });

    const now = new Date();
    const results: RecomputedBill[] = [];

    for (const bill of stored) {
      const bucket = totals.get(keyOf({ billId: bill.ablId, accYear: bill.ablAccYear }));
      if (!bucket) {
        continue;
      }
      const settled = bucket.alloc.plus(bucket.disc).plus(bucket.writeoff).toDecimalPlaces(2);
      const pending = bill.ablBillAmount.minus(settled).toDecimalPlaces(2);
      // Closed is "nothing left", and the date it closed is the last adjustment
      // that counted. A bill re-opened by a cancellation loses the date again,
      // which is why this is recomputed rather than stamped once.
      const settledOn = pending.lessThanOrEqualTo(0) ? bucket.lastOn : null;

      await client.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
        data: {
          ablAllocAmount: bucket.alloc.toDecimalPlaces(2),
          ablDiscAmount: bucket.disc.toDecimalPlaces(2),
          ablWriteoffAmount: bucket.writeoff.toDecimalPlaces(2),
          ablSettledOn: settledOn,
          ablModifiedOn: now,
        },
      });

      results.push({
        billId: bill.ablId,
        accYear: bill.ablAccYear,
        billAmount: bill.ablBillAmount,
        allocAmount: bucket.alloc.toDecimalPlaces(2),
        discAmount: bucket.disc.toDecimalPlaces(2),
        writeoffAmount: bucket.writeoff.toDecimalPlaces(2),
        pendingAmount: pending,
        settledOn,
      });
    }

    return results;
  }

  /**
   * Tally's "Regularised": every bill holding a post-dated row that has now
   * matured, brought up to date.
   *
   * Run it from cron just after midnight, and `/receipts/post` runs it for a
   * cheque dated today or earlier so nothing waits for the next day.
   *
   * ── Why `<=` and not `=` ─────────────────────────────────────────────────
   * The plan's SQL matched `abj_adj_date = p_on`, which works only if the job
   * ran every single day. It does not survive a weekend outage: the cheques
   * that matured while the server was down are never looked at again, and their
   * bills stay open forever. Matching everything up to the date makes the job
   * self-healing — a run after three days off repairs all three — and costs
   * nothing, because the recompute is idempotent and the rows it re-reads for
   * already-regularised bills produce the figures they already have.
   *
   * Runs in its OWN transaction, one batch at a time, rather than in the
   * caller's: it is a maintenance sweep over rows nobody is holding, and
   * wrapping thousands of bills in a single transaction would hold locks all
   * night for no gain.
   */
  async regularisePostDated(
    asOf: Date = new Date(),
    batchSize = 500,
  ): Promise<{ asOf: string; billsRegularised: number }> {
    const asOfDate = startOfDayUtc(asOf);

    const due = await this.prisma.accBillAdjustment.findMany({
      where: {
        abjIsPostDated: true,
        abjIsDeleted: false,
        abjAdjDate: { lte: asOfDate },
      },
      select: { abjBillId: true, abjBillAccYear: true },
      distinct: ['abjBillId', 'abjBillAccYear'],
    });

    const bills = due.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear }));
    let count = 0;

    for (let offset = 0; offset < bills.length; offset += batchSize) {
      const batch = bills.slice(offset, offset + batchSize);
      await this.prisma.$transaction(
        async (tx) => {
          await this.recomputeBills(tx, batch, asOfDate);
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
      count += batch.length;
    }

    this.logger.log(
      `Regularised ${count} bill(s) holding matured post-dated settlements as at ${asOfDate
        .toISOString()
        .slice(0, 10)}`,
    );

    return { asOf: asOfDate.toISOString().slice(0, 10), billsRegularised: count };
  }
}

interface Totals {
  alloc: Prisma.Decimal;
  disc: Prisma.Decimal;
  writeoff: Prisma.Decimal;
  lastOn: Date | null;
}

function emptyTotals(): Totals {
  return { alloc: ZERO, disc: ZERO, writeoff: ZERO, lastOn: null };
}

function keyOf(bill: BillKey): string {
  return `${bill.billId}|${bill.accYear}`;
}

function dedupe(bills: readonly BillKey[]): BillKey[] {
  const seen = new Map<string, BillKey>();
  for (const bill of bills) {
    seen.set(keyOf(bill), bill);
  }
  return [...seen.values()];
}

/**
 * `abj_adj_date` is a `date`, which Prisma hands back as midnight UTC. Comparing
 * it against a timestamp would make "matures today" true only before 00:00,
 * which is never.
 */
function startOfDayUtc(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}
