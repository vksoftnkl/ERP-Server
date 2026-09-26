import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  throwAccountsBadRequest,
  throwAccountsForbidden,
  throwAccountsNotFound,
  throwUnprocessable,
} from 'src/common/utils/module-service.utils';
import type {
  LedgerStatementExportDto,
  LedgerStatementLedgersDto,
  LedgerStatementRangeDto,
  LedgerStatementScopeDto,
  LedgerStatementVoucherLegsDto,
  LedgerStatementVouchersDto,
} from './dto/ledger-statement-query.dto';
import {
  LEDGER_STATEMENT_ERROR,
  type DailyPayload,
  type ExportPayload,
  type LedgerFacts,
  type LedgerHeaderPayload,
  type LedgerPickPayload,
  type MonthlyPayload,
  type PeriodSummary,
  type RowKind,
  type SidedAmount,
  type VoucherLeg,
  type VoucherLegsPayload,
  type VoucherRow,
  type VouchersPayload,
} from './types/ledger-statement.types';

/**
 * Ledger Statement — a read-only report over the `acc_vouchers` legs of ONE
 * ledger for ONE period (plan 2026-09-25). It writes nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ONE DEFINITION OF A BALANCE (§4) — `legsSql` and `openingSql`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   balance(asOf) = opening set (acc_opening_balance, this year, 'D' +, 'C' −)
 *                 + Σ av_signed_amount of live legs, date ≤ asOf, whose header
 *                   is POSTED **or CANCELLED**
 *
 * CANCELLED counts because a cancel keeps the original's legs and posts a
 * POSTED mirror with the opposite ones: the pair nets to zero. DRAFT and
 * APPROVED never count. Company-scoped always (`av_company_id`,
 * `op_company_id`) — a shared ledger (`led_company_id IS NULL`) shows only this
 * company's movement. Branch: one branch = its opening set and its legs; All =
 * every opening set (company-level + every branch's) and every leg (§4.2, L2).
 *
 * Deliberately NOT `accounts.fn_ledger_book_balance` (§2 / §13): the SQL lives
 * here.
 */

const STATEMENT_MENU_ID = 258; // "Ledger Statement" under 137 (§10)
const MONTHLY_MENU_ID = 144; // "Ledger Monthly Summary" opens the same screen (L1)
const EXPORT_ROW_CAP = 20_000;
const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_PICK_LIMIT = 30;
const ZERO = new Prisma.Decimal(0);

interface Scope {
  companyId: string;
  accYear: string;
  branchId: string | null;
  ledgerId: string;
  /** fy_begin_date, or fy_books_begin_date when that is later. */
  yearBegin: string;
  fyBegin: string;
  fyEnd: string;
}

interface CoreRow {
  vid: string;
  vyr: string;
  vdate: Date;
  dr: Prisma.Decimal;
  cr: Prisma.Decimal;
  net: Prisma.Decimal;
  status: string;
  kind: RowKind;
  pair_inside: boolean;
  running: Prisma.Decimal;
  total_rows: bigint;
  branch_id: string | null;
  branch_name: string | null;
  vtype_id: number;
  vtype_name: string | null;
  vtype_short: string | null;
  refno: string | null;
  remarks: string | null;
  usr_refno: string | null;
  created_by: string | null;
  created_by_name: string | null;
  src_module: string | null;
  src_doc_type: string | null;
  src_doc_id: string | null;
}

interface LegRow {
  vid: string;
  vyr: string;
  row_no: number;
  dr_cr: string;
  ledger_id: string;
  ledger_name: string | null;
  amount: Prisma.Decimal;
  role: string | null;
  remarks: string | null;
  opp_ledger_id: string | null;
  opp_ledger_name: string | null;
}

@Injectable()
export class LedgerStatementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.1 — the picker
  // ═════════════════════════════════════════════════════════════════════════

  async ledgers(q: LedgerStatementLedgersDto): Promise<LedgerPickPayload> {
    await this.assertMenuRight();
    const search = q.search?.trim() ? `%${q.search.trim()}%` : null;
    const rows = await this.prisma.$queryRaw<
      {
        led_id: string;
        led_name: string;
        led_group_id: string | null;
        acc_group_name: string | null;
        led_is_bill_by_bill: boolean | null;
        led_company_id: string | null;
      }[]
    >`
      SELECT l.led_id, l.led_name, l.led_group_id, g.acc_group_name, l.led_is_bill_by_bill,
             l.led_company_id
        FROM accounts.acc_ledger_master l
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE l.led_is_deleted = false
         AND (l.led_company_id IS NULL OR l.led_company_id = ${q.companyId}::uuid)
         AND (${q.groupId ?? null}::uuid IS NULL OR l.led_group_id = ${q.groupId ?? null}::uuid)
         AND (${search}::text IS NULL
              OR l.led_name ILIKE ${search} OR l.led_alias ILIKE ${search}
              OR l.led_short ILIKE ${search} OR l.led_gstin_no ILIKE ${search}
              OR l.led_phone1 ILIKE ${search})
       ORDER BY l.led_name, l.led_id
       LIMIT ${q.limit ?? DEFAULT_PICK_LIMIT}`;
    return {
      items: rows.map((r) => ({
        ledgerId: r.led_id,
        name: r.led_name,
        groupId: r.led_group_id,
        groupName: r.acc_group_name,
        isBillByBill: r.led_is_bill_by_bill === true,
        isShared: r.led_company_id === null,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.2 — the three top panels
  // ═════════════════════════════════════════════════════════════════════════

  async header(q: LedgerStatementRangeDto): Promise<LedgerHeaderPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q);
    this.assertRange(scope, q.fromDate, q.toDate);
    const [ledger, period] = await Promise.all([
      this.ledgerFacts(scope),
      this.period(scope, q.fromDate, q.toDate),
    ]);
    return { ledger, period };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.3 — the grid
  // ═════════════════════════════════════════════════════════════════════════

  async vouchers(q: LedgerStatementVouchersDto): Promise<VouchersPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q);
    this.assertRange(scope, q.fromDate, q.toDate);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
    const [totals, core] = await Promise.all([
      this.totals(scope, q.fromDate, q.toDate),
      this.coreRows(scope, q.fromDate, q.toDate, q.includeCancelled ?? true, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    ]);
    const rows = await this.decorate(scope, core, {
      withBillRefs: q.withBillRefs ?? true,
      withLegs: q.withLegs ?? false,
    });
    const totalRows = core.length > 0 ? Number(core[0].total_rows) : await this.countRows(scope, q);
    const { broughtForward, carriedForward } = this.forwards(core, totals, page > 1);
    return {
      broughtForward,
      rows,
      carriedForward,
      page: { page, pageSize, totalRows },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.4 — every leg of one voucher
  // ═════════════════════════════════════════════════════════════════════════

  async voucherLegs(q: LedgerStatementVoucherLegsDto): Promise<VoucherLegsPayload> {
    await this.assertMenuRight();
    const [header] = await this.prisma.$queryRaw<
      { refno: string | null; vdate: Date; status: string }[]
    >`
      SELECT avh_voucher_refno AS refno, avh_voucher_date AS vdate, avh_voucher_status AS status
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${q.voucherId}::uuid AND avh_acc_year = ${q.accYear}::char(9)
         AND avh_company_id = ${q.companyId}::uuid AND avh_is_deleted = false`;
    if (!header) {
      throwAccountsNotFound(
        'Voucher not found',
        'voucherId',
        `No voucher ${q.voucherId} in ${q.accYear} for this company`,
      );
    }
    const legs = await this.legsOf([{ vid: q.voucherId, vyr: q.accYear }]);
    return {
      voucherId: q.voucherId,
      accYear: q.accYear,
      voucherNo: header.refno,
      date: isoDate(header.vdate),
      status: header.status,
      legs: legs.map((leg) => toLeg(leg, q.ledgerId)),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.5 — one row per day with movement
  // ═════════════════════════════════════════════════════════════════════════

  async daily(q: LedgerStatementRangeDto): Promise<DailyPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q);
    this.assertRange(scope, q.fromDate, q.toDate);
    const [totals, days] = await Promise.all([
      this.totals(scope, q.fromDate, q.toDate),
      this.prisma.$queryRaw<
        {
          d: Date;
          dr: Prisma.Decimal;
          cr: Prisma.Decimal;
          n: bigint;
          closing: Prisma.Decimal;
        }[]
      >`
        WITH legs AS (${this.legsSql(scope, q.toDate)}),
        op AS (${this.openingSql(scope)}),
        before AS (SELECT COALESCE(SUM(av_signed_amount), 0) AS amt
                     FROM legs WHERE av_voucher_date < ${q.fromDate}::date),
        d AS (SELECT av_voucher_date AS d,
                     COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'DR'), 0) AS dr,
                     COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'CR'), 0) AS cr,
                     SUM(av_signed_amount) AS net,
                     COUNT(DISTINCT (av_voucher_id, av_acc_year)) AS n
                FROM legs WHERE av_voucher_date >= ${q.fromDate}::date
               GROUP BY av_voucher_date)
        SELECT d.d, d.dr, d.cr, d.n,
               (SELECT amt FROM op) + (SELECT amt FROM before)
               + SUM(d.net) OVER (ORDER BY d.d ROWS UNBOUNDED PRECEDING) AS closing
          FROM d ORDER BY d.d`,
    ]);
    return {
      opening: sided(totals.openingAtFrom),
      days: days.map((day) => ({
        date: isoDate(day.d),
        debit: money(day.dr),
        credit: money(day.cr),
        vouchers: Number(day.n),
        closing: sided(day.closing),
      })),
      closing: sided(totals.closing),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.6 — the twelve months of the year
  // ═════════════════════════════════════════════════════════════════════════

  async monthly(q: LedgerStatementScopeDto): Promise<MonthlyPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q);
    const [opening, months] = await Promise.all([
      this.openingOf(scope),
      this.prisma.$queryRaw<
        { mon: string; dr: Prisma.Decimal; cr: Prisma.Decimal; net: Prisma.Decimal }[]
      >`
        WITH legs AS (${this.legsSql(scope, scope.fyEnd)})
        SELECT to_char(av_voucher_date, 'YYYY-MM') AS mon,
               COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'DR'), 0) AS dr,
               COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'CR'), 0) AS cr,
               COALESCE(SUM(av_signed_amount), 0) AS net
          FROM legs GROUP BY 1`,
    ]);
    const byMonth = new Map(months.map((m) => [m.mon, m]));
    const thisMonth = new Date().toISOString().slice(0, 7);
    let running = opening.amount;
    const rows = monthsBetween(scope.fyBegin, scope.fyEnd).map((mon) => {
      const m = byMonth.get(mon);
      running = running.plus(m?.net ?? ZERO);
      return {
        month: mon,
        debit: money(m?.dr ?? ZERO),
        credit: money(m?.cr ?? ZERO),
        closing: sided(running),
        isFuture: mon > thisMonth,
      };
    });
    return { opening: sided(opening.amount), months: rows, closing: sided(running) };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.7 — everything, for the client to print / file
  // ═════════════════════════════════════════════════════════════════════════

  async export(q: LedgerStatementExportDto): Promise<ExportPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q);
    this.assertRange(scope, q.fromDate, q.toDate);
    const core = await this.coreRows(scope, q.fromDate, q.toDate, q.includeCancelled ?? true, {
      limit: EXPORT_ROW_CAP + 1,
      offset: 0,
    });
    if (core.length > EXPORT_ROW_CAP) {
      const count = Number(core[0].total_rows);
      throwUnprocessable('Range too large', [
        {
          field: 'fromDate',
          code: LEDGER_STATEMENT_ERROR.RANGE_TOO_LARGE,
          count,
          message: `${count} vouchers in this range — the export stops at ${EXPORT_ROW_CAP}. Narrow the dates.`,
        } as { field: string; message: string; code: string; count: number },
      ]);
    }
    const [ledger, period, totals, rows] = await Promise.all([
      this.ledgerFacts(scope),
      this.period(scope, q.fromDate, q.toDate),
      this.totals(scope, q.fromDate, q.toDate),
      this.decorate(scope, core, {
        withBillRefs: q.withBillRefs ?? true,
        withLegs: q.withLegs ?? false,
      }),
    ]);
    return {
      ledger,
      period,
      broughtForward: sided(totals.openingAtFrom),
      rows,
      carriedForward: sided(totals.closing),
      totalRows: core.length,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The guards — §9 and the menu right
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * 403 unless the caller may view 258 "Ledger Statement" — or 144 "Ledger
   * Monthly Summary", which opens the same screen (L1). On every route, the
   * picker included: it lists every ledger's name.
   */
  private async assertMenuRight(): Promise<void> {
    const userId = this.requestContext.getUserId();
    const rows = isUuid(userId)
      ? await this.prisma.$queryRaw<{ ok: boolean }[]>`
          SELECT true AS ok FROM public.user_menus
           WHERE um_user_id = ${userId}::uuid
             AND um_menu_id IN (${STATEMENT_MENU_ID}::int, ${MONTHLY_MENU_ID}::int)
             AND um_can_view = true AND um_is_deleted = false
           LIMIT 1`
      : [];
    if (rows.length === 0) {
      throwAccountsForbidden('No access to the Ledger Statement', [
        {
          field: 'menu',
          code: LEDGER_STATEMENT_ERROR.NO_MENU_RIGHT,
          message: `This user may not view menu ${STATEMENT_MENU_ID} (Ledger Statement) or ${MONTHLY_MENU_ID} (Ledger Monthly Summary).`,
        } as { field: string; message: string; code: string },
      ]);
    }
  }

  /** YEAR_UNKNOWN / LEDGER_* / BRANCH_NOT_IN_COMPANY, in that order. */
  private async resolveScope(q: LedgerStatementScopeDto): Promise<Scope> {
    const [fy] = await this.prisma.$queryRaw<
      { fy_begin_date: Date; fy_end_date: Date; fy_books_begin_date: Date | null }[]
    >`
      SELECT fy_begin_date, fy_end_date, fy_books_begin_date
        FROM public.fiscal_years
       WHERE comp_id = ${q.companyId}::uuid AND fy_year_name = ${q.accYear}::char(9)
         AND is_deleted = false
       LIMIT 1`;
    if (!fy) {
      refuse(
        LEDGER_STATEMENT_ERROR.YEAR_UNKNOWN,
        'accYear',
        `No fiscal year ${q.accYear} for this company.`,
      );
    }
    const [led] = await this.prisma.$queryRaw<{ led_company_id: string | null }[]>`
      SELECT led_company_id FROM accounts.acc_ledger_master
       WHERE led_id = ${q.ledgerId}::uuid AND led_is_deleted = false`;
    if (!led) {
      throwAccountsNotFound('Ledger not found', 'ledgerId', `No live ledger ${q.ledgerId}`);
    }
    if (led.led_company_id !== null && led.led_company_id !== q.companyId) {
      refuse(
        LEDGER_STATEMENT_ERROR.LEDGER_NOT_IN_COMPANY,
        'ledgerId',
        'This ledger belongs to another company.',
      );
    }
    if (q.branchId) {
      const [br] = await this.prisma.$queryRaw<{ br_comp_id: string | null }[]>`
        SELECT br_comp_id FROM public.branch_master WHERE br_id = ${q.branchId}::uuid`;
      if (!br || br.br_comp_id !== q.companyId) {
        refuse(
          LEDGER_STATEMENT_ERROR.BRANCH_NOT_IN_COMPANY,
          'branchId',
          'This branch does not belong to the company.',
        );
      }
    }
    const fyBegin = isoDate(fy.fy_begin_date);
    const books = fy.fy_books_begin_date ? isoDate(fy.fy_books_begin_date) : fyBegin;
    return {
      companyId: q.companyId,
      accYear: q.accYear,
      branchId: q.branchId ?? null,
      ledgerId: q.ledgerId,
      yearBegin: books > fyBegin ? books : fyBegin,
      fyBegin,
      fyEnd: isoDate(fy.fy_end_date),
    };
  }

  /** RANGE_REVERSED, RANGE_OUTSIDE_YEAR (L5: a range never stitches two years). */
  private assertRange(scope: Scope, from: string, to: string): void {
    if (from > to) {
      refuse(LEDGER_STATEMENT_ERROR.RANGE_REVERSED, 'fromDate', `${from} is after ${to}.`);
    }
    if (from < scope.fyBegin || to > scope.fyEnd) {
      refuse(
        LEDGER_STATEMENT_ERROR.RANGE_OUTSIDE_YEAR,
        from < scope.fyBegin ? 'fromDate' : 'toDate',
        `${scope.accYear} runs ${scope.fyBegin} to ${scope.fyEnd}; ${from} – ${to} is outside it.`,
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4 — the balance, as SQL fragments
  // ═════════════════════════════════════════════════════════════════════════

  /** This ledger's counted legs, up to `upTo`. Drives from ix_av_ledger. */
  private legsSql(scope: Scope, upTo: string): Prisma.Sql {
    return Prisma.sql`
      SELECT v.av_voucher_id, v.av_acc_year, v.av_voucher_date, v.av_dr_cr, v.av_amount,
             v.av_signed_amount
        FROM accounts.acc_vouchers v
        JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
       WHERE v.av_company_id = ${scope.companyId}::uuid
         AND v.av_ledger_id  = ${scope.ledgerId}::uuid
         AND v.av_acc_year   = ${scope.accYear}::char(9)
         AND v.av_voucher_date <= ${upTo}::date
         AND v.av_is_deleted = false
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
         AND (${scope.branchId}::uuid IS NULL OR v.av_branch_id = ${scope.branchId}::uuid)`;
  }

  /** The opening set as one signed figure (`amt`). 'D' +, 'C' −. */
  private openingSql(scope: Scope): Prisma.Sql {
    return Prisma.sql`
      SELECT COALESCE(SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END), 0) AS amt
        FROM accounts.acc_opening_balance o
       WHERE o.op_company_id = ${scope.companyId}::uuid
         AND o.op_ledger_id  = ${scope.ledgerId}::uuid
         AND o.op_acc_year   = ${scope.accYear}::char(9)
         AND o.op_is_deleted = false
         AND (${scope.branchId}::uuid IS NULL OR o.op_branch_id = ${scope.branchId}::uuid)`;
  }

  /** The opening, plus §4.2's note for a branch view of a company-level-only opening. */
  private async openingOf(scope: Scope): Promise<{ amount: Prisma.Decimal; note: string | null }> {
    const [row] = await this.prisma.$queryRaw<
      { amt: Prisma.Decimal; branch_rows: bigint; company_rows: bigint }[]
    >`
      SELECT COALESCE(SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END)
                        FILTER (WHERE ${scope.branchId}::uuid IS NULL
                                   OR o.op_branch_id = ${scope.branchId}::uuid), 0) AS amt,
             COUNT(*) FILTER (WHERE o.op_branch_id = ${scope.branchId}::uuid) AS branch_rows,
             COUNT(*) FILTER (WHERE o.op_branch_id IS NULL AND o.op_amount <> 0) AS company_rows
        FROM accounts.acc_opening_balance o
       WHERE o.op_company_id = ${scope.companyId}::uuid
         AND o.op_ledger_id  = ${scope.ledgerId}::uuid
         AND o.op_acc_year   = ${scope.accYear}::char(9)
         AND o.op_is_deleted = false`;
    const note =
      scope.branchId && Number(row.branch_rows) === 0 && Number(row.company_rows) > 0
        ? 'COMPANY_LEVEL_ONLY'
        : null;
    return { amount: new Prisma.Decimal(row.amt), note };
  }

  /** Opening at From and closing at To — independent of includeCancelled (a pair nets to zero). */
  private async totals(
    scope: Scope,
    from: string,
    to: string,
  ): Promise<{
    openingAtFrom: Prisma.Decimal;
    closing: Prisma.Decimal;
    dr: Prisma.Decimal;
    cr: Prisma.Decimal;
    drVouchers: number;
    crVouchers: number;
  }> {
    const [row] = await this.prisma.$queryRaw<
      {
        op: Prisma.Decimal;
        before: Prisma.Decimal;
        dr: Prisma.Decimal;
        cr: Prisma.Decimal;
        dr_n: bigint;
        cr_n: bigint;
      }[]
    >`
      WITH legs AS (${this.legsSql(scope, to)}),
      op AS (${this.openingSql(scope)})
      SELECT (SELECT amt FROM op) AS op,
             COALESCE(SUM(av_signed_amount) FILTER (WHERE av_voucher_date < ${from}::date), 0) AS before,
             COALESCE(SUM(av_amount) FILTER (WHERE av_voucher_date >= ${from}::date AND av_dr_cr = 'DR'), 0) AS dr,
             COALESCE(SUM(av_amount) FILTER (WHERE av_voucher_date >= ${from}::date AND av_dr_cr = 'CR'), 0) AS cr,
             COUNT(DISTINCT (av_voucher_id, av_acc_year))
               FILTER (WHERE av_voucher_date >= ${from}::date AND av_dr_cr = 'DR') AS dr_n,
             COUNT(DISTINCT (av_voucher_id, av_acc_year))
               FILTER (WHERE av_voucher_date >= ${from}::date AND av_dr_cr = 'CR') AS cr_n
        FROM legs`;
    const openingAtFrom = new Prisma.Decimal(row.op).plus(row.before);
    const dr = new Prisma.Decimal(row.dr);
    const cr = new Prisma.Decimal(row.cr);
    return {
      openingAtFrom,
      closing: openingAtFrom.plus(dr).minus(cr),
      dr,
      cr,
      drVouchers: Number(row.dr_n),
      crVouchers: Number(row.cr_n),
    };
  }

  private async period(scope: Scope, from: string, to: string): Promise<PeriodSummary> {
    const [totals, opening, [pairs]] = await Promise.all([
      this.totals(scope, from, to),
      this.openingOf(scope),
      this.prisma.$queryRaw<{ n: bigint }[]>`
        WITH ${this.kindCtes(scope, from, to)}
        SELECT COUNT(*) AS n FROM k WHERE kind = 'CANCELLED' AND pair_inside`,
    ]);
    return {
      fromDate: from,
      toDate: to,
      opening: sided(totals.openingAtFrom),
      debit: { amount: money(totals.dr), vouchers: totals.drVouchers },
      credit: { amount: money(totals.cr), vouchers: totals.crVouchers },
      closing: sided(totals.closing),
      cancelledPairs: Number(pairs?.n ?? 0),
      openingNote: opening.note,
    };
  }

  /**
   * `legs`, `pv` (one row per voucher in the period) and `k` (each voucher's
   * row kind, and whether the OTHER half of its cancel pair is also in the
   * period). §7: CANCELLED = the header is; REVERSAL = a POSTED header that some
   * other header names in avh_reversal_voucher_id (ix_avh_reversal).
   */
  private kindCtes(scope: Scope, from: string, to: string): Prisma.Sql {
    return Prisma.sql`
      legs AS (${this.legsSql(scope, to)}),
      pv AS (
        SELECT av_voucher_id AS vid, av_acc_year AS vyr, MIN(av_voucher_date) AS vdate,
               COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'DR'), 0) AS dr,
               COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'CR'), 0) AS cr,
               SUM(av_signed_amount) AS net
          FROM legs WHERE av_voucher_date >= ${from}::date
         GROUP BY av_voucher_id, av_acc_year),
      hk AS (
        SELECT pv.*, h.avh_voucher_slno AS slno, h.avh_voucher_status AS status,
               o.avh_voucher_id AS orig_id, o.avh_acc_year AS orig_yr,
               h.avh_reversal_voucher_id AS mirror_id, h.avh_reversal_acc_year AS mirror_yr
          FROM pv
          JOIN accounts.acc_voucher_header h
            ON h.avh_voucher_id = pv.vid AND h.avh_acc_year = pv.vyr
          LEFT JOIN LATERAL (
            SELECT o.avh_voucher_id, o.avh_acc_year
              FROM accounts.acc_voucher_header o
             WHERE o.avh_reversal_voucher_id = pv.vid AND o.avh_reversal_acc_year = pv.vyr
               AND o.avh_is_deleted = false
             LIMIT 1) o ON true),
      k AS (
        SELECT hk.*,
               CASE WHEN hk.status = 'CANCELLED' THEN 'CANCELLED'
                    WHEN hk.orig_id IS NOT NULL THEN 'REVERSAL'
                    ELSE 'NORMAL' END AS kind,
               CASE WHEN hk.status = 'CANCELLED'
                    THEN EXISTS (SELECT 1 FROM pv p2
                                  WHERE p2.vid = hk.mirror_id AND p2.vyr = hk.mirror_yr)
                    WHEN hk.orig_id IS NOT NULL
                    THEN EXISTS (SELECT 1 FROM pv p2
                                  WHERE p2.vid = hk.orig_id AND p2.vyr = hk.orig_yr)
                    ELSE false END AS pair_inside
          FROM hk)`;
  }

  /**
   * §6 — the voucher rows with their running balance. The window runs over the
   * WHOLE filtered range before LIMIT, so `running` is exact on any page; a
   * hidden pair (includeCancelled=false, both halves inside) is out of the
   * window's inputs too.
   */
  private async coreRows(
    scope: Scope,
    from: string,
    to: string,
    includeCancelled: boolean,
    paging: { limit: number; offset: number },
  ): Promise<CoreRow[]> {
    return this.prisma.$queryRaw<CoreRow[]>`
      WITH ${this.kindCtes(scope, from, to)},
      op AS (${this.openingSql(scope)}),
      before AS (SELECT COALESCE(SUM(av_signed_amount), 0) AS amt
                   FROM legs WHERE av_voucher_date < ${from}::date),
      f AS (SELECT * FROM k WHERE ${includeCancelled}::boolean OR NOT (k.kind <> 'NORMAL' AND k.pair_inside)),
      w AS (
        SELECT f.*,
               (SELECT amt FROM op) + (SELECT amt FROM before)
               + SUM(f.net) OVER (ORDER BY f.vdate, f.slno NULLS LAST, f.vid
                                  ROWS UNBOUNDED PRECEDING) AS running,
               COUNT(*) OVER () AS total_rows
          FROM f
         ORDER BY f.vdate, f.slno NULLS LAST, f.vid
         LIMIT ${paging.limit} OFFSET ${paging.offset})
      SELECT w.vid, w.vyr, w.vdate, w.dr, w.cr, w.net, w.status, w.kind, w.pair_inside,
             w.running, w.total_rows,
             h.avh_branch_id AS branch_id, b.br_name AS branch_name,
             h.avh_voucher_type_id AS vtype_id, t.vchr_type_name AS vtype_name,
             t.vchr_type_short AS vtype_short, h.avh_voucher_refno AS refno,
             h.avh_remarks AS remarks, h.avh_usr_refno AS usr_refno,
             h.avh_created_by AS created_by, u.usr_login_name AS created_by_name,
             h.avh_src_module AS src_module, h.avh_src_doc_type AS src_doc_type,
             h.avh_src_doc_id AS src_doc_id
        FROM w
        JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = w.vid AND h.avh_acc_year = w.vyr
        LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN public.branch_master b ON b.br_id = h.avh_branch_id
        LEFT JOIN public.user_master u
          ON h.avh_created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND u.usr_id = h.avh_created_by::uuid
       ORDER BY w.vdate, w.slno NULLS LAST, w.vid`;
  }

  /** totalRows for a page past the end (the window count comes back with no row). */
  private async countRows(scope: Scope, q: LedgerStatementVouchersDto): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ n: bigint }[]>`
      WITH ${this.kindCtes(scope, q.fromDate, q.toDate)}
      SELECT COUNT(*) AS n FROM k
       WHERE ${q.includeCancelled ?? true}::boolean OR NOT (k.kind <> 'NORMAL' AND k.pair_inside)`;
    return Number(row?.n ?? 0);
  }

  private forwards(
    core: CoreRow[],
    totals: { openingAtFrom: Prisma.Decimal; closing: Prisma.Decimal },
    pastFirstPage: boolean,
  ): { broughtForward: SidedAmount; carriedForward: SidedAmount } {
    if (core.length === 0) {
      // Past the last page everything is behind; on page 1 of an empty range
      // nothing moved.
      const at = pastFirstPage ? totals.closing : totals.openingAtFrom;
      return { broughtForward: sided(at), carriedForward: sided(at) };
    }
    const first = core[0];
    return {
      broughtForward: sided(new Prisma.Decimal(first.running).minus(first.net)),
      carriedForward: sided(core[core.length - 1].running),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §8 — particulars, bill refs, the legs
  // ═════════════════════════════════════════════════════════════════════════

  private async decorate(
    scope: Scope,
    core: CoreRow[],
    opts: { withBillRefs: boolean; withLegs: boolean },
  ): Promise<VoucherRow[]> {
    if (core.length === 0) {
      return [];
    }
    const keys = core.map((r) => ({ vid: r.vid, vyr: r.vyr }));
    const [legs, refs] = await Promise.all([
      this.legsOf(keys),
      opts.withBillRefs
        ? this.billRefsOf(scope, keys)
        : Promise.resolve(new Map<string, string[]>()),
    ]);
    const legsByVoucher = new Map<string, LegRow[]>();
    for (const leg of legs) {
      const k = key(leg.vid, leg.vyr);
      legsByVoucher.set(k, [...(legsByVoucher.get(k) ?? []), leg]);
    }
    return core.map((r) => {
      const vLegs = legsByVoucher.get(key(r.vid, r.vyr)) ?? [];
      const particulars = particularsOf(vLegs, scope.ledgerId);
      return {
        voucherId: r.vid,
        accYear: r.vyr,
        branchId: r.branch_id,
        branchName: r.branch_name,
        date: isoDate(r.vdate),
        voucherTypeId: r.vtype_id,
        voucherTypeName: r.vtype_name,
        voucherTypeShort: r.vtype_short,
        voucherNo: r.refno,
        status: r.status,
        rowKind: r.kind,
        pairOutsideRange: r.kind !== 'NORMAL' && !r.pair_inside,
        particulars,
        asPerDetails: particulars === null,
        legCount: vLegs.length,
        narration: r.remarks?.trim() || r.usr_refno?.trim() || null,
        billRefs: refs.get(key(r.vid, r.vyr)) ?? [],
        debit: money(r.dr),
        credit: money(r.cr),
        balance: sided(r.running),
        createdBy: r.created_by_name ?? r.created_by,
        src: { module: r.src_module, docType: r.src_doc_type, docId: r.src_doc_id },
        ...(opts.withLegs ? { legs: vLegs.map((leg) => toLeg(leg, scope.ledgerId)) } : {}),
      };
    });
  }

  /** Every live leg of the given vouchers, in av_row_no order, with ledger names. */
  private async legsOf(keys: readonly { vid: string; vyr: string }[]): Promise<LegRow[]> {
    if (keys.length === 0) {
      return [];
    }
    return this.prisma.$queryRaw<LegRow[]>`
      SELECT v.av_voucher_id AS vid, v.av_acc_year AS vyr, v.av_row_no AS row_no,
             v.av_dr_cr AS dr_cr, v.av_ledger_id AS ledger_id, l.led_name AS ledger_name,
             v.av_amount AS amount, v.av_role AS role, v.av_remarks AS remarks,
             v.av_opp_ledger_id AS opp_ledger_id, ol.led_name AS opp_ledger_name
        FROM accounts.acc_vouchers v
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
        LEFT JOIN accounts.acc_ledger_master ol ON ol.led_id = v.av_opp_ledger_id
       WHERE (v.av_voucher_id, v.av_acc_year) IN (${Prisma.join(
         keys.map((k) => Prisma.sql`(${k.vid}::uuid, ${k.vyr}::char(9))`),
       )})
         AND v.av_is_deleted = false
       ORDER BY v.av_voucher_id, v.av_row_no`;
  }

  /**
   * §8 — the bills each voucher SETTLES for this party (its adjustment rows, a
   * retracted allocation netting out) and the bill it RAISES (with its due
   * date). Keyed by voucher.
   */
  private async billRefsOf(
    scope: Scope,
    keys: readonly { vid: string; vyr: string }[],
  ): Promise<Map<string, string[]>> {
    const inList = Prisma.join(keys.map((k) => Prisma.sql`(${k.vid}::uuid, ${k.vyr}::char(9))`));
    const rows = await this.prisma.$queryRaw<
      { vid: string; vyr: string; ref: string | null; due: Date | null; raised: boolean }[]
    >`
      SELECT a.abj_voucher_id AS vid, a.abj_voucher_acc_year AS vyr,
             COALESCE(b.abl_voucher_refno, b.abl_doc_refno) AS ref, NULL::date AS due,
             false AS raised
        FROM accounts.acc_bill_adjustment a
        JOIN accounts.acc_bill_balance b
          ON b.abl_id = a.abj_bill_id AND b.abl_acc_year = a.abj_bill_acc_year
       WHERE (a.abj_voucher_id, a.abj_voucher_acc_year) IN (${inList})
         AND a.abj_party_id = ${scope.ledgerId}::uuid
         AND a.abj_is_deleted = false
       GROUP BY a.abj_voucher_id, a.abj_voucher_acc_year, a.abj_bill_id, a.abj_bill_acc_year,
                b.abl_voucher_refno, b.abl_doc_refno
      HAVING SUM(a.abj_amount) <> 0
      UNION ALL
      SELECT b.abl_voucher_id, b.abl_acc_year, COALESCE(b.abl_voucher_refno, b.abl_doc_refno),
             b.abl_due_date, true
        FROM accounts.acc_bill_balance b
       WHERE (b.abl_voucher_id, b.abl_acc_year) IN (${inList})
         AND b.abl_party_id = ${scope.ledgerId}::uuid
         AND b.abl_is_deleted = false`;
    const out = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.ref) {
        continue;
      }
      const text = r.raised && r.due ? `${r.ref} due ${ddmm(r.due)}` : r.ref;
      const k = key(r.vid, r.vyr);
      const list = out.get(k) ?? [];
      if (!list.includes(text)) {
        list.push(text);
      }
      out.set(k, list);
    }
    return out;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The LEDGER DETAIL panel
  // ═════════════════════════════════════════════════════════════════════════

  private async ledgerFacts(scope: Scope): Promise<LedgerFacts> {
    const [r] = await this.prisma.$queryRaw<
      {
        led_id: string;
        led_name: string;
        acc_group_name: string | null;
        acc_group_nature: string | null;
        led_is_bill_by_bill: boolean | null;
        led_gstin_no: string | null;
        led_phone1: string | null;
        led_whatsapp_no: string | null;
        cus_credit_days: number | null;
        cus_credit_amt_limit: Prisma.Decimal | null;
        sup_credit_days: number | null;
      }[]
    >`
      SELECT l.led_id, l.led_name, g.acc_group_name, g.acc_group_nature, l.led_is_bill_by_bill,
             l.led_gstin_no, l.led_phone1, l.led_whatsapp_no,
             c.cus_credit_days, c.cus_credit_amt_limit, s.sup_credit_days
        FROM accounts.acc_ledger_master l
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
        LEFT JOIN sales.customers c ON c.cus_id = l.led_id
        LEFT JOIN purchase.suppliers s ON s.sup_id = l.led_id
       WHERE l.led_id = ${scope.ledgerId}::uuid`;
    const isCustomer = r.cus_credit_days !== null || r.cus_credit_amt_limit !== null;
    return {
      ledgerId: r.led_id,
      name: r.led_name,
      groupName: r.acc_group_name,
      nature: r.acc_group_nature,
      isBillByBill: r.led_is_bill_by_bill === true,
      gstin: r.led_gstin_no?.trim() || null,
      mobile: r.led_phone1?.trim() || r.led_whatsapp_no?.trim() || null,
      creditDays: r.cus_credit_days ?? r.sup_credit_days ?? null,
      // L6 — the plan found no credit-limit column; sales.customers has
      // cus_credit_amt_limit, so a customer ledger shows it. Anything else: null.
      creditLimit:
        isCustomer && r.cus_credit_amt_limit !== null ? money(r.cus_credit_amt_limit) : null,
    };
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function refuse(code: string, field: string, message: string): never {
  throwAccountsBadRequest('Ledger statement request refused', [
    { field, message, code } as { field: string; message: string; code: string },
  ]);
}

function money(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}

/** +DR / −CR, never a minus sign on the wire. */
function sided(value: Prisma.Decimal | string | number): SidedAmount {
  const d = new Prisma.Decimal(value);
  return { amount: d.abs().toFixed(2), side: d.isNegative() ? 'CR' : 'DR' };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function ddmm(value: Date): string {
  const iso = isoDate(value);
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
}

function key(vid: string, vyr: string): string {
  return `${vid}|${vyr.trim()}`;
}

/** 'YYYY-MM' for every month from the one containing `from` to the one containing `to`. */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * §8 — the other side of this ledger in the voucher:
 *   1. this ledger's legs all name the same av_opp_ledger_id → that ledger
 *   2. else exactly one distinct ledger on the OPPOSITE side → that ledger
 *   3. else null — "(as per details)"
 */
function particularsOf(legs: LegRow[], ledgerId: string): string | null {
  const mine = legs.filter((leg) => leg.ledger_id === ledgerId);
  const opp = new Set(mine.map((leg) => leg.opp_ledger_id));
  if (mine.length > 0 && opp.size === 1 && !opp.has(null)) {
    return mine[0].opp_ledger_name;
  }
  const sides = new Set(mine.map((leg) => leg.dr_cr.trim()));
  if (sides.size !== 1) {
    return null;
  }
  const mySide = [...sides][0];
  const others = new Map(
    legs
      .filter((leg) => leg.ledger_id !== ledgerId && leg.dr_cr.trim() !== mySide)
      .map((leg) => [leg.ledger_id, leg.ledger_name]),
  );
  return others.size === 1 ? ([...others.values()][0] ?? null) : null;
}

function toLeg(leg: LegRow, ledgerId: string): VoucherLeg {
  return {
    rowNo: leg.row_no,
    side: leg.dr_cr.trim() === 'CR' ? 'CR' : 'DR',
    ledgerId: leg.ledger_id,
    ledgerName: leg.ledger_name,
    amount: money(leg.amount),
    role: leg.role,
    isThisLedger: leg.ledger_id === ledgerId,
    remarks: leg.remarks,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
