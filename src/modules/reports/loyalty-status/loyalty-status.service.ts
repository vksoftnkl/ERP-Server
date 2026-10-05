import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMenuRight, type MenuRight } from '../../../common/posting/rights';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { looseSearchSql } from '../../../common/search/loose-search';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  throwBadRequest,
  throwNotFound,
  throwUnprocessable,
} from 'src/common/utils/module-service.utils';
import { LoyaltyLedgerService } from '../../sales/posting/loyalty-ledger.service';
import { LOYALTY_LOT_TXN_TYPES } from '../../sales/posting/types/loyalty.types';
import type {
  LoyaltyStatusCalendarDto,
  LoyaltyStatusExpiringDto,
  LoyaltyStatusExportDto,
  LoyaltyStatusGiftsDto,
  LoyaltyStatusMemberDto,
  LoyaltyStatusMembersDto,
  LoyaltyStatusMonthlyDto,
  LoyaltyStatusSchemesDto,
  LoyaltyStatusStatementDto,
  MemberStatus,
  SortOrder,
} from './dto/loyalty-status-query.dto';
import {
  LOYALTY_STATUS_ERROR,
  type BestGift,
  type CalendarPayload,
  type ExpiringItem,
  type ExpiringPayload,
  type ExpiringSummary,
  type ExportPayload,
  type GiftsPayload,
  type LotState,
  type MemberItem,
  type MemberPayload,
  type MembersPayload,
  type MembersSummary,
  type MonthlyPayload,
  type SchemeItem,
  type SchemesPayload,
  type StatementPayload,
  type StatementRow,
} from './types/loyalty-status.types';

/**
 * Loyalty Status — a read-only report over the customer loyalty wallets
 * (plan 2026-10-05). It writes nothing; the screen's two actions live in
 * sales/loyalty/members.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ONE SET OF DEFINITIONS (plan §4) — `lotsLateral` and `giftLateral`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   open lot     a ledger row of a lot type (LOYALTY_LOT_TXN_TYPES — the same
 *                constant LoyaltyLedgerService reads), not deleted, with
 *                lld_lot_balance > 0
 *   redeemable   Σ lot balance of open lots with active_from ≤ today ≤ expires_on
 *                — exactly LoyaltyLedgerService.redeemable() (D1: the single-
 *                member card calls that method; the lists copy its WHERE here)
 *   cooling      Σ of open lots whose active_from > today
 *   lapsed       Σ of open lots whose expires_on < today — lapsed, not yet swept
 *   value ₹      each lot × ITS scheme's rate (D4), the member's scheme when
 *                the lot names none; a scheme that does not price points
 *                prices nothing, and a value with nothing priced is NULL
 *   best gift    the scheme's dearest live gift the REDEEMABLE points can buy
 *   eligible     best gift exists AND lmb_status = 'ACTIVE'
 *
 * "Today" is CURRENT_DATE of the database session, which runs in the
 * company's zone (Asia/Kolkata) — never the Node process's UTC date (§8).
 * Every date leaves the database as text (`::text`) for the same reason.
 */

export const LOYALTY_STATUS_MENU_ID = 79;
const CODE_PREFIX = 'LST';
const EXPORT_ROW_CAP = 20_000;
const DEFAULT_LIMIT = 50;
const LOT_TYPES: string[] = [...LOYALTY_LOT_TXN_TYPES];
const LIVE_STATUSES: MemberStatus[] = ['ACTIVE', 'SUSPENDED'];
const ALL_STATUSES: MemberStatus[] = ['ACTIVE', 'SUSPENDED', 'CLOSED', 'MERGED'];

interface Scope {
  companyId: string;
  branchId: string | null;
  /** YYYY-MM-DD, company-local. */
  today: string;
}

interface Page {
  limit: number;
  offset: number;
}

interface MemberBaseRow {
  member_id: string;
  cust_id: string;
  card_no: string | null;
  customer_name: string | null;
  mobile: string | null;
  lsc_id: string | null;
  scheme_name: string | null;
  status: MemberStatus;
  earned: Prisma.Decimal | null;
  bills: bigint | number | null;
  redeemed: Prisma.Decimal;
  expired: Prisma.Decimal;
  gift: Prisma.Decimal;
  adjusted: Prisma.Decimal;
  balance: Prisma.Decimal | null;
  redeemable: Prisma.Decimal;
  cooling: Prisma.Decimal;
  lapsed: Prisma.Decimal;
  lotted: Prisma.Decimal;
  next_expiry_on: string | null;
  next_expiry_points: Prisma.Decimal;
  priced_value: Prisma.Decimal;
  priced_points: Prisma.Decimal;
  expiring30: Prisma.Decimal;
  ms_rate: Prisma.Decimal | null;
  lsg_id: string | null;
  lsg_item_id: string | null;
  gift_name: string | null;
  gift_points: Prisma.Decimal | null;
  lsg_repeat: boolean | null;
  lsg_max_qty_per_bill: Prisma.Decimal | null;
  eligible: boolean;
  last_activity_on: string | null;
  enrolled_on: string;
  branch_id: string | null;
  branch_name: string | null;
  lifetime_bill_amt: Prisma.Decimal;
  lifetime_bill_cnt: number;
  last_earn_on: string | null;
  last_redeem_on: string | null;
  block_reason: string | null;
  rule_allow_point: boolean | null;
  rule_allow_gift: boolean | null;
  rule_rate: Prisma.Decimal | null;
  rule_min: Prisma.Decimal | null;
  rule_max: Prisma.Decimal | null;
  rule_multiple: Prisma.Decimal | null;
  rule_max_perc: Prisma.Decimal | null;
  rule_activation_days: number | null;
  rule_valid_days: number | null;
}

interface ExpiringRow {
  member_id: string;
  cust_id: string;
  customer_name: string | null;
  card_no: string | null;
  mobile: string | null;
  lsc_id: string | null;
  scheme_name: string | null;
  status: MemberStatus;
  expires_on: string;
  days_left: number;
  points: Prisma.Decimal;
  priced_value: Prisma.Decimal;
  priced_points: Prisma.Decimal;
  balance: Prisma.Decimal | null;
  last_activity_on: string | null;
  branch_id: string | null;
  branch_name: string | null;
  total_rows: bigint;
}

interface SchemeRow {
  lsc_id: string;
  lsc_name: string | null;
  lsc_code: string | null;
  lsc_status: string | null;
  lsc_is_active: boolean | null;
  lsc_is_deleted: boolean | null;
  start_date: string | null;
  end_date: string | null;
  lsc_allow_point_redeem: boolean | null;
  lsc_redeem_value_per_point: Prisma.Decimal | null;
  branch_id: string | null;
  branch_name: string | null;
  month: string | null;
  opening: Prisma.Decimal;
  outstanding: Prisma.Decimal;
  earned: Prisma.Decimal;
  redeemed: Prisma.Decimal;
  gift: Prisma.Decimal;
  expired: Prisma.Decimal;
  adjusted: Prisma.Decimal;
  bills: bigint;
}

const MEMBER_SORT: Record<string, string> = {
  customerName: 'customer_name',
  cardNo: 'card_no',
  mobile: 'mobile',
  schemeName: 'scheme_name',
  status: 'status',
  earned: 'earned',
  redeemed: 'redeemed',
  expired: 'expired',
  gift: 'gift',
  adjusted: 'adjusted',
  balance: 'balance',
  redeemable: 'redeemable',
  cooling: 'cooling',
  value: 'priced_value',
  nextExpiryOn: 'next_expiry_on',
  lastActivityOn: 'last_activity_on',
  enrolledOn: 'enrolled_on',
  branchName: 'branch_name',
};

const EXPIRING_SORT: Record<string, string> = {
  expiresOn: 'expires_on',
  daysLeft: 'days_left',
  points: 'points',
  value: 'priced_value',
  balance: 'balance',
  customerName: 'customer_name',
  cardNo: 'card_no',
  mobile: 'mobile',
  schemeName: 'scheme_name',
  status: 'status',
  lastActivityOn: 'last_activity_on',
  branchName: 'branch_name',
};

const SCHEME_SORT = new Set([
  'schemeName',
  'schemeCode',
  'status',
  'branchName',
  'month',
  'holders',
  'bills',
  'opening',
  'earned',
  'redeemed',
  'gift',
  'expired',
  'adjusted',
  'outstanding',
  'value',
  'usedPct',
]);

@Injectable()
export class LoyaltyStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly ledger: LoyaltyLedgerService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.1 — tab 1 grid + tiles
  // ═════════════════════════════════════════════════════════════════════════

  async members(q: LoyaltyStatusMembersDto): Promise<MembersPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const scope = await this.resolveScope(q, q.lscId);
    this.assertPeriod(q.earnedFrom, q.earnedTo, 'earnedFrom');
    const limit = q.limit ?? DEFAULT_LIMIT;
    const page = q.page ?? 1;
    const [rows, summary] = await Promise.all([
      this.memberRows(scope, q, { limit, offset: (page - 1) * limit }),
      this.memberSummary(scope, q),
    ]);
    return {
      asOn: scope.today,
      items: rows.items.map((r) => this.memberItem(r)),
      total: rows.total,
      summary,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.2 — the statement
  // ═════════════════════════════════════════════════════════════════════════

  async statement(q: LoyaltyStatusStatementDto): Promise<StatementPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const today = await this.today();
    await this.assertMember(q.companyId, q.memberId);
    const to = q.to ?? today;
    const from = q.from ?? null;
    this.assertPeriod(from, to, 'from');

    const rows = await this.prisma.$queryRaw<
      {
        lld_id: string;
        lld_acc_year: string;
        txn_date: string;
        txn_time: string | null;
        lld_txn_type: string;
        lld_src_doc_type: string | null;
        lld_src_doc_id: string | null;
        lld_src_acc_year: string | null;
        lld_src_doc_refno: string | null;
        lld_lsc_id: string | null;
        lsc_name: string | null;
        lld_remarks: string | null;
        lld_base_amount: Prisma.Decimal;
        lld_points: Prisma.Decimal;
        lld_money_value: Prisma.Decimal;
        expires_on: string | null;
        active_from: string | null;
        lld_reversal_of_id: string | null;
        lld_reversal_reason: string | null;
        lld_lot_id: string | null;
        approver: string | null;
        running: Prisma.Decimal;
      }[]
    >`
      WITH rows AS (
        SELECT l.lld_id, l.lld_acc_year, l.lld_txn_date::text AS txn_date,
               l.lld_txn_time::text AS txn_time, l.lld_txn_type, l.lld_src_doc_type,
               l.lld_src_doc_id, l.lld_src_acc_year, l.lld_src_doc_refno, l.lld_lsc_id,
               s.lsc_name, l.lld_remarks, l.lld_base_amount, l.lld_points, l.lld_money_value,
               l.lld_expires_on::text AS expires_on, l.lld_active_from::text AS active_from,
               l.lld_reversal_of_id, l.lld_reversal_reason, l.lld_lot_id, l.lld_row_no,
               u.usr_display_name AS approver,
               EXISTS (SELECT 1 FROM sales.loyalty_ledger r
                        WHERE r.lld_reversal_of_id = l.lld_id AND r.lld_is_deleted = false) AS is_reversed
          FROM sales.loyalty_ledger l
          LEFT JOIN sales.loyalty_scheme s ON s.lsc_id = l.lld_lsc_id
          LEFT JOIN public.user_master u ON u.usr_id = l.lld_approved_by
         WHERE l.lld_member_id  = ${q.memberId}::uuid
           AND l.lld_is_deleted = false
           AND l.lld_txn_date  <= ${to}::date
      ),
      visible AS (
        -- showReversals = false hides BOTH halves of a reversed pair (§5.2).
        SELECT * FROM rows
         WHERE ${q.showReversals ?? true}::boolean
            OR (lld_reversal_of_id IS NULL AND NOT is_reversed)
      )
      SELECT v.*,
             SUM(v.lld_points) OVER (
               ORDER BY v.txn_date, v.txn_time NULLS FIRST, v.lld_row_no, v.lld_id
               ROWS UNBOUNDED PRECEDING) AS running
        FROM visible v
       ORDER BY v.txn_date, v.txn_time NULLS FIRST, v.lld_row_no, v.lld_id`;

    const inRange = rows.filter((r) => from === null || r.txn_date >= from);
    const before = rows.filter((r) => from !== null && r.txn_date < from);
    const opening = before.length === 0 ? 0 : num(before[before.length - 1].running);
    const out: StatementRow[] = inRange.map((r) => ({
      lldId: r.lld_id,
      accYear: r.lld_acc_year,
      txnDate: r.txn_date,
      txnTime: r.txn_time,
      txnType: r.lld_txn_type,
      srcDocType: r.lld_src_doc_type,
      srcDocId: r.lld_src_doc_id,
      srcAccYear: r.lld_src_acc_year,
      srcDocRefno: r.lld_src_doc_refno,
      lscId: r.lld_lsc_id,
      schemeName: r.lsc_name,
      reason: reasonOf(r),
      baseAmount: money(r.lld_base_amount),
      points: num(r.lld_points),
      runningBalance: num(r.running),
      expiresOn: r.expires_on,
      activeFrom: r.active_from,
      isReversal: r.lld_reversal_of_id !== null,
      reversalOfId: r.lld_reversal_of_id,
      lotId: r.lld_lot_id,
    }));
    const closing = out.length === 0 ? opening : out[out.length - 1].runningBalance;
    return { memberId: q.memberId, from, to, opening, rows: out, closing };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.3 — the member card
  // ═════════════════════════════════════════════════════════════════════════

  async member(q: LoyaltyStatusMemberDto): Promise<MemberPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const scope = await this.resolveScope({ companyId: q.companyId });
    const base = await this.prisma.$queryRaw<MemberBaseRow[]>`
      ${this.memberBase(scope, Prisma.sql`m.lmb_id = ${q.memberId}::uuid`, null)}`;
    const r = base[0];
    if (!r) {
      throwNotFound(
        'Loyalty member not found',
        'memberId',
        `No live member ${q.memberId} in this company`,
      );
    }

    const [redeemable, lots] = await Promise.all([
      // D1 (a): the till's own number, not a copy of its WHERE clause.
      this.ledger.redeemable(q.memberId, scope.today),
      this.prisma.$queryRaw<
        {
          lld_id: string;
          lld_acc_year: string;
          lld_txn_type: string;
          txn_date: string;
          lld_src_doc_refno: string | null;
          lld_lsc_id: string | null;
          lld_points: Prisma.Decimal;
          lld_consumed_points: Prisma.Decimal;
          lld_lot_balance: Prisma.Decimal;
          expires_on: string | null;
          active_from: string | null;
        }[]
      >`
        SELECT lld_id, lld_acc_year, lld_txn_type, lld_txn_date::text AS txn_date,
               lld_src_doc_refno, lld_lsc_id, lld_points, lld_consumed_points, lld_lot_balance,
               lld_expires_on::text AS expires_on, lld_active_from::text AS active_from
          FROM sales.loyalty_ledger
         WHERE lld_member_id  = ${q.memberId}::uuid
           AND lld_txn_type   = ANY(${LOT_TYPES}::text[])
           AND lld_is_deleted = false
           AND lld_lot_balance > 0
         -- LoyaltyLedgerService.lots()'s order, the product's one opinion on FIFO.
         ORDER BY lld_expires_on NULLS LAST, lld_txn_date, lld_id`,
    ]);

    const item = this.memberItem(r);
    const lotItems = lots.map((l) => {
      const state: LotState =
        l.expires_on !== null && l.expires_on < scope.today
          ? 'LAPSED'
          : l.active_from !== null && l.active_from > scope.today
            ? 'COOLING'
            : 'REDEEMABLE';
      return {
        lotId: l.lld_id,
        accYear: l.lld_acc_year,
        txnType: l.lld_txn_type,
        earnedOn: l.txn_date,
        srcDocRefno: l.lld_src_doc_refno,
        lscId: l.lld_lsc_id,
        points: num(l.lld_points),
        used: num(l.lld_consumed_points),
        left: num(l.lld_lot_balance),
        expiresOn: l.expires_on,
        activeFrom: l.active_from,
        state,
      };
    });
    const coolingFrom = lotItems
      .filter((l) => l.state === 'COOLING')
      .map((l) => l.activeFrom as string)
      .sort()[0];
    const lotted = lotItems.reduce((s, l) => s + l.left, 0);

    return {
      asOn: scope.today,
      card: {
        memberId: r.member_id,
        custId: r.cust_id,
        customerName: r.customer_name,
        cardNo: r.card_no,
        mobile: r.mobile,
        enrolledOn: r.enrolled_on,
        lifetimeBillAmt: money(r.lifetime_bill_amt),
        lifetimeBillCnt: Number(r.lifetime_bill_cnt ?? 0),
        lastEarnOn: r.last_earn_on,
        lastRedeemOn: r.last_redeem_on,
        lastActivityOn: r.last_activity_on,
        status: r.status,
        blockReason: r.block_reason,
        lscId: r.lsc_id,
        schemeName: r.scheme_name,
        branchId: r.branch_id,
        branchName: r.branch_name,
      },
      balance: item.balance,
      redeemable,
      cooling: item.cooling,
      coolingFrom: coolingFrom ?? null,
      lapsed: item.lapsed,
      lots: lotItems,
      bestGift: item.bestGift,
      eligible: item.eligible,
      tenderValue: item.value,
      rules:
        r.lsc_id === null
          ? null
          : {
              allowPointRedeem: r.rule_allow_point === true,
              allowGiftRedeem: r.rule_allow_gift === true,
              redeemValuePerPoint:
                r.rule_rate === null ? null : new Prisma.Decimal(r.rule_rate).toFixed(4),
              minRedeemPoints: num(r.rule_min),
              maxRedeemPoints: num(r.rule_max),
              redeemMultiple: num(r.rule_multiple),
              maxRedeemPerc: num(r.rule_max_perc),
              activationDays: Number(r.rule_activation_days ?? 0),
              pointsValidDays: Number(r.rule_valid_days ?? 0),
            },
      unlotted: round4(item.balance - lotted),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.4 — tab 2 grid + tiles
  // ═════════════════════════════════════════════════════════════════════════

  async expiring(q: LoyaltyStatusExpiringDto): Promise<ExpiringPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const scope = await this.resolveScope(q, q.lscId);
    const limit = q.limit ?? DEFAULT_LIMIT;
    const page = q.page ?? 1;
    const withinDays = q.withinDays ?? 30;
    const [rows, summary] = await Promise.all([
      this.expiringRows(scope, q, withinDays, { limit, offset: (page - 1) * limit }),
      this.expiringSummary(scope, q, withinDays),
    ]);
    return {
      asOn: scope.today,
      withinDays,
      items: rows.items.map((r) => this.expiringItem(r)),
      total: rows.total,
      summary,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.5 — tab 2 chart
  // ═════════════════════════════════════════════════════════════════════════

  async calendar(q: LoyaltyStatusCalendarDto): Promise<CalendarPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const scope = await this.resolveScope(q, q.lscId);
    const days = q.days ?? 90;
    const rows = await this.prisma.$queryRaw<
      { week_start: string; points: Prisma.Decimal | null; members: bigint }[]
    >`
      WITH w AS (
        SELECT generate_series(
                 date_trunc('week', ${scope.today}::date)::date,
                 date_trunc('week', ${scope.today}::date + ${days}::int)::date,
                 interval '7 days')::date AS week_start
      )
      SELECT w.week_start::text AS week_start,
             COALESCE(SUM(l.lld_lot_balance), 0) AS points,
             COUNT(DISTINCT l.lld_member_id)     AS members
        FROM w
        LEFT JOIN sales.loyalty_ledger l
          ON date_trunc('week', l.lld_expires_on)::date = w.week_start
         AND l.lld_comp_id    = ${scope.companyId}::uuid
         AND l.lld_is_deleted = false
         AND l.lld_txn_type   = ANY(${LOT_TYPES}::text[])
         AND l.lld_lot_balance > 0
         AND l.lld_expires_on BETWEEN ${scope.today}::date AND ${scope.today}::date + ${days}::int
         AND (${q.lscId ?? null}::uuid IS NULL OR l.lld_lsc_id = ${q.lscId ?? null}::uuid)
        LEFT JOIN sales.loyalty_member m ON m.lmb_id = l.lld_member_id
       WHERE l.lld_id IS NULL
          OR (m.lmb_is_deleted = false
              AND (${scope.branchId}::uuid IS NULL OR m.lmb_branch_id = ${scope.branchId}::uuid))
       GROUP BY w.week_start
       ORDER BY w.week_start`;
    return {
      asOn: scope.today,
      days,
      weeks: rows.map((r) => ({
        weekStart: r.week_start,
        points: num(r.points),
        members: Number(r.members),
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.6 — tab 3 grid
  // ═════════════════════════════════════════════════════════════════════════

  async schemes(q: LoyaltyStatusSchemesDto): Promise<SchemesPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const scope = await this.resolveScope(q, q.lscId);
    this.assertPeriod(q.from, q.to, 'from');
    const split = q.splitBy ?? 'scheme';
    const items = await this.schemeRows(scope, q, split);
    const sorted = this.sortSchemes(items, q.sort, q.order);
    const summary = {
      bills: sorted.reduce((s, i) => s + i.bills, 0),
      opening: round4(sorted.reduce((s, i) => s + i.opening, 0)),
      earned: round4(sorted.reduce((s, i) => s + i.earned, 0)),
      redeemed: round4(sorted.reduce((s, i) => s + i.redeemed, 0)),
      gift: round4(sorted.reduce((s, i) => s + i.gift, 0)),
      expired: round4(sorted.reduce((s, i) => s + i.expired, 0)),
      adjusted: round4(sorted.reduce((s, i) => s + i.adjusted, 0)),
      outstanding: round4(sorted.reduce((s, i) => s + i.outstanding, 0)),
      value: sorted.reduce((s, i) => s.plus(i.value ?? 0), new Prisma.Decimal(0)).toFixed(2),
    };
    return {
      asOn: scope.today,
      from: q.from,
      to: q.to,
      splitBy: split,
      items: sorted,
      total: sorted.length,
      summary,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.7 — tab 3 bottom left
  // ═════════════════════════════════════════════════════════════════════════

  async monthly(q: LoyaltyStatusMonthlyDto): Promise<MonthlyPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const scope = await this.resolveScope(q, q.lscId);
    this.assertPeriod(q.from, q.to, 'from');
    const [scheme] = await this.prisma.$queryRaw<{ lsc_name: string }[]>`
      SELECT lsc_name FROM sales.loyalty_scheme WHERE lsc_id = ${q.lscId}::uuid`;
    const rows = await this.prisma.$queryRaw<
      {
        month: string;
        earned: Prisma.Decimal;
        redeemed_gift: Prisma.Decimal;
        expired: Prisma.Decimal;
        adjusted: Prisma.Decimal;
      }[]
    >`
      WITH months AS (
        SELECT generate_series(
                 date_trunc('month', ${q.from}::date)::date,
                 date_trunc('month', ${q.to}::date)::date,
                 interval '1 month')::date AS month
      )
      SELECT mo.month::text AS month,
             COALESCE( SUM(l.lld_points) FILTER (WHERE l.lld_txn_type IN ('EARN', 'OPENING')), 0)   AS earned,
             COALESCE(-SUM(l.lld_points) FILTER (WHERE l.lld_txn_type IN ('REDEEM', 'GIFT')), 0)     AS redeemed_gift,
             COALESCE(-SUM(l.lld_points) FILTER (WHERE l.lld_txn_type = 'EXPIRE'), 0)                AS expired,
             COALESCE( SUM(l.lld_points) FILTER (WHERE l.lld_txn_type IN ('ADJUST', 'TRANSFER')), 0) AS adjusted
        FROM months mo
        LEFT JOIN sales.loyalty_ledger l
          ON date_trunc('month', l.lld_txn_date)::date = mo.month
         AND l.lld_comp_id    = ${scope.companyId}::uuid
         AND l.lld_is_deleted = false
         AND l.lld_lsc_id     = ${q.lscId}::uuid
         AND l.lld_txn_date BETWEEN ${q.from}::date AND ${q.to}::date
         AND (${scope.branchId}::uuid IS NULL OR l.lld_branch_id = ${scope.branchId}::uuid)
       GROUP BY mo.month
       ORDER BY mo.month`;
    return {
      lscId: q.lscId,
      schemeName: scheme?.lsc_name ?? '',
      from: q.from,
      to: q.to,
      months: rows.map((r) => {
        const start = r.month;
        const end = monthEnd(r.month);
        return {
          month: r.month.slice(0, 7),
          earned: num(r.earned),
          redeemedPlusGift: num(r.redeemed_gift),
          expired: num(r.expired),
          adjusted: num(r.adjusted),
          partial: q.from > start || q.to < end,
        };
      }),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.8 — tab 3 bottom right
  // ═════════════════════════════════════════════════════════════════════════

  async gifts(q: LoyaltyStatusGiftsDto): Promise<GiftsPayload> {
    await this.assertRight('view', 'view the Loyalty Status');
    const scope = await this.resolveScope(q, q.lscId);
    this.assertPeriod(q.from, q.to, 'from');
    const [scheme] = await this.prisma.$queryRaw<{ lsc_name: string }[]>`
      SELECT lsc_name FROM sales.loyalty_scheme WHERE lsc_id = ${q.lscId}::uuid`;
    const rows = await this.prisma.$queryRaw<
      {
        lsg_id: string;
        lsg_slno: number;
        lsg_item_id: string;
        item_name_en: string;
        lsg_item_qty: Prisma.Decimal;
        lsg_redeem_points: Prisma.Decimal;
        lsg_repeat: boolean;
        lsg_max_qty_per_bill: Prisma.Decimal | null;
        lsg_stock_check: boolean;
        valid_from: string | null;
        valid_upto: string | null;
        lsg_is_active: boolean;
        eligible_members: bigint;
        issued: Prisma.Decimal;
        in_stock: Prisma.Decimal | null;
      }[]
    >`
      SELECT g.lsg_id, g.lsg_slno, g.lsg_item_id, i.item_name_en, g.lsg_item_qty,
             g.lsg_redeem_points, g.lsg_repeat, g.lsg_max_qty_per_bill, g.lsg_stock_check,
             g.lsg_valid_from::text AS valid_from, g.lsg_valid_upto::text AS valid_upto,
             g.lsg_is_active,
             -- Against THIS gift's points, not the best gift: a member eligible
             -- for the mixer is eligible for the flask too (§5.8).
             (SELECT COUNT(*)
                FROM sales.loyalty_member m
               WHERE m.lmb_lsc_id     = g.lsg_lsc_id
                 AND m.lmb_comp_id    = ${scope.companyId}::uuid
                 AND m.lmb_is_deleted = false
                 AND m.lmb_status     = 'ACTIVE'
                 AND (${scope.branchId}::uuid IS NULL OR m.lmb_branch_id = ${scope.branchId}::uuid)
                 AND (SELECT COALESCE(SUM(l.lld_lot_balance), 0)
                        FROM sales.loyalty_ledger l
                       WHERE l.lld_member_id  = m.lmb_id
                         AND l.lld_txn_type   = ANY(${LOT_TYPES}::text[])
                         AND l.lld_is_deleted = false
                         AND l.lld_lot_balance > 0
                         AND (l.lld_active_from IS NULL OR l.lld_active_from <= ${scope.today}::date)
                         AND (l.lld_expires_on  IS NULL OR l.lld_expires_on  >= ${scope.today}::date)
                     ) >= g.lsg_redeem_points) AS eligible_members,
             (SELECT COALESCE(SUM(d.lgd_qty), 0)
                FROM sales.loyalty_gift_redeem_item d
                JOIN sales.loyalty_gift_redeem h
                  ON h.lgr_id = d.lgd_lgr_id AND h.lgr_acc_year = d.lgd_lgr_acc_year
               WHERE d.lgd_is_deleted = false
                 AND h.lgr_is_deleted = false
                 AND h.lgr_status     = 'CONFIRMED'
                 AND h.lgr_comp_id    = ${scope.companyId}::uuid
                 AND (d.lgd_lsg_id = g.lsg_id
                      OR (d.lgd_lsg_id IS NULL AND d.lgd_item_id = g.lsg_item_id
                          AND h.lgr_lsc_id = g.lsg_lsc_id))
                 AND h.lgr_redeem_date BETWEEN ${q.from}::date AND ${q.to}::date
                 AND (${scope.branchId}::uuid IS NULL OR h.lgr_branch_id = ${scope.branchId}::uuid)
             ) AS issued,
             -- D5: the sale bill's own stock read (bill-lifecycle.service.ts),
             -- SALEABLE bucket, summed over the branch or every branch.
             CASE WHEN g.lsg_stock_check THEN
               (SELECT COALESCE(SUM(sbl_available_qty), 0)
                  FROM stock.stock_balance
                 WHERE sbl_company_id = ${scope.companyId}::uuid
                   AND (${scope.branchId}::uuid IS NULL OR sbl_branch_id = ${scope.branchId}::uuid)
                   AND sbl_item_id    = g.lsg_item_id
                   AND sbl_bucket     = 'SALEABLE'
                   AND sbl_is_deleted = false)
             END AS in_stock
        FROM sales.loyalty_scheme_gift g
        JOIN inventory.item_master i ON i.item_id = g.lsg_item_id
       WHERE g.lsg_lsc_id     = ${q.lscId}::uuid
         AND g.lsg_is_deleted = false
       ORDER BY g.lsg_slno, g.lsg_id`;
    return {
      asOn: scope.today,
      lscId: q.lscId,
      schemeName: scheme?.lsc_name ?? '',
      from: q.from,
      to: q.to,
      gifts: rows.map((r) => ({
        lsgId: r.lsg_id,
        slno: r.lsg_slno,
        itemId: r.lsg_item_id,
        itemName: r.item_name_en,
        itemQty: num(r.lsg_item_qty),
        points: num(r.lsg_redeem_points),
        repeat: r.lsg_repeat,
        maxQtyPerBill: num(r.lsg_max_qty_per_bill) > 0 ? num(r.lsg_max_qty_per_bill) : null,
        stockCheck: r.lsg_stock_check,
        validFrom: r.valid_from,
        validUpto: r.valid_upto,
        isActive: r.lsg_is_active,
        eligibleMembers: Number(r.eligible_members),
        issuedInPeriod: num(r.issued),
        inStock: r.in_stock === null ? null : new Prisma.Decimal(r.in_stock).toFixed(3),
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.9 — export: the tab's rows unpaged, with the "Printed as:" line
  // ═════════════════════════════════════════════════════════════════════════

  async export(q: LoyaltyStatusExportDto): Promise<ExportPayload> {
    const format = q.format ?? 'pdf';
    await this.assertRight(
      format === 'xlsx' ? 'export' : 'print',
      format === 'xlsx' ? 'export the Loyalty Status' : 'print the Loyalty Status',
    );
    const scope = await this.resolveScope(q, q.lscId);
    const [company, branch, scheme] = await Promise.all([
      this.prisma.$queryRaw<{ comp_name: string }[]>`
        SELECT comp_name FROM public.companys WHERE comp_id = ${scope.companyId}::uuid`,
      scope.branchId
        ? this.prisma.$queryRaw<{ br_name: string }[]>`
            SELECT br_name FROM public.branch_master WHERE br_id = ${scope.branchId}::uuid`
        : Promise.resolve([]),
      q.lscId
        ? this.prisma.$queryRaw<{ lsc_name: string }[]>`
            SELECT lsc_name FROM sales.loyalty_scheme WHERE lsc_id = ${q.lscId}::uuid`
        : Promise.resolve([]),
    ]);
    const head = [
      `Loyalty Status — ${tabTitle(q.tab)}`,
      `Company: ${company[0]?.comp_name ?? scope.companyId}`,
      `Branch: ${branch[0]?.br_name ?? 'All'}`,
    ];
    const tail = [
      q.search ? `Search "${q.search}"` : null,
      q.sort ? `Sorted by ${q.sort} ${q.order ?? 'asc'}` : null,
      `As on ${dmy(scope.today)}`,
    ];
    let rows: unknown[] = [];
    let summary: unknown = null;
    let filters: (string | null)[] = [];

    switch (q.tab) {
      case 'members': {
        this.assertPeriod(q.earnedFrom, q.earnedTo, 'earnedFrom');
        const page = await this.memberRows(scope, q, { limit: EXPORT_ROW_CAP + 1, offset: 0 });
        this.assertCap(page.total);
        rows = page.items.map((r) => this.memberItem(r));
        summary = await this.memberSummary(scope, q);
        const statuses = q.status
          ? [q.status]
          : q.includeMergedClosed
            ? ALL_STATUSES
            : LIVE_STATUSES;
        filters = [
          `Scheme: ${scheme[0]?.lsc_name ?? 'All'}`,
          `Status: ${statuses.join(' / ')}`,
          (q.balanceGtZero ?? true) ? 'Balance > 0' : 'Zero balances included',
          q.eligibleOnly ? 'Eligible customers only' : null,
          q.pointsMin !== undefined || q.pointsMax !== undefined
            ? `Points ${q.pointsMin ?? 0} to ${q.pointsMax ?? '∞'}`
            : null,
          q.earnedFrom && q.earnedTo
            ? `Earned ${dmy(q.earnedFrom)} to ${dmy(q.earnedTo)}`
            : 'Earned: lifetime',
        ];
        break;
      }
      case 'expiring': {
        const withinDays = q.withinDays ?? 30;
        const page = await this.expiringRows(scope, q, withinDays, {
          limit: EXPORT_ROW_CAP + 1,
          offset: 0,
        });
        this.assertCap(page.total);
        rows = page.items.map((r) => this.expiringItem(r));
        summary = await this.expiringSummary(scope, q, withinDays);
        filters = [
          `Scheme: ${scheme[0]?.lsc_name ?? 'All'}`,
          `Expiring within ${withinDays} days`,
          (q.hasMobile ?? true) ? 'With mobile only' : null,
          (q.activeOnly ?? true) ? 'Active members only' : null,
        ];
        break;
      }
      case 'schemes': {
        if (!q.from || !q.to) {
          refuse(
            LOYALTY_STATUS_ERROR.RANGE_REVERSED,
            'from',
            'The scheme summary needs from and to.',
          );
        }
        this.assertPeriod(q.from, q.to, 'from');
        const split = q.splitBy ?? 'scheme';
        const items = this.sortSchemes(
          await this.schemeRows(scope, { ...q, from: q.from, to: q.to }, split),
          q.sort,
          q.order,
        );
        rows = items;
        summary = {
          bills: items.reduce((s, i) => s + i.bills, 0),
          outstanding: round4(items.reduce((s, i) => s + i.outstanding, 0)),
        };
        filters = [
          `Scheme: ${scheme[0]?.lsc_name ?? 'All'}`,
          `Period ${dmy(q.from)} to ${dmy(q.to)}`,
          `Split by ${split.replace('_', ' + ')}`,
          (q.includeClosedHolding ?? true)
            ? 'Closed schemes holding points included'
            : 'Closed schemes dropped',
        ];
        break;
      }
      case 'statement': {
        if (!q.memberId) {
          refuse(LOYALTY_STATUS_ERROR.MEMBER_NOT_FOUND, 'memberId', 'A statement needs memberId.');
        }
        const st = await this.statement({
          companyId: q.companyId,
          memberId: q.memberId,
          from: q.from,
          to: q.to,
          showReversals: q.showReversals,
        });
        this.assertCap(st.rows.length);
        rows = st.rows;
        summary = { opening: st.opening, closing: st.closing };
        const card = await this.prisma.$queryRaw<
          { card_no: string | null; cus_name: string | null }[]
        >`
          SELECT m.lmb_card_no AS card_no, c.cus_name
            FROM sales.loyalty_member m JOIN sales.customers c ON c.cus_id = m.lmb_cust_id
           WHERE m.lmb_id = ${q.memberId}::uuid`;
        filters = [
          `Member: ${card[0]?.cus_name ?? q.memberId}${card[0]?.card_no ? ` (${card[0].card_no})` : ''}`,
          `Period ${st.from ? dmy(st.from) : 'start'} to ${dmy(st.to)}`,
          (q.showReversals ?? true) ? null : 'Reversed pairs hidden',
        ];
        break;
      }
    }

    return {
      tab: q.tab,
      format,
      asOn: scope.today,
      printedAs: [...head, ...filters, ...tail].filter(Boolean).join(' · '),
      companyName: company[0]?.comp_name ?? null,
      branchName: branch[0]?.br_name ?? null,
      totalRows: rows.length,
      rows,
      summary,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Members — the one SELECT behind §5.1, §5.3 and the export
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * One row per wallet with everything §4 defines, computed in the database.
   * `where` is the caller's member-level filter (it may name `m`, `c`, `ms`,
   * `b`); the computed columns are filtered by the caller afterwards, in the
   * `filtered` CTE, because redeemable / eligible are not columns of any table.
   */
  private memberBase(
    scope: Scope,
    where: Prisma.Sql,
    period: { from: string; to: string } | null,
  ): Prisma.Sql {
    const earned = period
      ? Prisma.sql`
        LEFT JOIN LATERAL (
          -- "Earned in period" (§4): EARN + OPENING, reversals included, so a
          -- returned bill nets out. The same filter as recomputeMembers().
          SELECT COALESCE(SUM(l.lld_points), 0) AS earned,
                 COUNT(DISTINCT l.lld_src_doc_id)
                   FILTER (WHERE l.lld_txn_type = 'EARN' AND l.lld_points > 0) AS bills
            FROM sales.loyalty_ledger l
           WHERE l.lld_member_id  = m.lmb_id
             AND l.lld_is_deleted = false
             AND l.lld_txn_type IN ('EARN', 'OPENING')
             AND l.lld_txn_date BETWEEN ${period.from}::date AND ${period.to}::date
        ) ep ON true`
      : Prisma.sql`
        CROSS JOIN LATERAL (
          SELECT m.lmb_earned_points AS earned, m.lmb_lifetime_bill_cnt AS bills
        ) ep`;

    return Prisma.sql`
      SELECT m.lmb_id                                   AS member_id,
             m.lmb_cust_id                              AS cust_id,
             m.lmb_card_no                              AS card_no,
             c.cus_name                                 AS customer_name,
             COALESCE(NULLIF(m.lmb_mobile, ''), c.cus_phone1) AS mobile,
             m.lmb_lsc_id                               AS lsc_id,
             ms.lsc_name                                AS scheme_name,
             m.lmb_status                               AS status,
             ep.earned, ep.bills,
             m.lmb_redeemed_points                      AS redeemed,
             m.lmb_expired_points                       AS expired,
             m.lmb_gift_points                          AS gift,
             m.lmb_adjusted_points                      AS adjusted,
             m.lmb_balance_points                       AS balance,
             lots.redeemable, lots.cooling, lots.lapsed, lots.lotted,
             lots.next_expiry_on, lots.next_expiry_points,
             lots.priced_value, lots.priced_points, lots.expiring30,
             CASE WHEN ms.lsc_allow_point_redeem AND ms.lsc_redeem_value_per_point > 0
                  THEN ms.lsc_redeem_value_per_point END AS ms_rate,
             gift.lsg_id, gift.lsg_item_id, gift.item_name_en AS gift_name,
             gift.lsg_redeem_points AS gift_points, gift.lsg_repeat, gift.lsg_max_qty_per_bill,
             (gift.lsg_id IS NOT NULL AND m.lmb_status = 'ACTIVE') AS eligible,
             m.lmb_last_activity_on::text               AS last_activity_on,
             m.lmb_enrolled_on::text                    AS enrolled_on,
             m.lmb_branch_id                            AS branch_id,
             b.br_name                                  AS branch_name,
             m.lmb_lifetime_bill_amt                    AS lifetime_bill_amt,
             m.lmb_lifetime_bill_cnt                    AS lifetime_bill_cnt,
             m.lmb_last_earn_on::text                   AS last_earn_on,
             m.lmb_last_redeem_on::text                 AS last_redeem_on,
             m.lmb_block_reason                         AS block_reason,
             ms.lsc_allow_point_redeem                  AS rule_allow_point,
             ms.lsc_allow_gift_redeem                   AS rule_allow_gift,
             ms.lsc_redeem_value_per_point              AS rule_rate,
             ms.lsc_min_redeem_points                   AS rule_min,
             ms.lsc_max_redeem_points                   AS rule_max,
             ms.lsc_redeem_multiple                     AS rule_multiple,
             ms.lsc_max_redeem_perc                     AS rule_max_perc,
             ms.lsc_activation_days                     AS rule_activation_days,
             ms.lsc_points_valid_days                   AS rule_valid_days
        FROM sales.loyalty_member m
        JOIN sales.customers c             ON c.cus_id  = m.lmb_cust_id
        LEFT JOIN sales.loyalty_scheme ms  ON ms.lsc_id = m.lmb_lsc_id
        LEFT JOIN public.branch_master b   ON b.br_id   = m.lmb_branch_id
        ${this.lotsLateral(scope.today)}
        ${this.giftLateral(scope.today)}
        ${earned}
       WHERE m.lmb_comp_id    = ${scope.companyId}::uuid
         AND m.lmb_is_deleted = false
         AND ${where}`;
  }

  /**
   * The open lots of `m`, summed into the §4 numbers. ix_lld_open_lots
   * (member, expiry, date, id) INCLUDE (points, consumed, active_from, lot
   * balance) covers the scan exactly; the scheme join prices each lot (D4).
   *
   * The WHERE is LoyaltyLedgerService.lots() / redeemable() copied — type list
   * from the same constant, the date window written the same way (D1 b).
   */
  private lotsLateral(today: string): Prisma.Sql {
    return Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(q.lot_balance) FILTER (WHERE q.is_redeemable), 0)        AS redeemable,
               COALESCE(SUM(q.lot_balance) FILTER (WHERE q.is_cooling), 0)           AS cooling,
               COALESCE(SUM(q.lot_balance) FILTER (WHERE q.is_lapsed), 0)            AS lapsed,
               COALESCE(SUM(q.lot_balance), 0)                                       AS lotted,
               MIN(q.expires_on) FILTER (WHERE q.expires_on >= ${today}::date)::text AS next_expiry_on,
               COALESCE(SUM(q.lot_balance) FILTER (WHERE q.expires_on = q.next_exp), 0) AS next_expiry_points,
               COALESCE(SUM(q.lot_balance * q.rate)
                        FILTER (WHERE q.is_redeemable AND q.rate IS NOT NULL), 0)     AS priced_value,
               COALESCE(SUM(q.lot_balance)
                        FILTER (WHERE q.is_redeemable AND q.rate IS NOT NULL), 0)     AS priced_points,
               COALESCE(SUM(q.lot_balance)
                        FILTER (WHERE q.expires_on BETWEEN ${today}::date
                                                       AND ${today}::date + 30), 0)   AS expiring30
          FROM (
            SELECT l.lld_lot_balance AS lot_balance,
                   l.lld_expires_on  AS expires_on,
                   (l.lld_active_from IS NULL OR l.lld_active_from <= ${today}::date)
                     AND (l.lld_expires_on IS NULL OR l.lld_expires_on >= ${today}::date) AS is_redeemable,
                   l.lld_active_from > ${today}::date AS is_cooling,
                   l.lld_expires_on  < ${today}::date AS is_lapsed,
                   CASE WHEN COALESCE(ls.lsc_allow_point_redeem, ms.lsc_allow_point_redeem)
                         AND COALESCE(ls.lsc_redeem_value_per_point, ms.lsc_redeem_value_per_point) > 0
                        THEN COALESCE(ls.lsc_redeem_value_per_point, ms.lsc_redeem_value_per_point)
                   END AS rate,
                   MIN(l.lld_expires_on) FILTER (WHERE l.lld_expires_on >= ${today}::date) OVER () AS next_exp
              FROM sales.loyalty_ledger l
              LEFT JOIN sales.loyalty_scheme ls ON ls.lsc_id = l.lld_lsc_id
             WHERE l.lld_member_id  = m.lmb_id
               AND l.lld_txn_type   = ANY(${LOT_TYPES}::text[])
               AND l.lld_is_deleted = false
               AND l.lld_lot_balance > 0
          ) q
      ) lots ON true`;
  }

  /** Grid 570's rule on REDEEMABLE points: the dearest live gift they can buy (§4). */
  private giftLateral(today: string): Prisma.Sql {
    return Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT g.lsg_id, g.lsg_item_id, i.item_name_en, g.lsg_redeem_points,
               g.lsg_repeat, g.lsg_max_qty_per_bill
          FROM sales.loyalty_scheme_gift g
          JOIN inventory.item_master i ON i.item_id = g.lsg_item_id
         WHERE g.lsg_lsc_id     = m.lmb_lsc_id
           AND ms.lsc_allow_gift_redeem = true
           AND g.lsg_is_active  = true
           AND g.lsg_is_deleted = false
           AND (g.lsg_valid_from IS NULL OR g.lsg_valid_from <= ${today}::date)
           AND (g.lsg_valid_upto IS NULL OR g.lsg_valid_upto >= ${today}::date)
           AND g.lsg_redeem_points > 0
           AND g.lsg_redeem_points <= lots.redeemable
         ORDER BY g.lsg_redeem_points DESC, g.lsg_slno
         LIMIT 1
      ) gift ON true`;
  }

  private memberFilters(scope: Scope, q: LoyaltyStatusMembersDto | LoyaltyStatusExportDto) {
    const statuses: MemberStatus[] = q.status
      ? [q.status]
      : q.includeMergedClosed
        ? ALL_STATUSES
        : LIVE_STATUSES;
    const where = Prisma.join(
      [
        Prisma.sql`(${scope.branchId}::uuid IS NULL OR m.lmb_branch_id = ${scope.branchId}::uuid)`,
        Prisma.sql`(${q.lscId ?? null}::uuid IS NULL OR m.lmb_lsc_id = ${q.lscId ?? null}::uuid)`,
        Prisma.sql`m.lmb_status = ANY(${statuses}::text[])`,
        looseSearchSql(['m.lmb_card_no', 'm.lmb_mobile', 'c.cus_name', 'c.cus_phone1'], q.search),
      ],
      ' AND ',
    );
    const post: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q.balanceGtZero ?? true) {
      post.push(Prisma.sql`balance > 0`);
    }
    if (q.eligibleOnly) {
      post.push(Prisma.sql`eligible`);
    }
    if (q.pointsMin !== undefined) {
      post.push(Prisma.sql`balance >= ${q.pointsMin}::numeric`);
    }
    if (q.pointsMax !== undefined) {
      post.push(Prisma.sql`balance <= ${q.pointsMax}::numeric`);
    }
    const period = q.earnedFrom && q.earnedTo ? { from: q.earnedFrom, to: q.earnedTo } : null;
    const cte = Prisma.sql`
      WITH base AS (${this.memberBase(scope, where, period)}),
      filtered AS (SELECT * FROM base WHERE ${Prisma.join(post, ' AND ')})`;
    return { cte, period };
  }

  private async memberRows(
    scope: Scope,
    q: LoyaltyStatusMembersDto | LoyaltyStatusExportDto,
    page: Page,
  ): Promise<{ items: MemberBaseRow[]; total: number }> {
    const { cte } = this.memberFilters(scope, q);
    const rows = await this.prisma.$queryRaw<(MemberBaseRow & { total_rows: bigint })[]>`
      ${cte}
      SELECT f.*, COUNT(*) OVER () AS total_rows
        FROM filtered f
       ORDER BY ${this.orderBy(MEMBER_SORT, q.sort, q.order, 'customer_name')}, f.member_id
       LIMIT ${page.limit}::int OFFSET ${page.offset}::int`;
    return { items: rows, total: Number(rows[0]?.total_rows ?? 0) };
  }

  /** Over the WHOLE filtered set, never the page (§5): the tiles and the Total row read it. */
  private async memberSummary(
    scope: Scope,
    q: LoyaltyStatusMembersDto | LoyaltyStatusExportDto,
  ): Promise<MembersSummary> {
    const { cte, period } = this.memberFilters(scope, q);
    const periodCond = period
      ? Prisma.sql`l.lld_txn_date BETWEEN ${period.from}::date AND ${period.to}::date`
      : Prisma.sql`TRUE`;
    const [s] = await this.prisma.$queryRaw<
      {
        members: bigint;
        active: bigint;
        suspended: bigint;
        outstanding: Prisma.Decimal;
        outstanding_value: Prisma.Decimal;
        earned: Prisma.Decimal;
        bills: bigint;
        gift_eligible: bigint;
        expiring30_points: Prisma.Decimal;
        expiring30_members: bigint;
        redeemed: Prisma.Decimal;
        redeemed_value: Prisma.Decimal;
        gifts_low: bigint;
      }[]
    >`
      ${cte},
      agg AS (
        SELECT COUNT(*)                                        AS members,
               COUNT(*) FILTER (WHERE status = 'ACTIVE')       AS active,
               COUNT(*) FILTER (WHERE status = 'SUSPENDED')    AS suspended,
               COALESCE(SUM(balance), 0)                       AS outstanding,
               -- Σ of the rows' value (notes 91 N2): the priced redeemable lots, each at
               -- its own scheme's rate — never the member's scheme, which may be NULL.
               COALESCE(SUM(priced_value) FILTER (WHERE redeemable > 0 AND priced_points > 0), 0)
                                                               AS outstanding_value,
               COALESCE(SUM(earned), 0)                        AS earned,
               COALESCE(SUM(bills), 0)                         AS bills,
               COUNT(*) FILTER (WHERE eligible)                AS gift_eligible,
               COALESCE(SUM(expiring30), 0)                    AS expiring30_points,
               COUNT(*) FILTER (WHERE expiring30 > 0)          AS expiring30_members
          FROM filtered
      ),
      red AS (
        SELECT COALESCE(-SUM(l.lld_points), 0) AS redeemed,
               COALESCE(SUM(l.lld_money_value * CASE WHEN l.lld_points < 0 THEN 1 ELSE -1 END)
                        FILTER (WHERE l.lld_txn_type = 'REDEEM'), 0) AS redeemed_value
          FROM filtered f
          JOIN sales.loyalty_ledger l ON l.lld_member_id = f.member_id
         WHERE l.lld_is_deleted = false
           AND l.lld_txn_type IN ('REDEEM', 'GIFT')
           AND ${periodCond}
      ),
      low AS (
        -- live gifts that check stock and cannot fill even one (D5's read)
        SELECT COUNT(*) AS gifts_low
          FROM sales.loyalty_scheme_gift g
          JOIN sales.loyalty_scheme s ON s.lsc_id = g.lsg_lsc_id
         WHERE s.lsc_comp_id    = ${scope.companyId}::uuid
           AND s.lsc_is_deleted = false
           AND s.lsc_is_active  = true
           AND g.lsg_is_deleted = false
           AND g.lsg_is_active  = true
           AND g.lsg_stock_check = true
           AND (${q.lscId ?? null}::uuid IS NULL OR s.lsc_id = ${q.lscId ?? null}::uuid)
           AND COALESCE((SELECT SUM(sbl_available_qty)
                           FROM stock.stock_balance
                          WHERE sbl_company_id = ${scope.companyId}::uuid
                            AND (${scope.branchId}::uuid IS NULL OR sbl_branch_id = ${scope.branchId}::uuid)
                            AND sbl_item_id    = g.lsg_item_id
                            AND sbl_bucket     = 'SALEABLE'
                            AND sbl_is_deleted = false), 0) < g.lsg_item_qty
      )
      SELECT agg.*, red.*, low.* FROM agg, red, low`;
    return {
      members: Number(s.members),
      active: Number(s.active),
      suspended: Number(s.suspended),
      outstanding: num(s.outstanding),
      outstandingValue: money(s.outstanding_value),
      earnedInPeriod: num(s.earned),
      earnedBills: Number(s.bills),
      redeemedInPeriod: num(s.redeemed),
      redeemedValue: money(s.redeemed_value),
      giftEligible: Number(s.gift_eligible),
      giftsLowOnStock: Number(s.gifts_low),
      expiring30Points: num(s.expiring30_points),
      expiring30Members: Number(s.expiring30_members),
    };
  }

  private memberItem(r: MemberBaseRow): MemberItem {
    const redeemable = num(r.redeemable);
    return {
      memberId: r.member_id,
      custId: r.cust_id,
      cardNo: r.card_no,
      customerName: r.customer_name,
      mobile: r.mobile,
      lscId: r.lsc_id,
      schemeName: r.scheme_name,
      status: r.status,
      earned: num(r.earned),
      redeemed: num(r.redeemed),
      expired: num(r.expired),
      gift: num(r.gift),
      adjusted: num(r.adjusted),
      balance: num(r.balance),
      redeemable,
      cooling: num(r.cooling),
      lapsed: num(r.lapsed),
      value: valueOf(redeemable, r.priced_points, r.priced_value, r.ms_rate),
      nextExpiryOn: r.next_expiry_on,
      nextExpiryPoints: num(r.next_expiry_points),
      bestGift: giftOf(r, redeemable),
      eligible: r.eligible === true,
      lastActivityOn: r.last_activity_on,
      enrolledOn: r.enrolled_on,
      branchId: r.branch_id,
      branchName: r.branch_name,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Expiring — one row per (member, expiry date)
  // ═════════════════════════════════════════════════════════════════════════

  private expiringCte(
    scope: Scope,
    q: LoyaltyStatusExpiringDto | LoyaltyStatusExportDto,
    withinDays: number,
  ): Prisma.Sql {
    return Prisma.sql`
      WITH base AS (
        SELECT m.lmb_id                                         AS member_id,
               m.lmb_cust_id                                    AS cust_id,
               c.cus_name                                       AS customer_name,
               m.lmb_card_no                                    AS card_no,
               COALESCE(NULLIF(m.lmb_mobile, ''), c.cus_phone1) AS mobile,
               MIN(l.lld_lsc_id::text)::uuid                    AS lsc_id,
               MIN(ls.lsc_name)                                 AS scheme_name,
               m.lmb_status                                     AS status,
               l.lld_expires_on::text                           AS expires_on,
               (l.lld_expires_on - ${scope.today}::date)::int   AS days_left,
               SUM(l.lld_lot_balance)                           AS points,
               COALESCE(SUM(l.lld_lot_balance * r.rate) FILTER (WHERE r.rate IS NOT NULL), 0) AS priced_value,
               COALESCE(SUM(l.lld_lot_balance) FILTER (WHERE r.rate IS NOT NULL), 0)          AS priced_points,
               m.lmb_balance_points                             AS balance,
               m.lmb_last_activity_on::text                     AS last_activity_on,
               m.lmb_branch_id                                  AS branch_id,
               b.br_name                                        AS branch_name
          FROM sales.loyalty_ledger l
          JOIN sales.loyalty_member m        ON m.lmb_id  = l.lld_member_id
          JOIN sales.customers c             ON c.cus_id  = m.lmb_cust_id
          LEFT JOIN sales.loyalty_scheme ls  ON ls.lsc_id = l.lld_lsc_id
          LEFT JOIN sales.loyalty_scheme ms  ON ms.lsc_id = m.lmb_lsc_id
          LEFT JOIN public.branch_master b   ON b.br_id   = m.lmb_branch_id
          CROSS JOIN LATERAL (
            SELECT CASE WHEN COALESCE(ls.lsc_allow_point_redeem, ms.lsc_allow_point_redeem)
                         AND COALESCE(ls.lsc_redeem_value_per_point, ms.lsc_redeem_value_per_point) > 0
                        THEN COALESCE(ls.lsc_redeem_value_per_point, ms.lsc_redeem_value_per_point)
                   END AS rate
          ) r
         WHERE l.lld_comp_id    = ${scope.companyId}::uuid
           AND l.lld_is_deleted = false
           AND l.lld_txn_type   = ANY(${LOT_TYPES}::text[])
           AND l.lld_lot_balance > 0
           AND l.lld_expires_on BETWEEN ${scope.today}::date AND ${scope.today}::date + ${withinDays}::int
           AND m.lmb_is_deleted = false
           AND (${scope.branchId}::uuid IS NULL OR m.lmb_branch_id = ${scope.branchId}::uuid)
           AND (${q.lscId ?? null}::uuid IS NULL OR l.lld_lsc_id = ${q.lscId ?? null}::uuid)
           AND (NOT ${q.activeOnly ?? true}::boolean OR m.lmb_status = 'ACTIVE')
           AND (NOT ${q.hasMobile ?? true}::boolean
                OR COALESCE(NULLIF(m.lmb_mobile, ''), c.cus_phone1) IS NOT NULL)
           AND ${looseSearchSql(['m.lmb_card_no', 'm.lmb_mobile', 'c.cus_name', 'c.cus_phone1'], q.search)}
         GROUP BY m.lmb_id, c.cus_id, b.br_id, l.lld_expires_on
      )`;
  }

  private async expiringRows(
    scope: Scope,
    q: LoyaltyStatusExpiringDto | LoyaltyStatusExportDto,
    withinDays: number,
    page: Page,
  ): Promise<{ items: ExpiringRow[]; total: number }> {
    const rows = await this.prisma.$queryRaw<ExpiringRow[]>`
      ${this.expiringCte(scope, q, withinDays)}
      SELECT f.*, COUNT(*) OVER () AS total_rows
        FROM base f
       ORDER BY ${this.orderBy(EXPIRING_SORT, q.sort, q.order, 'expires_on')}, f.customer_name, f.member_id
       LIMIT ${page.limit}::int OFFSET ${page.offset}::int`;
    return { items: rows, total: Number(rows[0]?.total_rows ?? 0) };
  }

  private async expiringSummary(
    scope: Scope,
    q: LoyaltyStatusExpiringDto | LoyaltyStatusExportDto,
    withinDays: number,
  ): Promise<ExpiringSummary> {
    // The cut points scale with withinDays: ≤7 / 8–15 / 16–withinDays (§5.4).
    const cuts: { label: string; fromDay: number; toDay: number }[] = [];
    if (withinDays <= 7) {
      cuts.push({ label: `≤${withinDays}`, fromDay: 0, toDay: withinDays });
    } else if (withinDays <= 15) {
      cuts.push(
        { label: '≤7', fromDay: 0, toDay: 7 },
        { label: `8-${withinDays}`, fromDay: 8, toDay: withinDays },
      );
    } else {
      cuts.push(
        { label: '≤7', fromDay: 0, toDay: 7 },
        { label: '8-15', fromDay: 8, toDay: 15 },
        { label: `16-${withinDays}`, fromDay: 16, toDay: withinDays },
      );
    }
    const bucketCols = cuts.map(
      (c, i) => Prisma.sql`
        COALESCE(SUM(points) FILTER (WHERE days_left BETWEEN ${c.fromDay}::int AND ${c.toDay}::int), 0) AS ${Prisma.raw(`p${i}`)},
        COUNT(DISTINCT member_id) FILTER (WHERE days_left BETWEEN ${c.fromDay}::int AND ${c.toDay}::int) AS ${Prisma.raw(`m${i}`)}`,
    );
    const [s] = await this.prisma.$queryRaw<Record<string, Prisma.Decimal | bigint>[]>`
      ${this.expiringCte(scope, q, withinDays)}
      SELECT ${Prisma.join(bucketCols, ', ')},
             COALESCE(SUM(priced_value), 0)  AS value_at_risk,
             COALESCE(SUM(points), 0)        AS points,
             COUNT(DISTINCT member_id)       AS members
        FROM base`;
    return {
      buckets: cuts.map((c, i) => ({
        label: c.label,
        fromDay: c.fromDay,
        toDay: c.toDay,
        points: num(s[`p${i}`] as Prisma.Decimal),
        members: Number(s[`m${i}`]),
      })),
      valueAtRisk: money(s.value_at_risk as Prisma.Decimal),
      members: Number(s.members),
      points: num(s.points),
    };
  }

  private expiringItem(r: ExpiringRow): ExpiringItem {
    const points = num(r.points);
    const balance = num(r.balance);
    return {
      memberId: r.member_id,
      custId: r.cust_id,
      customerName: r.customer_name,
      cardNo: r.card_no,
      mobile: r.mobile,
      lscId: r.lsc_id,
      schemeName: r.scheme_name,
      status: r.status,
      expiresOn: r.expires_on,
      daysLeft: Number(r.days_left),
      points,
      value: num(r.priced_points) > 0 ? money(r.priced_value) : null,
      balance,
      balanceAfter: round4(balance - points),
      lastActivityOn: r.last_activity_on,
      branchId: r.branch_id,
      branchName: r.branch_name,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Schemes — movement by lld_lsc_id over the period (§5.6)
  // ═════════════════════════════════════════════════════════════════════════

  private async schemeRows(
    scope: Scope,
    q: { from: string; to: string; lscId?: string; includeClosedHolding?: boolean },
    split: 'scheme' | 'scheme_branch' | 'scheme_month',
  ): Promise<SchemeItem[]> {
    const branchCol =
      split === 'scheme_branch' ? Prisma.sql`l.lld_branch_id` : Prisma.sql`NULL::uuid`;
    const monthCol =
      split === 'scheme_month'
        ? Prisma.sql`date_trunc('month', l.lld_txn_date)::date`
        : Prisma.sql`NULL::date`;
    const ledgerScope = Prisma.sql`
          l.lld_comp_id    = ${scope.companyId}::uuid
      AND l.lld_is_deleted = false
      AND l.lld_lsc_id IS NOT NULL
      AND l.lld_txn_date  <= ${q.to}::date
      AND (${scope.branchId}::uuid IS NULL OR l.lld_branch_id = ${scope.branchId}::uuid)
      AND (${q.lscId ?? null}::uuid IS NULL OR l.lld_lsc_id = ${q.lscId ?? null}::uuid)`;
    const inPeriod = Prisma.sql`l.lld_txn_date >= ${q.from}::date`;

    // ix_lld_scheme_period (comp, scheme, date) INCLUDE (type, points, branch,
    // doc) covers `mv` entirely — the index this plan asked for (§5.6).
    const rows = await this.prisma.$queryRaw<SchemeRow[]>`
      WITH mv AS (
        SELECT l.lld_lsc_id AS lsc_id, ${branchCol} AS branch_id, ${monthCol} AS month,
               SUM(l.lld_points)                                                         AS net_all,
               COALESCE(SUM(l.lld_points) FILTER (WHERE l.lld_txn_date < ${q.from}::date), 0) AS pre_from,
               COALESCE(SUM(l.lld_points), 0)                                            AS upto_to,
               COALESCE( SUM(l.lld_points) FILTER (WHERE ${inPeriod} AND l.lld_txn_type IN ('EARN', 'OPENING')), 0)   AS earned,
               COALESCE(-SUM(l.lld_points) FILTER (WHERE ${inPeriod} AND l.lld_txn_type = 'REDEEM'), 0)               AS redeemed,
               COALESCE(-SUM(l.lld_points) FILTER (WHERE ${inPeriod} AND l.lld_txn_type = 'GIFT'), 0)                 AS gift,
               COALESCE(-SUM(l.lld_points) FILTER (WHERE ${inPeriod} AND l.lld_txn_type = 'EXPIRE'), 0)               AS expired,
               COALESCE( SUM(l.lld_points) FILTER (WHERE ${inPeriod} AND l.lld_txn_type IN ('ADJUST', 'TRANSFER')), 0) AS adjusted,
               COUNT(DISTINCT l.lld_src_doc_id)
                 FILTER (WHERE ${inPeriod} AND l.lld_txn_type = 'EARN' AND l.lld_points > 0)  AS bills,
               COUNT(*) FILTER (WHERE ${inPeriod})                                       AS period_rows
          FROM sales.loyalty_ledger l
         WHERE ${ledgerScope}
         GROUP BY 1, 2, 3
      ),
      w AS (
        -- what the earlier months of the same key hold; 0 when there is one row per key
        SELECT mv.*,
               COALESCE(SUM(net_all) OVER (PARTITION BY lsc_id, branch_id ORDER BY month
                                           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS cum_before
          FROM mv
      ),
      keys AS (
        -- Notes 91 N1: the rows come from the LEDGER — every scheme id that moved in
        -- the period or still holds points, whether or not its master row is live —
        -- plus, on the plain split, every live scheme so one with no movement shows zeros.
        SELECT w.lsc_id, w.branch_id, w.month
          FROM w
         WHERE w.period_rows > 0 OR (w.cum_before + w.upto_to) <> 0
        UNION
        SELECT s.lsc_id, NULL::uuid, NULL::date
          FROM sales.loyalty_scheme s
         WHERE ${split === 'scheme'}::boolean
           AND s.lsc_comp_id    = ${scope.companyId}::uuid
           AND s.lsc_is_deleted = false
           AND (${q.lscId ?? null}::uuid IS NULL OR s.lsc_id = ${q.lscId ?? null}::uuid)
      )
      SELECT k.lsc_id, s.lsc_name, s.lsc_code, s.lsc_status, s.lsc_is_active, s.lsc_is_deleted,
             s.lsc_start_date::text AS start_date, s.lsc_end_date::text AS end_date,
             s.lsc_allow_point_redeem, s.lsc_redeem_value_per_point,
             k.branch_id, b.br_name AS branch_name, k.month::text AS month,
             COALESCE(w.cum_before + w.pre_from, 0) AS opening,
             COALESCE(w.cum_before + w.upto_to, 0)  AS outstanding,
             COALESCE(w.earned, 0) AS earned, COALESCE(w.redeemed, 0) AS redeemed,
             COALESCE(w.gift, 0) AS gift, COALESCE(w.expired, 0) AS expired,
             COALESCE(w.adjusted, 0) AS adjusted, COALESCE(w.bills, 0) AS bills
        FROM keys k
        LEFT JOIN w ON w.lsc_id = k.lsc_id
                   AND w.branch_id IS NOT DISTINCT FROM k.branch_id
                   AND w.month     IS NOT DISTINCT FROM k.month
        -- deleted schemes included on purpose: their points outlive them (N1)
        LEFT JOIN sales.loyalty_scheme s ON s.lsc_id = k.lsc_id
        LEFT JOIN public.branch_master b ON b.br_id = k.branch_id
       WHERE (k.month IS NULL
              OR k.month BETWEEN date_trunc('month', ${q.from}::date)::date
                             AND date_trunc('month', ${q.to}::date)::date)
       ORDER BY s.lsc_name, b.br_name, k.month`;

    const [holders, validTill] =
      rows.length === 0
        ? [[], []]
        : await Promise.all([
            split === 'scheme_month'
              ? Promise.resolve([])
              : this.prisma.$queryRaw<
                  { lsc_id: string; branch_id: string | null; holders: bigint }[]
                >`
                  SELECT x.lsc_id, x.branch_id, COUNT(*) AS holders
                    FROM (SELECT l.lld_lsc_id AS lsc_id, ${branchCol} AS branch_id, l.lld_member_id,
                                 SUM(l.lld_points) AS pts
                            FROM sales.loyalty_ledger l
                           WHERE ${ledgerScope}
                           GROUP BY 1, 2, 3) x
                   WHERE x.pts > 0
                   GROUP BY 1, 2`,
            this.prisma.$queryRaw<{ lsc_id: string; valid_till: string | null }[]>`
              SELECT lld_lsc_id AS lsc_id,
                     CASE WHEN BOOL_OR(lld_expires_on IS NULL) THEN NULL
                          ELSE MAX(lld_expires_on)::text END AS valid_till
                FROM sales.loyalty_ledger
               WHERE lld_comp_id    = ${scope.companyId}::uuid
                 AND lld_is_deleted = false
                 AND lld_lsc_id IS NOT NULL
                 AND lld_txn_type   = ANY(${LOT_TYPES}::text[])
                 AND lld_lot_balance > 0
               GROUP BY 1`,
          ]);
    const holdersOf = new Map(
      holders.map((h) => [`${h.lsc_id}|${h.branch_id ?? ''}`, Number(h.holders)]),
    );
    const validTillOf = new Map(validTill.map((v) => [v.lsc_id, v.valid_till]));
    const includeClosed = q.includeClosedHolding ?? true;

    const items: SchemeItem[] = [];
    for (const r of rows) {
      const deleted = r.lsc_is_deleted !== false;
      const ended =
        deleted ||
        r.lsc_status !== 'APPROVED' ||
        !r.lsc_is_active ||
        (r.end_date !== null && r.end_date < scope.today);
      const outstanding = num(r.outstanding);
      if (ended && (!includeClosed || outstanding <= 0)) {
        continue;
      }
      const earned = num(r.earned);
      const redeemed = num(r.redeemed);
      const gift = num(r.gift);
      const rate =
        r.lsc_allow_point_redeem === true && num(r.lsc_redeem_value_per_point) > 0
          ? new Prisma.Decimal(r.lsc_redeem_value_per_point ?? 0)
          : null;
      items.push({
        lscId: r.lsc_id,
        schemeName: r.lsc_name ?? '(deleted scheme)',
        schemeCode: r.lsc_code ?? '',
        status: deleted
          ? 'DELETED'
          : ended
            ? r.lsc_status === 'APPROVED'
              ? 'ENDED'
              : (r.lsc_status ?? 'UNKNOWN')
            : (r.lsc_status ?? 'UNKNOWN'),
        startDate: r.start_date,
        endDate: r.end_date,
        pointsValidTill: ended ? (validTillOf.get(r.lsc_id) ?? null) : null,
        branchId: r.branch_id,
        branchName: r.branch_name,
        month: r.month ? r.month.slice(0, 7) : null,
        holders:
          split === 'scheme_month'
            ? null
            : (holdersOf.get(`${r.lsc_id}|${r.branch_id ?? ''}`) ?? 0),
        bills: Number(r.bills),
        opening: num(r.opening),
        earned,
        redeemed,
        gift,
        expired: num(r.expired),
        adjusted: num(r.adjusted),
        outstanding,
        value: rate === null ? null : rate.mul(outstanding).toFixed(2),
        usedPct: earned > 0 ? Math.round(((redeemed + gift) / earned) * 1000) / 10 : null,
      });
    }
    return items;
  }

  private sortSchemes(items: SchemeItem[], sort?: string, order?: SortOrder): SchemeItem[] {
    if (!sort) {
      return items;
    }
    if (!SCHEME_SORT.has(sort)) {
      refuse(LOYALTY_STATUS_ERROR.BAD_SORT, 'sort', `Unknown sort key "${sort}".`);
    }
    const key = sort as keyof SchemeItem;
    const dir = order === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (x === y) {
        return 0;
      }
      if (x === null || x === undefined) {
        return 1;
      }
      if (y === null || y === undefined) {
        return -1;
      }
      return (x < y ? -1 : 1) * dir;
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Scope, rights and the small refusals (§8)
  // ═════════════════════════════════════════════════════════════════════════

  private async assertRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: LOYALTY_STATUS_MENU_ID,
      right,
      codePrefix: CODE_PREFIX,
      action,
    });
  }

  private async today(): Promise<string> {
    const [row] = await this.prisma.$queryRaw<{ d: string }[]>`SELECT CURRENT_DATE::text AS d`;
    return row.d;
  }

  private async resolveScope(
    q: { companyId: string; branchId?: string },
    lscId?: string,
  ): Promise<Scope> {
    const today = await this.today();
    if (q.branchId) {
      const [br] = await this.prisma.$queryRaw<{ br_comp_id: string | null }[]>`
        SELECT br_comp_id FROM public.branch_master WHERE br_id = ${q.branchId}::uuid`;
      if (!br || br.br_comp_id !== q.companyId) {
        refuse(
          LOYALTY_STATUS_ERROR.BRANCH_NOT_IN_COMPANY,
          'branchId',
          'This branch does not belong to the company.',
        );
      }
    }
    if (lscId) {
      const [s] = await this.prisma.$queryRaw<{ lsc_comp_id: string }[]>`
        SELECT lsc_comp_id FROM sales.loyalty_scheme WHERE lsc_id = ${lscId}::uuid`;
      if (!s || s.lsc_comp_id !== q.companyId) {
        refuse(
          LOYALTY_STATUS_ERROR.SCHEME_NOT_IN_COMPANY,
          'lscId',
          'This scheme does not belong to the company.',
        );
      }
    }
    return { companyId: q.companyId, branchId: q.branchId ?? null, today };
  }

  private async assertMember(companyId: string, memberId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT true AS ok FROM sales.loyalty_member
       WHERE lmb_id = ${memberId}::uuid AND lmb_comp_id = ${companyId}::uuid
         AND lmb_is_deleted = false`;
    if (rows.length === 0) {
      throwNotFound(
        'Loyalty member not found',
        'memberId',
        `No live member ${memberId} in this company`,
      );
    }
  }

  private assertPeriod(
    from: string | null | undefined,
    to: string | null | undefined,
    field: string,
  ): void {
    if (from && to && to < from) {
      refuse(LOYALTY_STATUS_ERROR.RANGE_REVERSED, field, `${from} is after ${to}.`);
    }
    if ((from && !to) || (!from && to)) {
      if (field === 'earnedFrom') {
        refuse(LOYALTY_STATUS_ERROR.RANGE_REVERSED, field, 'earnedFrom and earnedTo go together.');
      }
    }
  }

  private assertCap(count: number): void {
    if (count > EXPORT_ROW_CAP) {
      throwUnprocessable('Export too large', [
        {
          field: 'tab',
          code: LOYALTY_STATUS_ERROR.RANGE_TOO_LARGE,
          message: `${count} rows — the export stops at ${EXPORT_ROW_CAP}. Narrow the filters.`,
        },
      ]);
    }
  }

  private orderBy(
    map: Record<string, string>,
    sort: string | undefined,
    order: SortOrder | undefined,
    fallback: string,
  ): Prisma.Sql {
    const col = sort ? map[sort] : fallback;
    if (!col) {
      refuse(LOYALTY_STATUS_ERROR.BAD_SORT, 'sort', `Unknown sort key "${sort}".`);
    }
    return Prisma.sql`${Prisma.raw(`f.${col}`)} ${Prisma.raw(order === 'desc' ? 'DESC' : 'ASC')} NULLS LAST`;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function refuse(code: string, field: string, message: string): never {
  throwBadRequest('Loyalty status request refused', [{ field, message, code }]);
}

function num(v: Prisma.Decimal | number | bigint | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function money(v: Prisma.Decimal | number | null | undefined): string {
  return new Prisma.Decimal(v ?? 0).toFixed(2);
}

/**
 * Value ₹ (§4, D4): the priced redeemable lots. NULL when nothing could be
 * priced — the member's scheme does not price points and no lot's does — so
 * the client shows "—" instead of a misleading 0.
 */
function valueOf(
  redeemable: number,
  pricedPoints: Prisma.Decimal,
  pricedValue: Prisma.Decimal,
  memberRate: Prisma.Decimal | null,
): string | null {
  if (redeemable > 0) {
    return num(pricedPoints) > 0 ? money(pricedValue) : null;
  }
  return memberRate === null ? null : '0.00';
}

function giftOf(r: MemberBaseRow, redeemable: number): BestGift | null {
  if (!r.lsg_id || !r.lsg_item_id) {
    return null;
  }
  const points = num(r.gift_points);
  let qty = 1;
  if (r.lsg_repeat && points > 0) {
    qty = Math.floor(redeemable / points);
    const cap = num(r.lsg_max_qty_per_bill);
    if (cap > 0) {
      qty = Math.min(qty, cap);
    }
    qty = Math.max(qty, 1);
  }
  return { lsgId: r.lsg_id, itemId: r.lsg_item_id, name: r.gift_name ?? '', points, qty };
}

/** §5.2 — the statement's reason column, built on the server. */
function reasonOf(r: {
  lld_txn_type: string;
  lld_remarks: string | null;
  lld_src_doc_refno: string | null;
  lld_src_doc_type: string | null;
  lsc_name: string | null;
  lld_money_value: Prisma.Decimal;
  lld_reversal_of_id: string | null;
  lld_reversal_reason: string | null;
  approver: string | null;
}): string {
  const doc =
    r.lld_src_doc_refno ??
    (r.lld_src_doc_type ? r.lld_src_doc_type.replace(/_/g, ' ').toLowerCase() : null);
  const scheme = r.lsc_name ? ` (${r.lsc_name})` : '';
  const reversal = r.lld_reversal_of_id ? 'Reversed: ' : '';
  if (r.lld_remarks) {
    return `${reversal}${r.lld_remarks}`;
  }
  switch (r.lld_txn_type) {
    case 'EARN':
      return `${reversal}Earned on ${doc ?? 'bill'}${scheme}`;
    case 'OPENING':
      return `${reversal}Opening balance${scheme}`;
    case 'REDEEM': {
      const money = num(r.lld_money_value);
      return `${reversal}Redeemed against ${doc ?? 'bill'}${scheme}${money > 0 ? ` · tender ₹${money.toFixed(2)}` : ''}`;
    }
    case 'GIFT':
      return `${reversal}Gift ${doc ?? ''}${scheme}`.trim();
    case 'EXPIRE':
      return `${reversal}Lapsed${scheme}`;
    case 'ADJUST':
      return `${reversal}Adjustment${scheme}${r.approver ? ` · approved by ${r.approver}` : ''}`;
    case 'TRANSFER':
      return `${reversal}Transfer${scheme}`;
    default:
      return `${reversal}${r.lld_txn_type}${scheme}`;
  }
}

function tabTitle(tab: string): string {
  switch (tab) {
    case 'members':
      return 'Members';
    case 'expiring':
      return 'Expiring soon';
    case 'schemes':
      return 'Scheme summary';
    default:
      return 'Member statement';
  }
}

/** dd-mm-yyyy for the printed line. */
function dmy(iso: string): string {
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
}

function monthEnd(monthStart: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthStart.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}
