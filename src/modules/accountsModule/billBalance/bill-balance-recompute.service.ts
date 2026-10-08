import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  appendTempCreditStatus,
  movementRemark,
  settlementEventOf,
} from '../../../common/txn-status-log/temp-credit-status';
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
  /**
   * Did this bill's stored figures actually MOVE?
   *
   * The recompute is idempotent, which is what makes it safe to call from the
   * posting path, from a cron and from a repair script without any of them
   * knowing about the others — but it also means "how many bills did I look at"
   * and "how many bills changed" are different questions, and only the second
   * one tells an operator whether a sweep did anything. `regularisePostDated`
   * reports on this rather than on the size of its batch.
   *
   * It is also what keeps a no-op sweep from touching the row: an UPDATE that
   * writes the figures a bill already has still bumps `abl_modified_on` and
   * still takes a row lock, and a nightly cron doing that to every bill holding
   * a matured cheque is a night of write traffic that changes nothing.
   */
  changed: boolean;
}

/** ck_abj_adj_type — the four that fold into abl_alloc_amount. */
const ALLOCATING_TYPES = ['ALLOCATION', 'ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER'];

/**
 * The two that fold into `abl_disc_amount`.
 *
 * ROUND_OFF is a distinct `abj_adj_type` — its leg is debited to the Round Off
 * ledger and a discount's to Discount Allowed, and the row has to say what the
 * leg says — but it shares this CACHE column rather than getting one of its
 * own.
 *
 * Why: `abl_pending_amount` and `abl_status` are GENERATED from
 * (bill − alloc − disc − writeoff), so a fourth bucket means dropping and
 * recreating both expressions on a LIST-partitioned table. That is a rewrite of
 * every partition to split a cache that nothing reads as "discounts" — every
 * consumer in this codebase adds `abl_disc_amount` to `abl_writeoff_amount` and
 * asks "how much of this bill is already accounted for". A round-off is.
 *
 * The exact split is always available from `acc_bill_adjustment.abj_adj_type`,
 * which is the authoritative record; this column is a running total.
 */
const DISCOUNTING_TYPES = ['DISCOUNT', 'ROUND_OFF'];

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class BillBalanceRecomputeService {
  private readonly logger = new Logger(BillBalanceRecomputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

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
        abjCreatedOn: true,
        abjVoucherId: true,
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
      } else if (DISCOUNTING_TYPES.includes(row.abjAdjType)) {
        bucket.disc = bucket.disc.plus(row.abjAmount);
      } else if (row.abjAdjType === 'WRITEOFF') {
        bucket.writeoff = bucket.writeoff.plus(row.abjAmount);
      }
      if (bucket.lastOn === null || row.abjAdjDate > bucket.lastOn) {
        bucket.lastOn = row.abjAdjDate;
      }
      // The LAST movement — by date, then by when it was written, and on a
      // tie the WRITEOFF (one receipt's money and write-off rows share a
      // timestamp, and the write-off is what closed the gap) — decides
      // WRITTEN_OFF (notes 90 C) and names the document in the trail's remark.
      const candidate = {
        on: row.abjAdjDate,
        createdOn: row.abjCreatedOn,
        type: row.abjAdjType,
        voucherId: row.abjVoucherId,
      };
      if (bucket.last === null || laterMovement(candidate, bucket.last)) {
        bucket.last = candidate;
      }
    }

    // The four cached columns come back as well as the bill amount: they are
    // what the freshly-derived figures are compared against, and without them
    // there is no way to tell a sweep that moved something from one that did
    // not.
    const stored = await client.accBillBalance.findMany({
      where: {
        OR: unique.map((bill) => ({ ablId: bill.billId, ablAccYear: bill.accYear })),
      },
      select: {
        ablId: true,
        ablAccYear: true,
        ablBillAmount: true,
        ablAllocAmount: true,
        ablDiscAmount: true,
        ablWriteoffAmount: true,
        ablSettledOn: true,
      },
    });

    const now = new Date();
    const results: RecomputedBill[] = [];
    // Notes 90 C: a bill whose LAST movement was a WRITEOFF and which nothing
    // is left on reads WRITTEN_OFF, not SETTLED — derived here, every time, so
    // a cancelled write-off reopens the credit instead of leaving it stuck.
    const writtenOff: BillKey[] = [];
    const lastVoucherOf = new Map<string, string | null>();

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

      const alloc = bucket.alloc.toDecimalPlaces(2);
      const disc = bucket.disc.toDecimalPlaces(2);
      const writeoff = bucket.writeoff.toDecimalPlaces(2);
      const changed =
        !bill.ablAllocAmount.equals(alloc) ||
        !bill.ablDiscAmount.equals(disc) ||
        !bill.ablWriteoffAmount.equals(writeoff) ||
        sameDay(bill.ablSettledOn, settledOn) === false;

      // Only when something moved. A no-op UPDATE writes the same figures back,
      // bumps abl_modified_on and takes a row lock for nothing — and on the
      // nightly sweep that is every bill that ever held a cheque.
      if (changed) {
        await client.accBillBalance.update({
          where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
          data: {
            ablAllocAmount: alloc,
            ablDiscAmount: disc,
            ablWriteoffAmount: writeoff,
            ablSettledOn: settledOn,
            ablModifiedOn: now,
          },
        });
      }

      if (pending.lessThanOrEqualTo(0) && bucket.last?.type === 'WRITEOFF') {
        writtenOff.push({ billId: bill.ablId, accYear: bill.ablAccYear });
      }
      lastVoucherOf.set(
        keyOf({ billId: bill.ablId, accYear: bill.ablAccYear }),
        bucket.last?.voucherId ?? null,
      );

      results.push({
        billId: bill.ablId,
        accYear: bill.ablAccYear,
        changed,
        billAmount: bill.ablBillAmount,
        allocAmount: alloc,
        discAmount: disc,
        writeoffAmount: writeoff,
        pendingAmount: pending,
        settledOn,
      });
    }

    // HANDOVER 2026-09-20 §7 (31): `acc_temp_credit.atc_balance_amount` is a
    // maintained copy of the bill row's pending figure, refreshed HERE — the
    // one place the pending figure moves — so a receipt against a temp-credit
    // bill settles the WHO row with it. Idempotent like everything above.
    if (unique.length > 0) {
      const keys = Prisma.join(
        unique.map((u) => Prisma.sql`(${u.billId}::uuid, ${u.accYear}::char(9))`),
      );
      const writtenOffKeys =
        writtenOff.length === 0
          ? Prisma.sql`false`
          : Prisma.sql`(t.atc_abl_id, t.atc_abl_acc_year) IN (${Prisma.join(
              writtenOff.map((u) => Prisma.sql`(${u.billId}::uuid, ${u.accYear}::char(9))`),
            )})`;
      // Notes 90 A: read before, update with RETURNING, and log only the rows
      // whose status really moved — a recompute that moves nothing logs nothing.
      const before = await client.$queryRaw<TempCreditStateRow[]>`
        SELECT atc_id, atc_acc_year, atc_status, atc_balance_amount, atc_company_id,
               atc_branch_id, atc_tenant_id, atc_bill_refno, atc_abl_id, atc_abl_acc_year
          FROM accounts.acc_temp_credit t
         WHERE t.atc_is_deleted = false
           AND (t.atc_abl_id, t.atc_abl_acc_year) IN (${keys})`;
      const after = await client.$queryRaw<
        {
          atc_id: string;
          atc_acc_year: string;
          atc_status: string;
          atc_balance_amount: Prisma.Decimal;
        }[]
      >`
        UPDATE accounts.acc_temp_credit t
           SET atc_balance_amount = LEAST(t.atc_credit_amount, GREATEST(0, b.abl_pending_amount)),
               atc_status = CASE
                              WHEN t.atc_status = 'CANCELLED' THEN 'CANCELLED'
                              WHEN b.abl_pending_amount <= 0 AND ${writtenOffKeys} THEN 'WRITTEN_OFF'
                              WHEN b.abl_pending_amount <= 0 THEN 'SETTLED'
                              WHEN b.abl_pending_amount < t.atc_credit_amount THEN 'PARTIAL'
                              ELSE 'OPEN' END,
               atc_settled_on = CASE WHEN b.abl_pending_amount <= 0 THEN COALESCE(t.atc_settled_on, ${asOfDate}::date) ELSE NULL END,
               atc_modified_on = ${now}
          FROM accounts.acc_bill_balance b
         WHERE b.abl_id = t.atc_abl_id AND b.abl_acc_year = t.atc_abl_acc_year
           AND t.atc_is_deleted = false
           AND (t.atc_abl_id, t.atc_abl_acc_year) IN (${keys})
        RETURNING t.atc_id, t.atc_acc_year, t.atc_status, t.atc_balance_amount`;
      await this.logTempCreditTransitions(client, before, after, lastVoucherOf, now);
    }

    return results;
  }

  /**
   * Notes 90 A — one `txn_status_log` step per temp credit whose status moved
   * in this recompute: PARTIAL, SETTLED, WRITTEN_OFF, or REOPENED when a
   * reversal gives the balance back. The remark says what moved and names the
   * voucher of the bill's last movement ("received 10.00 by RCT/0012, balance
   * 200.00"). `changedBy` is the request's user, or the default actor on the
   * nightly sweep.
   */
  private async logTempCreditTransitions(
    client: AccountsWriteClient,
    before: readonly TempCreditStateRow[],
    after: readonly {
      atc_id: string;
      atc_acc_year: string;
      atc_status: string;
      atc_balance_amount: Prisma.Decimal;
    }[],
    lastVoucherOf: ReadonlyMap<string, string | null>,
    now: Date,
  ): Promise<void> {
    const was = new Map(before.map((r) => [`${r.atc_id}|${r.atc_acc_year}`, r]));
    const moved = after
      .map((a) => ({ a, b: was.get(`${a.atc_id}|${a.atc_acc_year}`) }))
      .filter(
        (x): x is { a: (typeof after)[number]; b: TempCreditStateRow } =>
          x.b !== undefined && x.b.atc_status !== x.a.atc_status,
      );
    if (moved.length === 0) {
      return;
    }
    const voucherIds = [
      ...new Set(
        moved
          .map((x) =>
            lastVoucherOf.get(keyOf({ billId: x.b.atc_abl_id, accYear: x.b.atc_abl_acc_year })),
          )
          .filter((v): v is string => !!v),
      ),
    ];
    const refnos =
      voucherIds.length === 0
        ? []
        : await client.$queryRaw<{ avh_voucher_id: string; avh_voucher_refno: string | null }[]>`
            SELECT avh_voucher_id, avh_voucher_refno
              FROM accounts.acc_voucher_header
             WHERE avh_voucher_id = ANY(${voucherIds}::uuid[])`;
    const refnoOf = new Map(refnos.map((r) => [r.avh_voucher_id, r.avh_voucher_refno]));
    const changedBy = this.requestContext.getUserId() ?? '';
    const deviceId = this.requestContext.getDeviceId();

    for (const { a, b } of moved) {
      const voucherId = lastVoucherOf.get(
        keyOf({ billId: b.atc_abl_id, accYear: b.atc_abl_acc_year }),
      );
      await appendTempCreditStatus(client, {
        credit: {
          atcId: b.atc_id,
          accYear: b.atc_acc_year,
          companyId: b.atc_company_id,
          branchId: b.atc_branch_id,
          tenantId: b.atc_tenant_id,
          billRefno: b.atc_bill_refno,
        },
        event: settlementEventOf(a.atc_status, b.atc_status),
        fromStatus: b.atc_status,
        toStatus: a.atc_status,
        changedBy,
        changedOn: now,
        remarks: movementRemark(
          b.atc_balance_amount,
          a.atc_balance_amount,
          a.atc_status,
          voucherId ? (refnoOf.get(voucherId) ?? null) : null,
        ),
        deviceId,
      });
    }
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
    scope: RegulariseScope,
    asOf: Date = new Date(),
    batchSize = 500,
  ): Promise<RegulariseResult> {
    const asOfDate = startOfDayUtc(asOf);

    const due = await this.prisma.accBillAdjustment.findMany({
      where: {
        // R-B1 — the sweep is SCOPED. Without this the route regularised every
        // company in the database on one authenticated call: idempotent, so it
        // corrupted nothing, and still a write across a tenant boundary.
        abjCompanyId: scope.companyId,
        ...(scope.branchId ? { abjBranchId: scope.branchId } : {}),
        ...(scope.accYear ? { abjAccYear: scope.accYear } : {}),
        abjIsPostDated: true,
        abjIsDeleted: false,
        abjAdjDate: { lte: asOfDate },
      },
      select: { abjBillId: true, abjBillAccYear: true },
      distinct: ['abjBillId', 'abjBillAccYear'],
    });

    const bills = due.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear }));
    let examined = 0;
    let regularised = 0;

    for (let offset = 0; offset < bills.length; offset += batchSize) {
      const batch = bills.slice(offset, offset + batchSize);
      const moved = await this.prisma.$transaction(
        async (tx) => {
          const recomputed = await this.recomputeBills(tx, batch, asOfDate);
          return recomputed.filter((bill) => bill.changed).length;
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
      examined += batch.length;
      regularised += moved;
    }

    this.logger.log(
      `Regularised ${regularised} of ${examined} bill(s) holding matured post-dated ` +
        `settlements as at ${asOfDate.toISOString().slice(0, 10)}`,
    );

    return {
      asOf: asOfDate.toISOString().slice(0, 10),
      billsRegularised: regularised,
      billsExamined: examined,
    };
  }
}

/**
 * Who the sweep is run for.
 *
 * ── Why the company is required and the other two are not ────────────────
 * The company is a TENANT BOUNDARY: a sweep is a write, and no authenticated
 * caller has business writing another company's bills. It is not negotiable and
 * there is no "all companies" value.
 *
 * The branch and the year are FILTERS, and requiring them would be actively
 * wrong rather than merely strict — the same reason `/receipts/open-items`
 * takes neither:
 *
 *   · `acc_bill_balance` is partitioned by the year the bill ORIGINATED in and
 *     is never carried forward, so a sweep pinned to this year would walk past
 *     every bill raised before it — which, on 2 April, is nearly all of them.
 *
 *   · A bill raised at one branch is settled at another all the time, and
 *     outstanding is company-wide by construction (`ux_abl_doc_refno` carries
 *     no branch column). Pinning the sweep to a branch would leave a matured
 *     cheque uncounted because it was collected on a different beat.
 *
 * So both narrow the sweep when the caller means to narrow it, and the default
 * — the whole company — is the one a nightly cron wants.
 */
export interface RegulariseScope {
  companyId: string;
  branchId?: string | null;
  accYear?: string | null;
}

export interface RegulariseResult {
  asOf: string;
  /**
   * Bills whose stored figures actually MOVED. This is the number that answers
   * "did the run do anything", and it is 0 on a second run over the same data.
   */
  billsRegularised: number;
  /**
   * Bills the sweep looked at — every bill holding a matured post-dated row in
   * scope, whether or not it needed changing. Reported beside the first figure
   * so a 0 reads as "nothing left to do" rather than as "nothing was checked".
   */
  billsExamined: number;
}

interface Totals {
  alloc: Prisma.Decimal;
  disc: Prisma.Decimal;
  writeoff: Prisma.Decimal;
  lastOn: Date | null;
  /** The last movement that counted — by date, then by when it was written. */
  last: { on: Date; createdOn: Date; type: string; voucherId: string | null } | null;
}

interface TempCreditStateRow {
  atc_id: string;
  atc_acc_year: string;
  atc_status: string;
  atc_balance_amount: Prisma.Decimal;
  atc_company_id: string;
  atc_branch_id: string;
  atc_tenant_id: string | null;
  atc_bill_refno: string | null;
  atc_abl_id: string;
  atc_abl_acc_year: string;
}

function emptyTotals(): Totals {
  return { alloc: ZERO, disc: ZERO, writeoff: ZERO, lastOn: null, last: null };
}

type Movement = NonNullable<Totals['last']>;

/** Is `a` the later movement — by date, then by when it was written, then WRITEOFF first on a tie. */
function laterMovement(a: Movement, b: Movement): boolean {
  if (a.on.getTime() !== b.on.getTime()) {
    return a.on > b.on;
  }
  if (a.createdOn.getTime() !== b.createdOn.getTime()) {
    return a.createdOn > b.createdOn;
  }
  return a.type === 'WRITEOFF' && b.type !== 'WRITEOFF';
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
 * Two nullable dates, compared as dates. `abl_settled_on` is a `date` column, so
 * `===` on the two `Date` objects Prisma hands back is always false and would
 * report every bill as changed on every sweep.
 */
function sameDay(left: Date | null, right: Date | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return startOfDayUtc(left).getTime() === startOfDayUtc(right).getTime();
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
