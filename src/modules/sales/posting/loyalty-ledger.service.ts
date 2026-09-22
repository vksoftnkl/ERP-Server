import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SALES_ERROR_CODES } from './types/posting.types';
import { throwSalesInvalid, throwSalesRefused } from './sales.errors';
import type {
  LoyaltyBillSource,
  LoyaltyConsumeOptions,
  LoyaltyConsumeType,
  LoyaltyEarnResult,
  LoyaltyLedgerRowInput,
  LoyaltyLot,
  LoyaltyLotKey,
  LoyaltyPreview,
  LoyaltyScheme,
  LoyaltySrcDocType,
} from './types/loyalty.types';

/**
 * §3.4 — every movement of every wallet, and the only code that may write one.
 *
 * ══ THE RULE THAT REPLACES THE TRIGGER (§3.4b) ═════════════════════════════
 *
 * `writeLedgerRows` below is THE ONLY method in this codebase that inserts,
 * updates or soft-deletes `sales.loyalty_ledger`. The same for
 * `writeCouponTxnRows` and `loyalty_coupon_txn`. Nine write paths reach this
 * ledger — earn, consume, cancel reversal, return claw-back, expiry, gift,
 * adjust, transfer, opening — and a trigger could not be forgotten by any of
 * them, but a service call can. So there is one funnel, it recomputes before
 * it returns, and `test/sales/loyalty/no-outside-writer.spec.ts` asserts that
 * no other file writes these tables.
 *
 * ══ WHY THE DATABASE HOLDS NO FUNCTION FOR ANY OF THIS ═════════════════════
 *
 * The till runs OFFLINE and pushes to the cloud on reconnect. A trigger fires
 * on the SERVER during that push, on rows written hours earlier, in a language
 * nobody here debugs, per statement of a sync batch — so a failure names the
 * batch and not the row — and whether or not the service wanted it, so the
 * push cannot stage and correct data before it lands. It also forks from the
 * TypeScript that has to do the same sums for the offline client, which is
 * exactly the divergence that already happened to the stock posting engine.
 *
 * ══ ONE CORRECTION TO §3.4c, AND IT IS DELIBERATE ══════════════════════════
 *
 * `plan-backend-sales.md` §3.4c ends "Reads stay in the database —
 * `fn_loyalty_lots`, `fn_loyalty_redeemable`, `fn_loyalty_balance`". That
 * paragraph is stale. `README.md` says those three moved to NestJS,
 * `offline-sync-invariants.md` §4 says "the reads went with it (§3.4c)", and
 * schema `sales` on the live database holds ZERO functions — nor do
 * `tr_lld_refresh`, `fn_lcp_recompute`, `tr_lct_refresh_coupon` or
 * `ck_lmb_balance` exist, all of which the same paragraph leans on. The
 * ALGORITHMS in §3.4c stand exactly as written and are implemented here
 * unchanged; only their placement was out of date.
 *
 * ══ THE TWO GENERATED COLUMNS ══════════════════════════════════════════════
 *
 * `lmb_balance_points` and `lld_lot_balance` are GENERATED ALWAYS. Postgres
 * fills them from plain columns THIS SERVICE writes, so the recomputes are not
 * housekeeping — leave the inputs at zero and every wallet reads zero and the
 * feature simply does not work. They may never be written: a sync push that
 * sends whole rows must leave them out of the column list.
 */
@Injectable()
export class LoyaltyLedgerService {
  private readonly logger = new Logger(LoyaltyLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §3.4b — THE ONE WRITER. Nothing else in this file INSERTs the ledger.
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Write ledger rows, then recompute the lots they touched, then the members.
   *
   * Private on purpose, and it must stay private: every public method below
   * funnels through it precisely so that no caller can write a row and forget
   * the recompute. The order — lots, THEN members — is load-bearing:
   * `lmb_next_expiry_on` is a MIN over `lld_lot_balance`, so a member re-summed
   * before its lots publishes the wrong next-expiry date and nothing complains.
   */
  private async writeLedgerRows(
    tx: Prisma.TransactionClient,
    rows: LoyaltyLedgerRowInput[],
  ): Promise<{ id: string; accYear: string }[]> {
    if (rows.length === 0) {
      return [];
    }

    const values = rows.map(
      (r) => Prisma.sql`(
        ${r.compId}::uuid, ${r.branchId}::uuid, ${r.tenantId ?? null}::uuid,
        ${r.accYear}::char(9), ${r.memberId}::uuid, ${r.custId}::uuid,
        ${r.lscId ?? null}::uuid, ${r.lssId ?? null}::uuid, ${r.lsiId ?? null}::uuid,
        ${r.txnType}, ${r.rowNo}::int, ${dec(r.points, 4)}::numeric,
        ${r.txnDate}::date, ${r.txnTime ?? null}::time,
        ${r.lotId ?? null}::uuid, ${r.lotAccYear ?? null}::char(9),
        ${r.expiresOn ?? null}::date, ${r.activeFrom ?? null}::date,
        ${r.srcModule ?? null}, ${r.srcDocType ?? null}, ${r.srcDocId ?? null}::uuid,
        ${r.srcAccYear ?? null}::char(9), ${r.srcDocRefno ?? null},
        ${r.srcRowNo ?? null}::int,
        ${dec(r.baseAmount ?? 0, 2)}::numeric, ${dec(r.baseQty ?? 0, 4)}::numeric,
        ${dec(r.rate ?? 0, 4)}::numeric, ${dec(r.factor ?? 1, 4)}::numeric,
        ${dec(r.moneyValue ?? 0, 2)}::numeric,
        ${r.tenderId ?? null}::uuid, ${r.tenderAccYear ?? null}::char(9),
        ${r.reversalOfId ?? null}::uuid, ${r.reversalOfAccYear ?? null}::char(9),
        ${r.reversalReason ?? null},
        ${r.approvedBy ?? null}::uuid, ${r.userId ?? null}::uuid,
        ${r.sessionId ?? null}::uuid, ${r.deviceId ?? null}::uuid,
        ${r.remarks ?? null}, ${r.createdBy ?? 'SYSTEM'}
      )`,
    );

    const written = await tx.$queryRaw<{ lld_id: string; lld_acc_year: string }[]>`
      INSERT INTO sales.loyalty_ledger (
        lld_comp_id, lld_branch_id, lld_tenant_id,
        lld_acc_year, lld_member_id, lld_cust_id,
        lld_lsc_id, lld_lss_id, lld_lsi_id,
        lld_txn_type, lld_row_no, lld_points,
        lld_txn_date, lld_txn_time,
        lld_lot_id, lld_lot_acc_year,
        lld_expires_on, lld_active_from,
        lld_src_module, lld_src_doc_type, lld_src_doc_id,
        lld_src_acc_year, lld_src_doc_refno,
        lld_src_row_no,
        lld_base_amount, lld_base_qty,
        lld_rate, lld_factor,
        lld_money_value,
        lld_tender_id, lld_tender_acc_year,
        lld_reversal_of_id, lld_reversal_of_acc_year,
        lld_reversal_reason,
        lld_approved_by, lld_user_id,
        lld_session_id, lld_device_id,
        lld_remarks, lld_created_by
      )
      VALUES ${Prisma.join(values)}
      RETURNING lld_id, lld_acc_year`;

    // The lots these rows DREW ON. A new EARN row creates a lot and draws on
    // none, and its lld_consumed_points is 0 by column default, so it needs no
    // recompute of its own.
    const lots = new Map<string, LoyaltyLotKey>();
    const touch = (lotId: string, lotAccYear: string): void => {
      lots.set(`${lotId}|${lotAccYear}`, { lotId, lotAccYear });
    };
    for (const r of rows) {
      if (r.lotId && r.lotAccYear) {
        touch(r.lotId, r.lotAccYear);
      }
      // A reversal of an EARN / OPENING row retires THAT LOT, and it cannot
      // say so through lld_lot_id because ck_lld_lot_required forbids a lot on
      // those types. See the note on recomputeLots.
      if (
        r.reversalOfId &&
        r.reversalOfAccYear &&
        (r.txnType === 'EARN' || r.txnType === 'OPENING')
      ) {
        touch(r.reversalOfId, r.reversalOfAccYear);
      }
    }
    await this.recomputeLots(tx, [...lots.values()]);
    await this.recomputeMembers(tx, [...new Set(rows.map((r) => r.memberId))]);

    return written.map((w) => ({ id: w.lld_id, accYear: w.lld_acc_year }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §3.4a — balance maintenance. Recompute, never increment.
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * `lld_consumed_points` for each named lot — one UPDATE for the whole set,
   * because a sync push is many rows at once.
   *
   * Consuming rows are negative and their reversals positive, so the NEGATED
   * sum is what has been drawn. Never special-case a reversal: a reversal is a
   * row of the same type with the opposite sign, and a plain sum nets it.
   *
   * ── The second clause, and why it is not in the written contract ───────
   *
   * `13`'s contract block sums rows by `lld_lot_id` alone. That is not enough
   * to retire a lot when a bill is CANCELLED: `ck_lld_lot_required` forbids an
   * EARN row from carrying `lld_lot_id`, so the reversal of an EARN can only
   * name its lot through `lld_reversal_of_id`. Summing by that column too is
   * what stops a cancelled bill's points from staying spendable while the
   * wallet total has already dropped — i.e. it keeps `redeemable()` from
   * exceeding `balance()`. It changes nothing anywhere else, because
   * `lld_reversal_of_id` is NULL on every row that is not a reversal.
   */
  private async recomputeLots(tx: Prisma.TransactionClient, lots: LoyaltyLotKey[]): Promise<void> {
    if (lots.length === 0) {
      return;
    }
    const ids = lots.map((l) => l.lotId);
    const years = lots.map((l) => l.lotAccYear);

    await tx.$executeRaw`
      UPDATE sales.loyalty_ledger l
         SET lld_consumed_points = COALESCE(s.consumed, 0)
        FROM unnest(${ids}::uuid[], ${years}::text[]) AS k(lot_id, lot_year)
        LEFT JOIN LATERAL (
              SELECT -SUM(c.lld_points) AS consumed
                FROM sales.loyalty_ledger c
               WHERE c.lld_is_deleted = false
                 AND ((c.lld_lot_id       = k.lot_id
                   AND c.lld_lot_acc_year = k.lot_year::char(9))
                   OR c.lld_reversal_of_id = k.lot_id)
             ) s ON true
       WHERE l.lld_id       = k.lot_id
         AND l.lld_acc_year = k.lot_year::char(9)`;
  }

  /**
   * The wallet caches for each named member — again one UPDATE for the set.
   *
   * The driving set is `unnest(ids)` and the aggregate is a LEFT JOIN LATERAL,
   * NOT a `GROUP BY` over the ledger. That is the whole point: a member whose
   * every row was deleted must be ZEROED, and a GROUP BY returns no row for it
   * — the one way this recompute can silently leave a stale wallet behind.
   */
  private async recomputeMembers(tx: Prisma.TransactionClient, memberIds: string[]): Promise<void> {
    const ids = [...new Set(memberIds)].filter(Boolean);
    if (ids.length === 0) {
      return;
    }

    await tx.$executeRaw`
      UPDATE sales.loyalty_member m
         SET lmb_earned_points     = COALESCE(s.earned, 0),
             lmb_redeemed_points   = COALESCE(s.redeemed, 0),
             lmb_expired_points    = COALESCE(s.expired, 0),
             lmb_gift_points       = COALESCE(s.gifted, 0),
             lmb_adjusted_points   = COALESCE(s.adjusted, 0),
             lmb_lifetime_bill_amt = COALESCE(s.bill_amt, 0),
             lmb_lifetime_bill_cnt = COALESCE(s.bill_cnt, 0),
             lmb_last_earn_on      = s.last_earn_on,
             lmb_last_redeem_on    = s.last_redeem_on,
             lmb_last_activity_on  = s.last_activity_on,
             lmb_next_expiry_on    = s.next_expiry_on,
             lmb_modified_on       = now()
        FROM unnest(${ids}::uuid[]) AS k(member_id)
        LEFT JOIN LATERAL (
              SELECT
                -- A reversal is the SAME type with the opposite sign, so each
                -- of these plain sums already nets its own reversals.
                SUM(l.lld_points) FILTER (WHERE l.lld_txn_type IN ('EARN','OPENING'))     AS earned,
               -SUM(l.lld_points) FILTER (WHERE l.lld_txn_type = 'REDEEM')                AS redeemed,
               -SUM(l.lld_points) FILTER (WHERE l.lld_txn_type = 'EXPIRE')                AS expired,
               -SUM(l.lld_points) FILTER (WHERE l.lld_txn_type = 'GIFT')                  AS gifted,
                SUM(l.lld_points) FILTER (WHERE l.lld_txn_type IN ('ADJUST','TRANSFER'))  AS adjusted,
                SUM(l.lld_base_amount) FILTER (
                      WHERE l.lld_txn_type = 'EARN' AND l.lld_src_doc_id IS NOT NULL)     AS bill_amt,
                COUNT(DISTINCT l.lld_src_doc_id) FILTER (
                      WHERE l.lld_txn_type = 'EARN' AND l.lld_src_doc_id IS NOT NULL)     AS bill_cnt,
                MAX(l.lld_txn_date) FILTER (WHERE l.lld_txn_type = 'EARN')                AS last_earn_on,
                MAX(l.lld_txn_date) FILTER (WHERE l.lld_txn_type IN ('REDEEM','GIFT'))    AS last_redeem_on,
                MAX(l.lld_txn_date)                                                       AS last_activity_on,
                MIN(l.lld_expires_on) FILTER (
                      WHERE l.lld_txn_type = 'EARN'
                        AND l.lld_lot_balance > 0
                        AND l.lld_expires_on IS NOT NULL)                                 AS next_expiry_on
                FROM sales.loyalty_ledger l
               WHERE l.lld_member_id = k.member_id
                 AND l.lld_is_deleted = false
             ) s ON true
       WHERE m.lmb_id = k.member_id`;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §3.4c — the reads. ONE definition of FIFO order, shared by everything.
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The spendable lots, in the ONE order the whole product agrees on.
   *
   *   oldest expiry first → within one expiry date, oldest earned first →
   *   lots that never expire last of all
   *
   * That is the CUSTOMER-FAVOURABLE order: it spends what would otherwise
   * lapse. `consume()`, the till and the expiry job all call this and none of
   * them re-implements the ORDER BY — which is the only reason they cannot
   * disagree about which lot paid.
   *
   * NOTE on `lld_txn_type = 'EARN'`: OPENING rows also create lots and count
   * towards `lmb_earned_points`, but §3.4c, 13's contract block and the expiry
   * sweep all name EARN alone, so EARN alone is what this filters on. If
   * opening balances are ever loaded, that decision has to be revisited in all
   * three places at once rather than quietly widened here.
   */
  async lots(
    memberId: string,
    onDate: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LoyaltyLot[]> {
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<
      {
        lld_id: string;
        lld_acc_year: string;
        lld_lot_balance: Prisma.Decimal | null;
        lld_expires_on: Date | null;
        lld_active_from: Date | null;
        lld_txn_date: Date;
        lld_lsc_id: string | null;
        lld_branch_id: string;
      }[]
    >`
      SELECT lld_id, lld_acc_year, lld_lot_balance, lld_expires_on,
             lld_active_from, lld_txn_date, lld_lsc_id, lld_branch_id
        FROM sales.loyalty_ledger
       WHERE lld_member_id  = ${memberId}::uuid
         AND lld_txn_type   = 'EARN'
         AND lld_is_deleted = false
         AND lld_lot_balance > 0
         AND (lld_active_from IS NULL OR lld_active_from <= ${onDate}::date)
         AND (lld_expires_on  IS NULL OR lld_expires_on  >= ${onDate}::date)
       -- This ORDER BY is the product's single opinion about FIFO. Do not
       -- reorder it, and do not copy it anywhere else.
       ORDER BY lld_expires_on NULLS LAST, lld_txn_date, lld_id`;

    return rows.map((r) => ({
      lotId: r.lld_id,
      lotAccYear: r.lld_acc_year,
      lotBalance: Number(r.lld_lot_balance ?? 0),
      expiresOn: dateStr(r.lld_expires_on),
      activeFrom: dateStr(r.lld_active_from),
      txnDate: dateStr(r.lld_txn_date) as string,
      lscId: r.lld_lsc_id,
      branchId: r.lld_branch_id,
    }));
  }

  /**
   * What may be spent TODAY — the sum over exactly the lots above.
   *
   * This is NOT `lmb_balance_points`, which also counts lots still inside
   * their cooling period and lots already lapsed but not yet swept. Redeem
   * against `redeemable()`; DISPLAY `balance()`.
   */
  async redeemable(
    memberId: string,
    onDate: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<{ total: Prisma.Decimal | null }[]>`
      SELECT SUM(lld_lot_balance) AS total
        FROM sales.loyalty_ledger
       WHERE lld_member_id  = ${memberId}::uuid
         AND lld_txn_type   = 'EARN'
         AND lld_is_deleted = false
         AND lld_lot_balance > 0
         AND (lld_active_from IS NULL OR lld_active_from <= ${onDate}::date)
         AND (lld_expires_on  IS NULL OR lld_expires_on  >= ${onDate}::date)`;
    return Number(rows[0]?.total ?? 0);
  }

  /** What the customer HOLDS — the wallet's generated column, read straight. */
  async balance(memberId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<{ lmb_balance_points: Prisma.Decimal | null }[]>`
      SELECT lmb_balance_points FROM sales.loyalty_member WHERE lmb_id = ${memberId}::uuid`;
    return Number(rows[0]?.lmb_balance_points ?? 0);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  consume() — the six steps of §3.4c, in order
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Draw `points` out of a wallet, FIFO, one ledger row per lot touched.
   *
   * ── THE LOCK, and it is the reason this method exists ──────────────────
   *
   * Step 2 takes `SELECT … FOR UPDATE` on the member row, and deliberately NOT
   * `FOR UPDATE SKIP LOCKED`. Two tills redeeming one wallet must SERIALISE;
   * in a supermarket that is a real race, not a hypothetical one. Blocking is
   * correct — skipping would let both tills spend the same points.
   *
   * The lock must sit in the CALLER's interactive `$transaction`, which is the
   * bill's own post transaction. `tx` is therefore REQUIRED and not optional:
   * given a fresh connection the lock would be taken and released before the
   * bill posted, and would protect nothing at all.
   *
   * ── ONE ROW PER LOT ────────────────────────────────────────────────────
   *
   * A redemption spanning three lots writes three rows. They are not collapsed
   * because the member statement has to be able to say which lot paid.
   */
  async consume(
    tx: Prisma.TransactionClient,
    memberId: string,
    points: number,
    txnType: LoyaltyConsumeType,
    opts: LoyaltyConsumeOptions,
  ): Promise<number> {
    // 1 — nothing to do. Not an error: a bill with no redemption calls this.
    if (!(points > 0)) {
      return 0;
    }

    // The two tender CHECKs, asserted here so the message is readable. The
    // database would catch both, with a 23514 naming a constraint instead.
    if (txnType === 'REDEEM' && !opts.tenderId) {
      throwSalesInvalid(
        'A points redemption must name the tender row it settled through',
        SALES_ERROR_CODES.LOYALTY_CAP,
        'tenderId',
      );
    }
    if (txnType === 'GIFT' && opts.tenderId) {
      throwSalesInvalid(
        'A gift redemption crosses no money and must not name a tender row',
        SALES_ERROR_CODES.LOYALTY_CAP,
        'tenderId',
      );
    }

    // 2 — serialise on the wallet. FOR UPDATE, never SKIP LOCKED.
    const member = await tx.$queryRaw<{ lmb_comp_id: string; lmb_cust_id: string }[]>`
      SELECT lmb_comp_id, lmb_cust_id
        FROM sales.loyalty_member
       WHERE lmb_id = ${memberId}::uuid
         FOR UPDATE`;

    // 3 — the row is gone or the id is wrong.
    if (member.length === 0) {
      throwSalesInvalid(
        `Loyalty member ${memberId} does not exist`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'memberId',
      );
    }
    const { lmb_comp_id: compId, lmb_cust_id: custId } = member[0];

    // 4 — refuse BEFORE writing anything, and say what actually happened.
    const avail = await this.redeemable(memberId, opts.txnDate, tx);
    if (avail < points) {
      throwSalesRefused(
        `Member ${memberId} has ${avail} redeemable points on ${opts.txnDate}; ${points} were asked for`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyPoints',
      );
    }

    // 5 — walk the lots in FIFO order, one row each.
    const lots = await this.lots(memberId, opts.txnDate, tx);
    const rate = opts.rate ?? 0;
    const rows: LoyaltyLedgerRowInput[] = [];
    let left = points;

    for (const lot of lots) {
      if (left <= 0) {
        break;
      }
      const take = Math.min(left, lot.lotBalance);
      if (take <= 0) {
        continue;
      }
      rows.push({
        compId,
        custId,
        memberId,
        branchId: opts.branchId,
        accYear: opts.accYear,
        txnType,
        rowNo: rows.length + 1,
        points: -take, // always negative: a spend
        txnDate: opts.txnDate,
        lotId: lot.lotId,
        lotAccYear: lot.lotAccYear,
        lscId: opts.lscId ?? lot.lscId,
        rate,
        moneyValue: round(take * rate, 2),
        srcModule: opts.srcModule ?? 'SALES',
        srcDocType: opts.srcDocType ?? null,
        srcDocId: opts.srcDocId ?? null,
        srcAccYear: opts.srcAccYear ?? null,
        srcDocRefno: opts.srcDocRefno ?? null,
        tenderId: opts.tenderId ?? null,
        tenderAccYear: opts.tenderAccYear ?? null,
        remarks: opts.remarks ?? null,
        createdBy: opts.createdBy ?? 'SYSTEM',
        userId: opts.userId ?? null,
        sessionId: opts.sessionId ?? null,
        deviceId: opts.deviceId ?? null,
        approvedBy: opts.approvedBy ?? null,
      });
      left = round(left - take, 4);
    }

    // 6 — unreachable while the wallet is locked and step 4 passed, which is
    // exactly why it must be loud rather than silently short-changing anyone.
    if (left > 0) {
      throw new Error(
        `Loyalty lot balances and wallet balance disagree for member ${memberId}: ` +
          `${left} of ${points} points could not be allocated on ${opts.txnDate}`,
      );
    }

    await this.writeLedgerRows(tx, rows);
    return rows.length;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Resolution — who is earning, and under which scheme
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The wallet this document earns into (flow §5.8 "Member resolution").
   *
   * In order: the member the screen already identified (`sb_loyalty_member_id`,
   * looked up by mobile / card / customer through `party-context`), else the
   * wallet of `sb_cust_id`, else — if `loyalty.auto_enrol` is on — a wallet
   * opened on this first earning bill.
   *
   * The WALK-IN ledger never earns (D59). Pinning a whole shop's points to one
   * anonymous row would make every balance meaningless; the quick-add customer
   * is how a shopper actually joins.
   */
  async resolveMember(
    tx: Prisma.TransactionClient,
    bill: LoyaltyBillSource,
    opts: { autoEnrol: boolean; isWalkIn: boolean; createdBy?: string } = {
      autoEnrol: true,
      isWalkIn: false,
    },
  ): Promise<string | null> {
    if (bill.memberId) {
      return bill.memberId;
    }
    if (opts.isWalkIn) {
      return null;
    }

    const existing = await tx.$queryRaw<{ lmb_id: string }[]>`
      SELECT lmb_id
        FROM sales.loyalty_member
       WHERE lmb_comp_id    = ${bill.companyId}::uuid
         AND lmb_cust_id    = ${bill.custId}::uuid
         AND lmb_is_deleted = false
       ORDER BY lmb_created_on
       LIMIT 1`;
    if (existing.length > 0) {
      return existing[0].lmb_id;
    }
    if (!opts.autoEnrol) {
      return null;
    }

    // A wallet is a plain row with no ledger behind it yet, so it is the one
    // thing in this service that may be written without going through the
    // ledger writer: nothing about it is derived.
    const created = await tx.$queryRaw<{ lmb_id: string }[]>`
      INSERT INTO sales.loyalty_member
        (lmb_comp_id, lmb_branch_id, lmb_acc_year, lmb_cust_id, lmb_enrolled_on, lmb_created_by)
      VALUES
        (${bill.companyId}::uuid, ${bill.branchId}::uuid, ${bill.accYear}::char(9),
         ${bill.custId}::uuid, ${bill.docDate}::date, ${opts.createdBy ?? 'SYSTEM'})
      RETURNING lmb_id`;
    return created[0].lmb_id;
  }

  /**
   * ONE scheme per bill (D59) — the highest-priority APPROVED scheme that
   * admits this document.
   *
   * Every filter is applied in SQL rather than in a loop over candidates,
   * because the offline till has to answer the same question with the same
   * rows and a half-filtered list is how the two would diverge.
   */
  async resolveScheme(
    tx: Prisma.TransactionClient,
    bill: LoyaltyBillSource,
    opts: { at?: string; forRedeem?: boolean } = {},
  ): Promise<LoyaltyScheme | null> {
    const wantTypes = opts.forRedeem ? ['REDEEM', 'BOTH'] : ['EARN', 'BOTH'];
    const weekday = WEEKDAYS[new Date(`${bill.docDate}T00:00:00Z`).getUTCDay()];
    const atTime = opts.at ?? null;

    const rows = await tx.$queryRaw<SchemeRow[]>`
      SELECT s.*
        FROM sales.loyalty_scheme s
       WHERE s.lsc_comp_id    = ${bill.companyId}::uuid
         AND s.lsc_is_deleted = false
         AND s.lsc_is_active  = true
         AND s.lsc_status     = 'APPROVED'
         AND s.lsc_type       = ANY(${wantTypes}::text[])
         AND (s.lsc_start_date IS NULL OR s.lsc_start_date <= ${bill.docDate}::date)
         AND (s.lsc_end_date   IS NULL OR s.lsc_end_date   >= ${bill.docDate}::date)
         -- NULL weekday list means every day.
         AND (s.lsc_valid_weekdays IS NULL
              OR ${weekday} = ANY(string_to_array(s.lsc_valid_weekdays, ',')))
         -- A time window is only tested when the caller gave a time; a nightly
         -- re-post has no counter clock and must not be refused for it.
         AND (${atTime}::time IS NULL
              OR s.lsc_valid_from_time IS NULL OR s.lsc_valid_to_time IS NULL
              OR ${atTime}::time BETWEEN s.lsc_valid_from_time AND s.lsc_valid_to_time)
         AND (s.lsc_bill_type = 'ALL' OR s.lsc_bill_type = ${bill.billType ?? 'ALL'})
         -- Branch scope: ALL, or the branch listed and not excluded.
         AND (s.lsc_branch_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_branch b
                WHERE b.lsb_lsc_id     = s.lsc_id
                  AND b.lsb_branch_id  = ${bill.branchId}::uuid
                  AND b.lsb_is_exclude = false
                  AND b.lsb_is_deleted = false
                  AND b.lsb_is_active  = true))
         AND NOT EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_branch b
                WHERE b.lsb_lsc_id     = s.lsc_id
                  AND b.lsb_branch_id  = ${bill.branchId}::uuid
                  AND b.lsb_is_exclude = true
                  AND b.lsb_is_deleted = false
                  AND b.lsb_is_active  = true)
         -- Customer scope: the customer itself or its group.
         AND (s.lsc_cust_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_party p
                WHERE p.lsp_lsc_id     = s.lsc_id
                  AND p.lsp_is_exclude = false
                  AND p.lsp_is_deleted = false
                  AND p.lsp_is_active  = true
                  AND ((p.lsp_kind = 'CUSTOMER'       AND p.lsp_cust_id = ${bill.custId}::uuid)
                    OR (p.lsp_kind = 'CUSTOMER_GROUP' AND p.lsp_cust_group_id = ${
                      bill.custGroupId ?? null
                    }::uuid))))
         AND NOT EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_party p
                WHERE p.lsp_lsc_id     = s.lsc_id
                  AND p.lsp_is_exclude = true
                  AND p.lsp_is_deleted = false
                  AND p.lsp_is_active  = true
                  AND ((p.lsp_kind = 'CUSTOMER'       AND p.lsp_cust_id = ${bill.custId}::uuid)
                    OR (p.lsp_kind = 'CUSTOMER_GROUP' AND p.lsp_cust_group_id = ${
                      bill.custGroupId ?? null
                    }::uuid)))
       -- Highest priority wins; the newest scheme breaks a tie, because that
       -- is the one somebody most recently decided on.
       ORDER BY s.lsc_priority DESC, s.lsc_created_on DESC
       LIMIT 1`;

    return rows.length === 0 ? null : toScheme(rows[0]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  EARN (flow §5.8) — one row per bill, idempotent on ux_lld_src_row
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Award this document's points.
   *
   * Writes ONE EARN row. `ux_lld_src_row` is
   * `(src_doc_type, src_doc_id, acc_year, txn_type, row_no)` filtered to live
   * rows, so a re-post of the same bill collides instead of awarding twice —
   * which is the whole idempotency story for an offline till that re-pushes.
   *
   * The per-line figures come back in `lines` for `sbi_loyalty_points` /
   * `sbi_loyalty_pv`. Those are SNAPSHOTS, not caches: a sale return must
   * reverse WHAT THE BILL AWARDED, not what re-running today's scheme would
   * award. Schemes get edited; bills do not.
   */
  async earn(
    tx: Prisma.TransactionClient,
    bill: LoyaltyBillSource,
    opts: {
      memberId?: string | null;
      scheme?: LoyaltyScheme | null;
      createdBy?: string;
      dryRun?: boolean;
    } = {},
  ): Promise<LoyaltyEarnResult> {
    const empty = (reason: string): LoyaltyEarnResult => ({
      memberId: opts.memberId ?? bill.memberId ?? null,
      schemeId: null,
      points: 0,
      baseAmount: 0,
      baseQty: 0,
      rowsWritten: 0,
      expiresOn: null,
      activeFrom: null,
      lines: [],
      reason,
    });

    const memberId = opts.memberId ?? bill.memberId ?? null;
    if (!memberId) {
      return empty('No loyalty member on this document');
    }
    const scheme = opts.scheme !== undefined ? opts.scheme : await this.resolveScheme(tx, bill);
    if (!scheme) {
      return empty('No approved earning scheme covers this document');
    }

    const computed = await this.computeEarn(tx, bill, scheme);
    if (computed.points <= 0) {
      return {
        ...empty(computed.reason ?? 'Scheme awards no points for this document'),
        schemeId: scheme.lscId,
      };
    }

    const expiresOn = lotExpiry(scheme, bill.docDate);
    const activeFrom = addDays(bill.docDate, scheme.activationDays);

    if (opts.dryRun) {
      return {
        memberId,
        schemeId: scheme.lscId,
        points: computed.points,
        baseAmount: computed.baseAmount,
        baseQty: computed.baseQty,
        rowsWritten: 0,
        expiresOn,
        activeFrom,
        lines: computed.lines,
      };
    }

    await this.writeLedgerRows(tx, [
      {
        compId: bill.companyId,
        branchId: bill.branchId,
        accYear: bill.accYear,
        memberId,
        custId: bill.custId,
        lscId: scheme.lscId,
        lssId: computed.lssId,
        lsiId: computed.lsiId,
        txnType: 'EARN',
        rowNo: 1,
        points: computed.points,
        txnDate: bill.docDate,
        expiresOn,
        // The cooling period. Before it, the points count towards the balance
        // but cannot be spent — which is why redeemable() is not the balance.
        activeFrom,
        srcModule: 'SALES',
        srcDocType: bill.docType,
        srcDocId: bill.docId,
        srcAccYear: bill.accYear,
        srcDocRefno: bill.docRefno,
        baseAmount: computed.baseAmount,
        baseQty: computed.baseQty,
        factor: 1,
        createdBy: opts.createdBy ?? 'SYSTEM',
      },
    ]);

    return {
      memberId,
      schemeId: scheme.lscId,
      points: computed.points,
      baseAmount: computed.baseAmount,
      baseQty: computed.baseQty,
      rowsWritten: 1,
      expiresOn,
      activeFrom,
      lines: computed.lines,
    };
  }

  /**
   * The earning arithmetic, with no writes — shared by `earn()` and
   * `preview()` so the tender panel cannot quote a figure the post disagrees
   * with.
   *
   * ── The exclusions, which are the part people forget ───────────────────
   *
   *  * free lines never earn;
   *  * a line whose item has `item_allow_loyalty = false` never earns, however
   *    generous the scheme is — 3.0's rule, carried forward;
   *  * when `lsc_earn_with_redeem` is false, the rupees paid FOR by points are
   *    taken out of the base, or points would earn points;
   *  * when `lsc_earn_on_discounted` is false the base is the GROSS amount,
   *    i.e. before the discount, rather than the discounted figure.
   */
  private async computeEarn(
    tx: Prisma.TransactionClient,
    bill: LoyaltyBillSource,
    scheme: LoyaltyScheme,
  ): Promise<{
    points: number;
    baseAmount: number;
    baseQty: number;
    lines: { lineNo: number; points: number; pv: number }[];
    lssId: string | null;
    lsiId: string | null;
    reason?: string;
  }> {
    const none = (reason: string) => ({
      points: 0,
      baseAmount: 0,
      baseQty: 0,
      lines: [],
      lssId: null,
      lsiId: null,
      reason,
    });

    const itemRules = await this.schemeItems(tx, scheme.lscId);
    const slabs = await this.schemeSlabs(tx, scheme.lscId);

    const eligible = bill.lines.filter((l) => {
      if (l.isFree || !l.allowLoyalty) {
        return false;
      }
      if (excludedByItemRule(l, itemRules)) {
        return false;
      }
      // Under item scope LIST the line must be NAMED, not merely not-excluded:
      // a list means "these items", and an unlisted item is outside it.
      if (scheme.itemScope === 'LIST') {
        return matchItemRule(l, itemRules) !== null;
      }
      return true;
    });
    if (eligible.length === 0) {
      return none('No line on this document is eligible to earn');
    }

    const amountOf = (l: (typeof eligible)[number]): number => {
      if (!scheme.earnOnDiscounted) {
        return l.grossAmt;
      }
      switch (scheme.amountType) {
        case 'GROSS_AMOUNT':
          return l.grossAmt;
        case 'NET_AMOUNT':
          return l.netAmt;
        default:
          return l.taxableAmt;
      }
    };

    const byAmount = scheme.applyOn === 'BILL_AMOUNT' || scheme.applyOn === 'ITEM_AMOUNT';
    const perLine = scheme.applyOn === 'ITEM_AMOUNT' || scheme.applyOn === 'ITEM_QTY';

    let baseAmount = eligible.reduce((s, l) => s + amountOf(l), 0);
    const baseQty = eligible.reduce((s, l) => s + l.qty, 0);

    if (byAmount) {
      if (scheme.earnOnCharges) {
        baseAmount += bill.chargesAmt;
      }
      if (!scheme.earnWithRedeem) {
        // Points must not buy points.
        baseAmount = Math.max(0, baseAmount - bill.redeemedAmount);
      }
    }
    baseAmount = round(baseAmount, 2);

    if (baseAmount < scheme.minBillAmount) {
      return none(
        `Document base ${baseAmount} is below the scheme minimum ${scheme.minBillAmount}`,
      );
    }

    const lines: { lineNo: number; points: number; pv: number }[] = [];
    let raw = 0;
    let lssId: string | null = null;
    let lsiId: string | null = null;

    if (perLine) {
      for (const l of eligible) {
        const lineBase = byAmount ? amountOf(l) : l.qty;
        const rule = matchItemRule(l, itemRules);
        const slab = matchSlab(lineBase, slabs, l.itemId);

        // The item rule is the more specific statement, so it wins when it
        // actually awards something; the slab is the fallback for a line the
        // rule list only admits without pricing.
        let pts = rule ? award(lineBase, rule) : 0;
        if (pts <= 0 && slab) {
          pts = award(lineBase, slab);
          lssId ??= slab.id;
        } else if (pts > 0 && rule) {
          lsiId ??= rule.id;
        }
        if (pts > 0) {
          raw += pts;
          lines.push({ lineNo: l.lineNo, points: pts, pv: l.qty > 0 ? pts / l.qty : 0 });
        }
      }
    } else {
      const base = byAmount ? baseAmount : baseQty;
      const slab = matchSlab(base, slabs, null);
      if (!slab) {
        return none(`No slab of scheme ${scheme.code} covers a base of ${base}`);
      }
      lssId = slab.id;
      raw = award(base, slab);
      // Spread the bill-level award back over the lines that produced it, so
      // a return can claw back in proportion without re-running the scheme.
      const spreadOver = byAmount ? baseAmount : baseQty;
      for (const l of eligible) {
        const share = spreadOver > 0 ? (byAmount ? amountOf(l) : l.qty) / spreadOver : 0;
        const pts = raw * share;
        lines.push({ lineNo: l.lineNo, points: pts, pv: l.qty > 0 ? pts / l.qty : 0 });
      }
    }

    let points = roundPoints(raw, scheme.rounding, scheme.pointsDecimals);
    if (scheme.maxEarnPoints !== null && scheme.maxEarnPoints > 0) {
      points = Math.min(points, scheme.maxEarnPoints);
    }

    // Keep the snapshot consistent with what was actually awarded after the
    // rounding and the cap, or the line figures will not sum to the header's.
    if (raw > 0 && points !== raw) {
      const k = points / raw;
      for (const l of lines) {
        l.points = round(l.points * k, 4);
        l.pv = round(l.pv * k, 4);
      }
    }

    return { points, baseAmount, baseQty, lines, lssId, lsiId };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  REDEEM — points out, money in (flow §5.8)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Spend points against a tender row of type 10 (LOYALTY).
   *
   * ── The rate, and who owns it ──────────────────────────────────────────
   *
   * `lsc_redeem_value_per_point` WINS. The tender master's
   * `tnd_conversion_rate` is only the fallback — 13's rule — which is why the
   * tender dialog's rate must come from `party-context` and not from the
   * master. A till quoting the master's rate while the server posts the
   * scheme's would print one figure and charge another.
   *
   * Every cap below is checked BEFORE `consume()` is called, so a refusal
   * leaves no rows behind.
   */
  async redeem(
    tx: Prisma.TransactionClient,
    bill: LoyaltyBillSource,
    tender: {
      tenderId: string;
      tenderAccYear: string;
      points: number;
      amount: number;
      /** `tnd_conversion_rate`, used only when the scheme has no rate. */
      masterRate?: number | null;
    },
    opts: { memberId?: string | null; scheme?: LoyaltyScheme | null; createdBy?: string } = {},
  ): Promise<{ rowsWritten: number; points: number; amount: number; rate: number }> {
    const points = tender.points;
    if (!(points > 0)) {
      return { rowsWritten: 0, points: 0, amount: 0, rate: 0 };
    }

    const memberId = opts.memberId ?? bill.memberId ?? null;
    if (!memberId) {
      throwSalesRefused(
        'This document redeems points but names no loyalty member',
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyMemberId',
      );
    }

    const scheme =
      opts.scheme !== undefined
        ? opts.scheme
        : await this.resolveScheme(tx, bill, { forRedeem: true });
    if (!scheme) {
      throwSalesRefused(
        'No approved scheme allows a redemption against this document',
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyPoints',
      );
    }
    if (!scheme.allowPointRedeem) {
      throwSalesRefused(
        `Scheme ${scheme.code} does not allow point redemption`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyPoints',
      );
    }

    // Cross-branch: a franchisee under pool mode BRANCH honours only the
    // points it issued itself, so a wallet earned elsewhere cannot be spent
    // here unless the scheme says it may.
    if (scheme.poolMode === 'BRANCH' && !scheme.allowCrossBranchRedeem) {
      const elsewhere = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n
          FROM sales.loyalty_ledger
         WHERE lld_member_id  = ${memberId}::uuid
           AND lld_txn_type   = 'EARN'
           AND lld_is_deleted = false
           AND lld_lot_balance > 0
           AND lld_branch_id <> ${bill.branchId}::uuid`;
      if (Number(elsewhere[0]?.n ?? 0) > 0) {
        throwSalesRefused(
          `Scheme ${scheme.code} pools points by branch and does not allow cross-branch redemption`,
          SALES_ERROR_CODES.LOYALTY_CAP,
          'loyaltyPoints',
        );
      }
    }

    const rate =
      scheme.redeemValuePerPoint > 0 ? scheme.redeemValuePerPoint : (tender.masterRate ?? 0);
    if (!(rate > 0)) {
      throwSalesRefused(
        `Scheme ${scheme.code} has no redemption rate and the tender master gave none`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyRate',
      );
    }

    // The client computed the money; the server re-derives it and refuses a
    // mismatch rather than trusting either figure.
    const expected = round(points * rate, 2);
    if (round(tender.amount, 2) !== expected) {
      throwSalesRefused(
        `Redemption amount ${tender.amount} does not equal ${points} points at ${rate} (${expected})`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'tenderAmount',
      );
    }

    const billAmount = bill.lines.reduce((s, l) => s + l.netAmt, 0) + bill.chargesAmt;
    if (scheme.redeemMinBillAmount > 0 && billAmount < scheme.redeemMinBillAmount) {
      throwSalesRefused(
        `A redemption needs a bill of at least ${scheme.redeemMinBillAmount}; this one is ${round(billAmount, 2)}`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyPoints',
      );
    }
    if (scheme.minRedeemPoints > 0 && points < scheme.minRedeemPoints) {
      throwSalesRefused(
        `At least ${scheme.minRedeemPoints} points must be redeemed at once; ${points} were offered`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyPoints',
      );
    }
    if (
      scheme.maxRedeemPoints !== null &&
      scheme.maxRedeemPoints > 0 &&
      points > scheme.maxRedeemPoints
    ) {
      throwSalesRefused(
        `At most ${scheme.maxRedeemPoints} points may be redeemed on one bill; ${points} were offered`,
        SALES_ERROR_CODES.LOYALTY_CAP,
        'loyaltyPoints',
      );
    }
    if (scheme.maxRedeemPerc !== null && scheme.maxRedeemPerc > 0) {
      const cap = round((billAmount * scheme.maxRedeemPerc) / 100, 2);
      if (expected > cap) {
        throwSalesRefused(
          `Points may settle at most ${scheme.maxRedeemPerc}% of this bill (${cap}); ${expected} was offered`,
          SALES_ERROR_CODES.LOYALTY_CAP,
          'tenderAmount',
        );
      }
    }
    if (scheme.redeemMultiple !== null && scheme.redeemMultiple > 0) {
      const steps = points / scheme.redeemMultiple;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        throwSalesRefused(
          `Points are redeemed in multiples of ${scheme.redeemMultiple}; ${points} is not one`,
          SALES_ERROR_CODES.LOYALTY_CAP,
          'loyaltyPoints',
        );
      }
    }

    const rowsWritten = await this.consume(tx, memberId, points, 'REDEEM', {
      branchId: bill.branchId,
      accYear: bill.accYear,
      txnDate: bill.docDate,
      rate,
      srcModule: 'SALES',
      srcDocType: bill.docType,
      srcDocId: bill.docId,
      srcAccYear: bill.accYear,
      srcDocRefno: bill.docRefno,
      tenderId: tender.tenderId,
      tenderAccYear: tender.tenderAccYear,
      lscId: scheme.lscId,
      createdBy: opts.createdBy ?? 'SYSTEM',
    });

    return { rowsWritten, points, amount: expected, rate };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Undoing — cancel and return
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Cancel: take back what the document awarded, and give back what it spent.
   *
   * The EARN is reversed by an opposite-sign row NAMING it
   * (`lld_reversal_of_id`), capped at what is still in the lot — some of the
   * points may already have been spent on another bill, and that bill is real.
   * The shortfall goes in `lld_remarks` and the cancel NEVER aborts: refusing
   * to cancel a bill because its points were spent would strand the document.
   *
   * Every REDEEM row is reversed too, so the points come back into their lots.
   * A reversal REDEEM carries the lot it restores, which `recomputeLots` nets
   * automatically — reversals need no special case anywhere.
   */
  async reverseForCancel(
    tx: Prisma.TransactionClient,
    doc: { docId: string; accYear: string; docType: LoyaltySrcDocType; docRefno?: string | null },
    opts: { reason?: string; createdBy?: string } = {},
  ): Promise<{ rowsWritten: number; earnReversed: number; redeemReversed: number }> {
    const originals = await tx.$queryRaw<LedgerRowOut[]>`
      SELECT lld_id, lld_acc_year, lld_comp_id, lld_branch_id, lld_member_id, lld_cust_id,
             lld_txn_type, lld_points, lld_lot_balance, lld_lot_id, lld_lot_acc_year,
             lld_lsc_id, lld_rate, lld_money_value, lld_tender_id, lld_tender_acc_year,
             lld_txn_date
        FROM sales.loyalty_ledger
       WHERE lld_src_doc_type   = ${doc.docType}
         AND lld_src_doc_id     = ${doc.docId}::uuid
         AND lld_is_deleted     = false
         AND lld_reversal_of_id IS NULL
       ORDER BY lld_txn_type, lld_row_no`;

    if (originals.length === 0) {
      return { rowsWritten: 0, earnReversed: 0, redeemReversed: 0 };
    }

    // One reversal per original per year (ux_lld_reversal). Skip anything
    // already reversed so a repeated cancel is a no-op rather than a 23505.
    const already = await this.reversedIds(
      tx,
      originals.map((o) => o.lld_id),
    );

    const rows: LoyaltyLedgerRowInput[] = [];
    let earnReversed = 0;
    let redeemReversed = 0;
    let rowNo = 0;

    for (const o of originals) {
      if (already.has(o.lld_id)) {
        continue;
      }
      const base = {
        compId: o.lld_comp_id,
        branchId: o.lld_branch_id,
        accYear: doc.accYear,
        memberId: o.lld_member_id,
        custId: o.lld_cust_id,
        lscId: o.lld_lsc_id,
        txnDate: dateStr(o.lld_txn_date) as string,
        srcModule: 'SALES' as const,
        srcDocType: doc.docType,
        srcDocId: doc.docId,
        srcAccYear: doc.accYear,
        srcDocRefno: doc.docRefno ?? null,
        reversalOfId: o.lld_id,
        reversalOfAccYear: o.lld_acc_year,
        reversalReason: opts.reason ?? 'Document cancelled',
        createdBy: opts.createdBy ?? 'SYSTEM',
      };

      if (o.lld_txn_type === 'EARN') {
        const awarded = Number(o.lld_points);
        const left = Number(o.lld_lot_balance ?? 0);
        const take = Math.min(awarded, Math.max(0, left));
        if (take <= 0) {
          continue;
        }
        const shortfall = round(awarded - take, 4);
        rows.push({
          ...base,
          txnType: 'EARN',
          rowNo: ++rowNo,
          points: -take,
          remarks:
            shortfall > 0
              ? `Cancelled; ${shortfall} of ${awarded} points had already been spent and could not be taken back`
              : null,
        });
        earnReversed += take;
      } else if (o.lld_txn_type === 'REDEEM' || o.lld_txn_type === 'GIFT') {
        const spent = -Number(o.lld_points); // stored negative
        rows.push({
          ...base,
          txnType: o.lld_txn_type,
          rowNo: ++rowNo,
          points: spent, // positive: the points come back
          lotId: o.lld_lot_id,
          lotAccYear: o.lld_lot_acc_year,
          rate: Number(o.lld_rate ?? 0),
          moneyValue: Number(o.lld_money_value ?? 0),
          tenderId: o.lld_tender_id,
          tenderAccYear: o.lld_tender_acc_year,
        });
        redeemReversed += spent;
      }
    }

    await this.writeLedgerRows(tx, rows);
    return { rowsWritten: rows.length, earnReversed, redeemReversed };
  }

  /**
   * Re-tender (HANDOVER §2.13): ONE loyalty tender was voided, so ONLY its
   * REDEEM rows are reversed — the points come back, the bill's EARN stays.
   * Skipping this is how a customer gets silently robbed.
   */
  async reverseRedeemForTender(
    tx: Prisma.TransactionClient,
    doc: {
      docId: string;
      accYear: string;
      docType: LoyaltySrcDocType;
      docRefno?: string | null;
      tenderId: string;
    },
    opts: { reason?: string; createdBy?: string } = {},
  ): Promise<{ rowsWritten: number; pointsRestored: number }> {
    const originals = await tx.$queryRaw<LedgerRowOut[]>`
      SELECT lld_id, lld_acc_year, lld_comp_id, lld_branch_id, lld_member_id, lld_cust_id,
             lld_txn_type, lld_points, lld_lot_balance, lld_lot_id, lld_lot_acc_year,
             lld_lsc_id, lld_rate, lld_money_value, lld_tender_id, lld_tender_acc_year,
             lld_txn_date
        FROM sales.loyalty_ledger
       WHERE lld_src_doc_type   = ${doc.docType}
         AND lld_src_doc_id     = ${doc.docId}::uuid
         AND lld_tender_id      = ${doc.tenderId}::uuid
         AND lld_txn_type       = 'REDEEM'
         AND lld_is_deleted     = false
         AND lld_reversal_of_id IS NULL
       ORDER BY lld_row_no`;
    if (originals.length === 0) {
      return { rowsWritten: 0, pointsRestored: 0 };
    }
    const already = await this.reversedIds(
      tx,
      originals.map((o) => o.lld_id),
    );
    const rows: LoyaltyLedgerRowInput[] = [];
    let restored = 0;
    let rowNo = 0;
    for (const o of originals) {
      if (already.has(o.lld_id)) {
        continue;
      }
      const spent = -Number(o.lld_points);
      rows.push({
        compId: o.lld_comp_id,
        branchId: o.lld_branch_id,
        accYear: doc.accYear,
        memberId: o.lld_member_id,
        custId: o.lld_cust_id,
        lscId: o.lld_lsc_id,
        txnDate: dateStr(o.lld_txn_date) as string,
        srcModule: 'SALES',
        srcDocType: doc.docType,
        srcDocId: doc.docId,
        srcAccYear: doc.accYear,
        srcDocRefno: doc.docRefno ?? null,
        reversalOfId: o.lld_id,
        reversalOfAccYear: o.lld_acc_year,
        reversalReason: opts.reason ?? 'Tender voided',
        createdBy: opts.createdBy ?? 'SYSTEM',
        txnType: 'REDEEM',
        rowNo: ++rowNo,
        points: spent,
        lotId: o.lld_lot_id,
        lotAccYear: o.lld_lot_acc_year,
        rate: Number(o.lld_rate ?? 0),
        moneyValue: Number(o.lld_money_value ?? 0),
        tenderId: o.lld_tender_id,
        tenderAccYear: o.lld_tender_acc_year,
      });
      restored += spent;
    }
    await this.writeLedgerRows(tx, rows);
    return { rowsWritten: rows.length, pointsRestored: restored };
  }

  /**
   * Return: claw back the points the RETURNED PORTION earned.
   *
   * `share` is the return's taxable value over the bill's, so a part return
   * takes back a proportionate part. `lsc_return_mode = IGNORE` takes nothing.
   *
   * Points SPENT on the returned bill are not restored — their rupees are
   * refunded or credited as money instead (D59).
   *
   * ── Why this is not written as a "reversal" ────────────────────────────
   *
   * `ux_lld_reversal` is unique on `(lld_reversal_of_id, lld_acc_year)`: ONE
   * reversal per original per year. That is right for a cancel, which happens
   * once, and wrong for returns, which are routinely partial and repeated — a
   * second part return of the same bill would collide. So a claw-back is a
   * draw on the lots keyed by the RETURN document, which `ux_lld_src_row` then
   * makes idempotent per return, and it walks the lots in the same FIFO order
   * as every other draw so the lot balances stay coherent.
   *
   * It is capped at what is actually left and NEVER aborts: the customer may
   * already have spent the points, and refusing the return over it would
   * strand a document that has physically come back over the counter.
   */
  async clawbackForReturn(
    tx: Prisma.TransactionClient,
    ret: {
      docId: string;
      accYear: string;
      companyId: string;
      branchId: string;
      docDate: string;
      docRefno?: string | null;
      memberId: string;
    },
    share: number,
    opts: { scheme?: LoyaltyScheme | null; earnedOnBill?: number; createdBy?: string } = {},
  ): Promise<{ rowsWritten: number; clawedBack: number; shortfall: number }> {
    if (opts.scheme && opts.scheme.returnMode === 'IGNORE') {
      return { rowsWritten: 0, clawedBack: 0, shortfall: 0 };
    }

    const earned = opts.earnedOnBill ?? 0;
    const want = round(earned * clamp01(share), 4);
    if (!(want > 0)) {
      return { rowsWritten: 0, clawedBack: 0, shortfall: 0 };
    }

    const avail = await this.redeemable(ret.memberId, ret.docDate, tx);
    const take = Math.min(want, avail);
    const shortfall = round(want - take, 4);

    if (!(take > 0)) {
      this.logger.warn(
        `Return ${ret.docRefno ?? ret.docId}: ${want} points to claw back, none left in the wallet`,
      );
      return { rowsWritten: 0, clawedBack: 0, shortfall: want };
    }

    const rowsWritten = await this.consume(tx, ret.memberId, take, 'EXPIRE', {
      branchId: ret.branchId,
      accYear: ret.accYear,
      txnDate: ret.docDate,
      rate: 0,
      srcModule: 'SALES',
      srcDocType: 'SALE_RETURN',
      srcDocId: ret.docId,
      srcAccYear: ret.accYear,
      srcDocRefno: ret.docRefno ?? null,
      lscId: opts.scheme?.lscId ?? null,
      remarks:
        shortfall > 0
          ? `Clawed back on return ${ret.docRefno ?? ret.docId}; ${shortfall} of ${want} points had already been spent`
          : `Clawed back on return ${ret.docRefno ?? ret.docId}`,
      createdBy: opts.createdBy ?? 'SYSTEM',
    });

    return { rowsWritten, clawedBack: take, shortfall };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PREVIEW — what /bills/validate and party-context show
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The tender panel's whole loyalty block, in one call.
   *
   * `balance` and `redeemable` are BOTH returned and they are different
   * numbers: the wallet also counts lots still cooling and lots lapsed but not
   * yet swept. Display `balance`, redeem against `redeemable`, and never let a
   * screen compute one from the other.
   */
  async preview(bill: LoyaltyBillSource, tx?: Prisma.TransactionClient): Promise<LoyaltyPreview> {
    const client = tx ?? this.prisma;
    const memberId = bill.memberId;

    const scheme = await this.resolveScheme(client, bill);
    const earn = memberId
      ? await this.earn(client, bill, { memberId, scheme, dryRun: true })
      : null;

    return {
      memberId,
      balance: memberId ? await this.balance(memberId, client) : 0,
      redeemable: memberId ? await this.redeemable(memberId, bill.docDate, client) : 0,
      rate: scheme?.redeemValuePerPoint ?? 0,
      minPoints: scheme?.minRedeemPoints ?? 0,
      maxPoints: scheme?.maxRedeemPoints ?? null,
      maxRedeemAmount:
        scheme?.maxRedeemPerc != null && scheme.maxRedeemPerc > 0
          ? round(
              (bill.lines.reduce((s, l) => s + l.netAmt, 0) + bill.chargesAmt) *
                (scheme.maxRedeemPerc / 100),
              2,
            )
          : null,
      multiple: scheme?.redeemMultiple ?? null,
      earnPreview: earn?.points ?? 0,
      schemeId: scheme?.lscId ?? null,
      schemeName: scheme?.name ?? null,
      allowPointRedeem: scheme?.allowPointRedeem ?? false,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The nightly sweeps — clock events, which is why they were never triggers
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Sweep lapsed points, per company, on the Nest scheduler.
   *
   * ── Idempotent TWICE OVER, and both halves must survive ────────────────
   *
   *  1. `runId = md5(company|date)` as a uuid — DETERMINISTIC. A re-run on the
   *     same date is caught by `ux_lld_src_row` instead of quietly writing a
   *     second set of EXPIRE rows. Keep the recipe exactly: the same run on the
   *     same day must produce the same id.
   *  2. A swept lot has a zero balance and is not selected again.
   *
   * The `|coupon|` segment of `couponExpiryRun` exists so the two run ids can
   * never collide for one company on one day.
   */
  async expiryRun(
    companyId: string,
    accYear: string,
    on: string = today(),
    createdBy = 'SYSTEM',
  ): Promise<number> {
    const runId = deterministicUuid(`${companyId}|${on}`);

    return this.prisma.$transaction(async (tx) => {
      const lapsed = await tx.$queryRaw<LedgerRowOut[]>`
        SELECT lld_id, lld_acc_year, lld_comp_id, lld_branch_id, lld_member_id, lld_cust_id,
               lld_txn_type, lld_points, lld_lot_balance, lld_lot_id, lld_lot_acc_year,
               lld_lsc_id, lld_rate, lld_money_value, lld_tender_id, lld_tender_acc_year,
               lld_txn_date
          FROM sales.loyalty_ledger
         WHERE lld_comp_id    = ${companyId}::uuid
           AND lld_txn_type   = 'EARN'
           AND lld_is_deleted = false
           AND lld_lot_balance > 0
           AND lld_expires_on IS NOT NULL
           AND lld_expires_on < ${on}::date
         ORDER BY lld_expires_on, lld_txn_date, lld_id`;

      if (lapsed.length === 0) {
        return 0;
      }

      const rows: LoyaltyLedgerRowInput[] = lapsed.map((lot, i) => ({
        compId: lot.lld_comp_id,
        branchId: lot.lld_branch_id,
        accYear,
        memberId: lot.lld_member_id,
        custId: lot.lld_cust_id,
        // Carry the scheme from the lot so the member statement keeps it.
        lscId: lot.lld_lsc_id,
        txnType: 'EXPIRE',
        rowNo: i + 1,
        points: -Number(lot.lld_lot_balance ?? 0),
        txnDate: on,
        lotId: lot.lld_id,
        lotAccYear: lot.lld_acc_year,
        srcModule: 'SALES',
        srcDocType: 'EXPIRY_RUN',
        srcDocId: runId,
        srcAccYear: accYear,
        remarks: `Lapsed on ${on}`,
        createdBy,
      }));

      await this.writeLedgerRows(tx, rows);
      return rows.length;
    });
  }

  /**
   * Sweep lapsed gift vouchers, on the same nightly schedule.
   *
   * MOVEMENT FIRST, STATUS AFTER. The balance is recomputed from the movement
   * and the status is the decision laid on top of it: `recomputeCoupons` moves
   * a voucher between ISSUED / PARTIAL / REDEEMED only and will never set
   * EXPIRED itself, because writing a decision from a recompute is how a
   * cancelled voucher silently comes back to life.
   *
   * Note the sign: `lct_amount` is POSITIVE here. A coupon movement is an
   * AMOUNT and the TYPE carries its meaning — this is not the points ledger,
   * where a spend is negative.
   */
  async couponExpiryRun(
    companyId: string,
    accYear: string,
    on: string = today(),
    createdBy = 'SYSTEM',
  ): Promise<number> {
    const runId = deterministicUuid(`${companyId}|coupon|${on}`);

    return this.prisma.$transaction(async (tx) => {
      const lapsed = await tx.$queryRaw<
        {
          lcp_id: string;
          lcp_acc_year: string;
          lcp_comp_id: string;
          lcp_branch_id: string | null;
          lcb_branch_id: string | null;
          lcp_lcb_id: string;
          lcp_cust_id: string | null;
          lcp_member_id: string | null;
          lcp_balance_value: Prisma.Decimal | null;
        }[]
      >`
        SELECT c.lcp_id, c.lcp_acc_year, c.lcp_comp_id, c.lcp_branch_id,
               b.lcb_branch_id, c.lcp_lcb_id, c.lcp_cust_id, c.lcp_member_id,
               c.lcp_balance_value
          FROM sales.loyalty_coupon c
          JOIN sales.loyalty_coupon_batch b ON b.lcb_id = c.lcp_lcb_id
         WHERE c.lcp_comp_id    = ${companyId}::uuid
           AND c.lcp_is_deleted = false
           AND c.lcp_balance_value > 0
           AND c.lcp_valid_upto IS NOT NULL
           AND c.lcp_valid_upto < ${on}::date
           AND c.lcp_status IN ('ISSUED', 'PARTIAL')
         ORDER BY c.lcp_valid_upto, c.lcp_id`;

      if (lapsed.length === 0) {
        return 0;
      }

      await this.writeCouponTxnRows(
        tx,
        lapsed.map((c) => ({
          compId: c.lcp_comp_id,
          // lct_branch_id is NOT NULL, so the batch's branch is the fallback
          // when a voucher was issued without one.
          branchId: c.lcp_branch_id ?? c.lcb_branch_id ?? '',
          accYear,
          lcpId: c.lcp_id,
          lcbId: c.lcp_lcb_id,
          custId: c.lcp_cust_id,
          memberId: c.lcp_member_id,
          txnType: 'EXPIRE',
          rowNo: 1,
          amount: Number(c.lcp_balance_value ?? 0),
          txnDate: on,
          srcModule: 'SALES',
          srcDocType: 'EXPIRY_RUN',
          srcDocId: runId,
          srcAccYear: accYear,
          remarks: `Lapsed on ${on}`,
          createdBy,
        })),
      );

      // THEN the decision.
      await tx.$executeRaw`
        UPDATE sales.loyalty_coupon
           SET lcp_status      = 'EXPIRED',
               lcp_modified_on = now(),
               lcp_modified_by = ${createdBy}
         WHERE lcp_id = ANY(${lapsed.map((c) => c.lcp_id)}::uuid[])`;

      return lapsed.length;
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §3.4b again — the coupon side. ONE writer, same rule.
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The only method that inserts `sales.loyalty_coupon_txn`.
   *
   * Vouchers before batches: `lcb_redeemed_count` counts vouchers BY STATUS,
   * so a batch re-counted before its vouchers are re-summed counts a status
   * that is about to change.
   */
  private async writeCouponTxnRows(
    tx: Prisma.TransactionClient,
    rows: CouponTxnRowInput[],
  ): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const values = rows.map(
      (r) => Prisma.sql`(
        ${r.compId}::uuid, ${r.branchId}::uuid, ${r.accYear}::char(9),
        ${r.lcpId}::uuid, ${r.lcbId}::uuid, ${r.custId ?? null}::uuid,
        ${r.memberId ?? null}::uuid, ${r.txnType}, ${r.rowNo}::int,
        ${dec(r.amount, 2)}::numeric, ${r.txnDate}::date,
        ${dec(r.billAmount ?? 0, 2)}::numeric, ${dec(r.percentApplied ?? 0, 2)}::numeric,
        ${r.srcModule ?? null}, ${r.srcDocType ?? null}, ${r.srcDocId ?? null}::uuid,
        ${r.srcAccYear ?? null}::char(9), ${r.srcDocRefno ?? null},
        ${r.tenderId ?? null}::uuid, ${r.tenderAccYear ?? null}::char(9),
        ${r.reversalOfId ?? null}::uuid, ${r.reversalOfAccYear ?? null}::char(9),
        ${r.reversalReason ?? null}, ${r.approvedBy ?? null}::uuid,
        ${r.remarks ?? null}, ${r.createdBy ?? 'SYSTEM'}
      )`,
    );

    await tx.$executeRaw`
      INSERT INTO sales.loyalty_coupon_txn (
        lct_comp_id, lct_branch_id, lct_acc_year,
        lct_lcp_id, lct_lcb_id, lct_cust_id,
        lct_member_id, lct_txn_type, lct_row_no,
        lct_amount, lct_txn_date,
        lct_bill_amount, lct_percent_applied,
        lct_src_module, lct_src_doc_type, lct_src_doc_id,
        lct_src_acc_year, lct_src_doc_refno,
        lct_tender_id, lct_tender_acc_year,
        lct_reversal_of_id, lct_reversal_of_acc_year,
        lct_reversal_reason, lct_approved_by,
        lct_remarks, lct_created_by
      )
      VALUES ${Prisma.join(values)}`;

    const couponIds = [...new Set(rows.map((r) => r.lcpId))];
    const batchIds = [...new Set(rows.map((r) => r.lcbId))];
    await this.recomputeCoupons(tx, couponIds);
    await this.recomputeCouponBatches(tx, batchIds);
    return rows.length;
  }

  /**
   * `14`'s recompute — plain sums, because a coupon movement is an amount and
   * the type carries the sign.
   *
   * It must NOT set `lcp_status` beyond the three ARITHMETIC states. EXPIRED,
   * CANCELLED and BLOCKED are decisions owned by the admin path and by
   * `couponExpiryRun()`, and a recompute that wrote one would resurrect a
   * cancelled voucher the next time anything touched it.
   */
  private async recomputeCoupons(tx: Prisma.TransactionClient, couponIds: string[]): Promise<void> {
    const ids = [...new Set(couponIds)].filter(Boolean);
    if (ids.length === 0) {
      return;
    }

    await tx.$executeRaw`
      UPDATE sales.loyalty_coupon c
         SET lcp_used_value   = COALESCE(s.used, 0),
             lcp_topup_value  = COALESCE(s.topup, 0),
             lcp_use_count    = COALESCE(s.use_count, 0),
             lcp_last_used_on = s.last_used_on,
             lcp_status       = CASE
                 -- Only the three arithmetic states. A decision state is left
                 -- exactly as the admin path or the sweep set it.
                 WHEN c.lcp_status IN ('EXPIRED','CANCELLED','BLOCKED') THEN c.lcp_status
                 WHEN (c.lcp_face_value + COALESCE(s.topup,0) - COALESCE(s.used,0)) <= 0 THEN 'REDEEMED'
                 WHEN COALESCE(s.used, 0) > 0 THEN 'PARTIAL'
                 ELSE 'ISSUED'
             END,
             lcp_modified_on  = now()
        FROM unnest(${ids}::uuid[]) AS k(coupon_id)
        LEFT JOIN LATERAL (
              SELECT SUM(t.lct_amount) FILTER (
                       WHERE t.lct_txn_type IN ('REDEEM','EXPIRE','CANCEL'))        AS used,
                     SUM(t.lct_amount) FILTER (WHERE t.lct_txn_type = 'TOPUP')      AS topup,
                     COUNT(*) FILTER (
                       WHERE t.lct_txn_type = 'REDEEM' AND t.lct_amount > 0)        AS use_count,
                     MAX(t.lct_txn_date)                                            AS last_used_on
                FROM sales.loyalty_coupon_txn t
               WHERE t.lct_lcp_id     = k.coupon_id
                 AND t.lct_is_deleted = false
             ) s ON true
       WHERE c.lcp_id = k.coupon_id`;
  }

  /**
   * `lcb_issued_count` / `lcb_redeemed_count`.
   *
   * The issue cap `lcb_max_issue_count` is checked by the service when it
   * ISSUES, never here: a recompute reports, it does not refuse. Two tills
   * offline can both issue the last voucher of a batch and the second push
   * must still be recorded — `ix_lcb_overdrawn` is the report.
   */
  private async recomputeCouponBatches(
    tx: Prisma.TransactionClient,
    batchIds: string[],
  ): Promise<void> {
    const ids = [...new Set(batchIds)].filter(Boolean);
    if (ids.length === 0) {
      return;
    }

    await tx.$executeRaw`
      UPDATE sales.loyalty_coupon_batch b
         SET lcb_issued_count   = COALESCE(s.issued, 0),
             lcb_redeemed_count = COALESCE(s.redeemed, 0),
             lcb_modified_on    = now()
        FROM unnest(${ids}::uuid[]) AS k(batch_id)
        LEFT JOIN LATERAL (
              SELECT COUNT(*)                                                  AS issued,
                     COUNT(*) FILTER (WHERE c.lcp_status = 'REDEEMED')         AS redeemed
                FROM sales.loyalty_coupon c
               WHERE c.lcp_lcb_id     = k.batch_id
                 AND c.lcp_is_deleted = false
             ) s ON true
       WHERE b.lcb_id = k.batch_id`;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Small reads the earning arithmetic needs
  // ═════════════════════════════════════════════════════════════════════════

  private async schemeItems(tx: Prisma.TransactionClient, lscId: string): Promise<ItemRule[]> {
    const rows = await tx.$queryRaw<
      {
        lsi_id: string;
        lsi_kind: string;
        lsi_item_id: string | null;
        lsi_group_id: string | null;
        lsi_category_id: string | null;
        lsi_brand_id: string | null;
        lsi_section_id: string | null;
        lsi_is_exclude: boolean;
        lsi_factor: Prisma.Decimal | null;
        lsi_points: Prisma.Decimal | null;
        lsi_max_points: Prisma.Decimal | null;
        lsi_match_priority: number | null;
      }[]
    >`
      SELECT lsi_id, lsi_kind, lsi_item_id, lsi_group_id, lsi_category_id,
             lsi_brand_id, lsi_section_id, lsi_is_exclude, lsi_factor,
             lsi_points, lsi_max_points, lsi_match_priority
        FROM sales.loyalty_scheme_item
       WHERE lsi_lsc_id     = ${lscId}::uuid
         AND lsi_is_deleted = false
         AND lsi_is_active  = true`;

    return rows.map((r) => ({
      id: r.lsi_id,
      kind: r.lsi_kind,
      itemId: r.lsi_item_id,
      groupId: r.lsi_group_id,
      categoryId: r.lsi_category_id,
      brandId: r.lsi_brand_id,
      sectionId: r.lsi_section_id,
      isExclude: r.lsi_is_exclude,
      factor: numOrNull(r.lsi_factor),
      points: numOrNull(r.lsi_points),
      maxPoints: numOrNull(r.lsi_max_points),
      matchPriority: r.lsi_match_priority ?? 0,
    }));
  }

  private async schemeSlabs(tx: Prisma.TransactionClient, lscId: string): Promise<Slab[]> {
    const rows = await tx.$queryRaw<
      {
        lss_id: string;
        lss_item_id: string | null;
        lss_exceeds: Prisma.Decimal | null;
        lss_upto: Prisma.Decimal | null;
        lss_each: Prisma.Decimal | null;
        lss_points: Prisma.Decimal | null;
        lss_factor: Prisma.Decimal | null;
        lss_max_points: Prisma.Decimal | null;
      }[]
    >`
      SELECT lss_id, lss_item_id, lss_exceeds, lss_upto, lss_each,
             lss_points, lss_factor, lss_max_points
        FROM sales.loyalty_scheme_slab
       WHERE lss_lsc_id     = ${lscId}::uuid
         AND lss_is_deleted = false
         AND lss_is_active  = true
       ORDER BY lss_exceeds NULLS FIRST, lss_slno`;

    return rows.map((r) => ({
      id: r.lss_id,
      itemId: r.lss_item_id,
      exceeds: numOrNull(r.lss_exceeds),
      upto: numOrNull(r.lss_upto),
      each: numOrNull(r.lss_each),
      points: numOrNull(r.lss_points),
      factor: numOrNull(r.lss_factor),
      maxPoints: numOrNull(r.lss_max_points),
    }));
  }

  /** Which of these rows already carry a live reversal (`ux_lld_reversal`). */
  private async reversedIds(tx: Prisma.TransactionClient, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const rows = await tx.$queryRaw<{ lld_reversal_of_id: string }[]>`
      SELECT DISTINCT lld_reversal_of_id
        FROM sales.loyalty_ledger
       WHERE lld_reversal_of_id = ANY(${ids}::uuid[])
         AND lld_is_deleted = false`;
    return new Set(rows.map((r) => r.lld_reversal_of_id));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Row shapes the raw reads come back as
// ═══════════════════════════════════════════════════════════════════════════

interface LedgerRowOut {
  lld_id: string;
  lld_acc_year: string;
  lld_comp_id: string;
  lld_branch_id: string;
  lld_member_id: string;
  lld_cust_id: string;
  lld_txn_type: string;
  lld_points: Prisma.Decimal;
  lld_lot_balance: Prisma.Decimal | null;
  lld_lot_id: string | null;
  lld_lot_acc_year: string | null;
  lld_lsc_id: string | null;
  lld_rate: Prisma.Decimal | null;
  lld_money_value: Prisma.Decimal | null;
  lld_tender_id: string | null;
  lld_tender_acc_year: string | null;
  lld_txn_date: Date;
}

interface SchemeRow {
  lsc_id: string;
  lsc_code: string;
  lsc_name: string;
  lsc_type: string;
  lsc_priority: number;
  lsc_apply_on: string;
  lsc_calc_on_amount_type: string;
  lsc_include_tax: boolean;
  lsc_bill_type: string;
  lsc_item_scope: string;
  lsc_branch_scope: string;
  lsc_cust_scope: string;
  lsc_min_bill_amount: Prisma.Decimal | null;
  lsc_max_earn_points: Prisma.Decimal | null;
  lsc_earn_on_discounted: boolean;
  lsc_earn_on_charges: boolean;
  lsc_earn_with_redeem: boolean;
  lsc_rounding_method: string;
  lsc_points_decimals: number;
  lsc_allow_point_redeem: boolean;
  lsc_redeem_value_per_point: Prisma.Decimal | null;
  lsc_min_redeem_points: Prisma.Decimal | null;
  lsc_max_redeem_points: Prisma.Decimal | null;
  lsc_max_redeem_perc: Prisma.Decimal | null;
  lsc_redeem_min_bill_amount: Prisma.Decimal | null;
  lsc_redeem_multiple: Prisma.Decimal | null;
  lsc_redeem_tender_id: string | null;
  lsc_expiry_basis: string;
  lsc_points_valid_days: number | null;
  lsc_activation_days: number | null;
  lsc_return_mode: string;
  lsc_start_date: Date | null;
  lsc_end_date: Date | null;
  lsc_pool_mode: string | null;
  lsc_allow_cross_branch_redeem: boolean;
}

interface ItemRule {
  id: string;
  kind: string;
  itemId: string | null;
  groupId: string | null;
  categoryId: string | null;
  brandId: string | null;
  sectionId: string | null;
  isExclude: boolean;
  factor: number | null;
  points: number | null;
  maxPoints: number | null;
  matchPriority: number;
}

interface Slab {
  id: string;
  itemId: string | null;
  exceeds: number | null;
  upto: number | null;
  each: number | null;
  points: number | null;
  factor: number | null;
  maxPoints: number | null;
}

interface CouponTxnRowInput {
  compId: string;
  branchId: string;
  accYear: string;
  lcpId: string;
  lcbId: string;
  custId?: string | null;
  memberId?: string | null;
  txnType: 'REDEEM' | 'TOPUP' | 'CANCEL' | 'EXPIRE';
  rowNo: number;
  /** POSITIVE. The TYPE carries the meaning; only a reversal is negative. */
  amount: number;
  txnDate: string;
  billAmount?: number;
  percentApplied?: number;
  srcModule?: string | null;
  srcDocType?: string | null;
  srcDocId?: string | null;
  srcAccYear?: string | null;
  srcDocRefno?: string | null;
  tenderId?: string | null;
  tenderAccYear?: string | null;
  reversalOfId?: string | null;
  reversalOfAccYear?: string | null;
  reversalReason?: string | null;
  approvedBy?: string | null;
  remarks?: string | null;
  createdBy?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pure helpers — no database, so the offline client can reuse them verbatim
// ═══════════════════════════════════════════════════════════════════════════

/** `lsc_valid_weekdays` is three-letter names, and `getUTCDay()` starts Sunday. */
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function toScheme(r: SchemeRow): LoyaltyScheme {
  return {
    lscId: r.lsc_id,
    code: r.lsc_code,
    name: r.lsc_name,
    type: r.lsc_type,
    priority: r.lsc_priority,
    applyOn: r.lsc_apply_on as LoyaltyScheme['applyOn'],
    amountType: r.lsc_calc_on_amount_type as LoyaltyScheme['amountType'],
    includeTax: r.lsc_include_tax,
    billType: r.lsc_bill_type,
    itemScope: r.lsc_item_scope as 'ALL' | 'LIST',
    branchScope: r.lsc_branch_scope as 'ALL' | 'LIST',
    custScope: r.lsc_cust_scope as 'ALL' | 'LIST',
    minBillAmount: Number(r.lsc_min_bill_amount ?? 0),
    maxEarnPoints: numOrNull(r.lsc_max_earn_points),
    earnOnDiscounted: r.lsc_earn_on_discounted,
    earnOnCharges: r.lsc_earn_on_charges,
    earnWithRedeem: r.lsc_earn_with_redeem,
    rounding: r.lsc_rounding_method as LoyaltyScheme['rounding'],
    pointsDecimals: r.lsc_points_decimals ?? 0,
    allowPointRedeem: r.lsc_allow_point_redeem,
    redeemValuePerPoint: Number(r.lsc_redeem_value_per_point ?? 0),
    minRedeemPoints: Number(r.lsc_min_redeem_points ?? 0),
    maxRedeemPoints: numOrNull(r.lsc_max_redeem_points),
    maxRedeemPerc: numOrNull(r.lsc_max_redeem_perc),
    redeemMinBillAmount: Number(r.lsc_redeem_min_bill_amount ?? 0),
    redeemMultiple: numOrNull(r.lsc_redeem_multiple),
    redeemTenderId: r.lsc_redeem_tender_id,
    expiryBasis: r.lsc_expiry_basis as LoyaltyScheme['expiryBasis'],
    pointsValidDays: r.lsc_points_valid_days,
    activationDays: r.lsc_activation_days ?? 0,
    returnMode: r.lsc_return_mode as LoyaltyScheme['returnMode'],
    startDate: dateStr(r.lsc_start_date),
    endDate: dateStr(r.lsc_end_date),
    poolMode: r.lsc_pool_mode,
    allowCrossBranchRedeem: r.lsc_allow_cross_branch_redeem,
  };
}

/**
 * The item rules are five kinds of statement about one line, so the MOST
 * SPECIFIC wins: the item itself beats its group, which beats its category,
 * and so on. `lsi_match_priority` overrides that when somebody has set it.
 */
const KIND_SPECIFICITY: Record<string, number> = {
  ITEM: 5,
  ITEM_GROUP: 4,
  ITEM_CATEGORY: 3,
  ITEM_BRAND: 2,
  ITEM_SECTION: 1,
};

function ruleMatchesLine(
  rule: ItemRule,
  line: {
    itemId: string;
    groupId: string | null;
    categoryId: string | null;
    brandId: string | null;
    sectionId: string | null;
  },
): boolean {
  switch (rule.kind) {
    case 'ITEM':
      return rule.itemId !== null && rule.itemId === line.itemId;
    case 'ITEM_GROUP':
      return rule.groupId !== null && rule.groupId === line.groupId;
    case 'ITEM_CATEGORY':
      return rule.categoryId !== null && rule.categoryId === line.categoryId;
    case 'ITEM_BRAND':
      return rule.brandId !== null && rule.brandId === line.brandId;
    case 'ITEM_SECTION':
      return rule.sectionId !== null && rule.sectionId === line.sectionId;
    default:
      return false;
  }
}

function matchItemRule(
  line: Parameters<typeof ruleMatchesLine>[1],
  rules: ItemRule[],
): ItemRule | null {
  const hits = rules.filter((r) => !r.isExclude && ruleMatchesLine(r, line));
  if (hits.length === 0) {
    return null;
  }
  return hits.sort(
    (a, b) =>
      b.matchPriority - a.matchPriority ||
      (KIND_SPECIFICITY[b.kind] ?? 0) - (KIND_SPECIFICITY[a.kind] ?? 0),
  )[0];
}

/** An exclusion beats every inclusion — that is what `lsi_is_exclude` is for. */
function excludedByItemRule(
  line: Parameters<typeof ruleMatchesLine>[1],
  rules: ItemRule[],
): boolean {
  return rules.some((r) => r.isExclude && ruleMatchesLine(r, line));
}

/**
 * The slab covering this base. `lss_exceeds` is exclusive and `lss_upto`
 * inclusive, which is how a "10,001 to 20,000" band is normally written.
 * An item-scoped slab beats an unscoped one.
 */
function matchSlab(base: number, slabs: Slab[], itemId: string | null): Slab | null {
  const hits = slabs.filter(
    (s) =>
      (s.itemId === null || s.itemId === itemId) &&
      (s.exceeds === null || base > s.exceeds) &&
      (s.upto === null || base <= s.upto),
  );
  if (hits.length === 0) {
    return null;
  }
  return hits.sort((a, b) => (b.itemId ? 1 : 0) - (a.itemId ? 1 : 0))[0];
}

/**
 * Turn a base into points under one rule, and it is the same shape for a slab
 * and for an item rule:
 *
 *   `each`   → so many points for every whole block of `each` (a "1 point per
 *              ₹100" rule, and the FLOOR is deliberate: a part block earns
 *              nothing);
 *   `points` → a flat award for qualifying at all;
 *   `factor` → points per unit of base.
 *
 * `maxPoints` caps whichever applied.
 */
function award(
  base: number,
  rule: {
    each?: number | null;
    points?: number | null;
    factor?: number | null;
    maxPoints?: number | null;
  },
): number {
  let p = 0;
  if (rule.each && rule.each > 0) {
    p = Math.floor(base / rule.each) * (rule.points ?? 0);
  } else if (rule.points && rule.points > 0) {
    p = rule.points;
  } else if (rule.factor && rule.factor > 0) {
    p = base * rule.factor;
  }
  if (rule.maxPoints !== null && rule.maxPoints !== undefined && rule.maxPoints > 0) {
    p = Math.min(p, rule.maxPoints);
  }
  return p;
}

/** `lsc_expiry_basis` — when this lot lapses, decided once at earn time. */
function lotExpiry(scheme: LoyaltyScheme, docDate: string): string | null {
  const d = new Date(`${docDate}T00:00:00Z`);
  switch (scheme.expiryBasis) {
    case 'EARN_DATE':
      return addDays(docDate, scheme.pointsValidDays ?? 0);
    case 'MONTH_END':
      return isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
    case 'YEAR_END':
      // The financial year, April to March — not the calendar year.
      return d.getUTCMonth() + 1 >= 4
        ? `${d.getUTCFullYear() + 1}-03-31`
        : `${d.getUTCFullYear()}-03-31`;
    case 'SCHEME_END_DATE':
      return scheme.endDate;
    default:
      return null; // NONE — never expires, and sorts last in lots().
  }
}

function roundPoints(value: number, method: LoyaltyScheme['rounding'], decimals: number): number {
  const f = Math.pow(10, Math.max(0, decimals));
  switch (method) {
    case 'FLOOR':
      return Math.floor(value * f) / f;
    case 'CEIL':
      return Math.ceil(value * f) / f;
    case 'NONE':
      return value;
    default:
      return Math.round(value * f) / f;
  }
}

function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  // Nudge by an epsilon before rounding: 1.005 is stored as 1.00499999… in
  // binary floating point and would otherwise round DOWN.
  return Math.round((value + Number.EPSILON * Math.sign(value || 1)) * f) / f;
}

/**
 * Pass numerics to Postgres as TEXT and cast there.
 *
 * Prisma sends a JS number as float8, and float8 → numeric re-introduces the
 * very binary error that numeric(18,4) exists to avoid. A string cast to
 * numeric is exact.
 */
function dec(value: number, decimals: number): string {
  return round(value, decimals).toFixed(decimals);
}

function numOrNull(v: Prisma.Decimal | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateStr(d: Date | null): string | null {
  return d === null ? null : isoDate(d);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function today(): string {
  return isoDate(new Date());
}

/**
 * A DETERMINISTIC uuid from a seed string, which is what makes a sweep safe to
 * re-run: the same company on the same day produces the same `src_doc_id`, and
 * `ux_lld_src_row` rejects the second set of rows instead of writing them.
 *
 * `md5(seed)` exactly as `13` and `14` specify, laid out as a uuid. The version
 * and variant nibbles are NOT forced — a v4-shaped id would no longer be the
 * md5 the contract names, and the sweeps on the till have to derive the same id
 * from the same recipe.
 */
function deterministicUuid(seed: string): string {
  const hex = createHash('md5').update(seed, 'utf8').digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
