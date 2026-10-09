import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  throwAccountsForbidden,
  throwAccountsNotFound,
  throwUnprocessable,
} from 'src/common/utils/module-service.utils';
import {
  BILL_SORTS,
  PARTY_SORTS,
  type BillSort,
  type OutstandingBillHistoryDto,
  type OutstandingBillWiseDto,
  type OutstandingDueCalendarDto,
  type OutstandingExportDto,
  type OutstandingFilterDto,
  type OutstandingOptionsDto,
  type OutstandingPartiesDto,
  type OutstandingPartyDto,
  type OutstandingSummaryDto,
  type PartySort,
  type SortDir,
} from './dto/party-outstanding-query.dto';
import {
  addDays,
  aboveDaysEdge,
  bucketCount,
  bucketLabels,
  collectionDayNames,
  collectionDayNumber,
  daysBetween,
  isRealIsoDate,
  istToday,
  parseBuckets,
} from './party-outstanding.ageing';
import {
  SUNDRY_CREDITORS_GROUP_ID,
  SUNDRY_DEBTORS_GROUP_ID,
  billsWith,
  bucketColumns,
  branchSummarySql,
  ledgerClosingSql,
  partiesWith,
  partyTotalsCte,
  type SqlScope,
} from './party-outstanding.sql';
import {
  BILL_DATA_WARNING,
  PARTY_OUTSTANDING_ERROR,
  type Bal,
  type BillHistoryPayload,
  type BillsPayload,
  type BillTotals,
  type BillWisePayload,
  type BillWiseRow,
  type DueCalendarPayload,
  type ExportPayload,
  type OptionsPayload,
  type OutstandingSide,
  type PartiesPayload,
  type PartyCardPayload,
  type PartyFacts,
  type PartyFlag,
  type PartyRow,
  type PartyTiles,
  type PartyTotals,
  type PdcItem,
  type ReportHead,
  type Side,
  type SummaryPayload,
  type SummaryRow,
} from './types/party-outstanding.types';

/**
 * Party-wise Outstanding — a read-only report over `acc_bill_balance` +
 * `acc_bill_adjustment`: what each party owed (or was owed) on date D, and how
 * old it is (plan 2026-10-09). It writes nothing.
 *
 * Every figure comes from ONE definition of "pending as on D" (§4), built in
 * party-outstanding.sql.ts:
 *
 *   pending(b, D) = bill − Σ adjustment rows dated ≤ D − tendered(b)
 *   tendered(b)   = cached alloc + disc + writeoff − Σ rows that cache counts
 *                   (a counter tender has no row — §3.1; 0 once O1 is fixed)
 *
 * over the bills §4.2's chain rule keeps (a carried-forward parent is replaced
 * by its OPENING copy). "As on D, as the books stand today": a reversal carries
 * the original date (§3.3), so a later cancel changes an earlier D.
 *
 * Deliberately NOT BillBalanceService.getCreditSummary, the receipt / payment
 * open-items routes or the grid runner (§2): no as-on date, and they count a
 * carried bill twice after 1 April.
 */

/**
 * "Party Outstanding" under 6 Reports (§10; migration 20261009100000 made it under 137 Financial
 * Statements, 20261009150000 moved it). The id never changed, so grants carry over.
 */
export const PARTY_OUTSTANDING_MENU_ID = 279;
const EXPORT_ROW_CAP = 20_000;
const DEFAULT_PAGE_SIZE = 200;
const DUE_NEXT_DAYS = 7;
const CALENDAR_MAX_DAYS = 92;
const ZERO = new Prisma.Decimal(0);

interface Scope extends SqlScope {
  labels: string[];
  isFuture: boolean;
  /** The side's default group (Sundry Debtors / Creditors), null if the chart lost it. */
  rootGroupId: string | null;
}

type Num = Prisma.Decimal | string | number;

interface PartyAggRow {
  party_id: string | null;
  name: string | null;
  area_name: string | null;
  phone: string | null;
  credit_days: number | null;
  credit_limit: Prisma.Decimal | null;
  bills: bigint | null;
  owed: Prisma.Decimal | null;
  on_account: Prisma.Decimal | null;
  overdue: Prisma.Decimal | null;
  oldest: number | null;
  pdc_amt: Prisma.Decimal | null;
  net: Prisma.Decimal | null;
  bounced: boolean | null;
  t_parties: bigint;
  t_bills: bigint;
  t_owed: Prisma.Decimal;
  t_on_account: Prisma.Decimal;
  t_net: Prisma.Decimal;
  t_overdue: Prisma.Decimal;
  t_pdc_amt: Prisma.Decimal;
  t_pdc_n: bigint | Prisma.Decimal;
  t_above_amt: Prisma.Decimal;
  t_above_parties: bigint;
  t_due_next: Prisma.Decimal;
  [bucket: string]: unknown;
}

interface BillDbRow {
  abl_id: string | null;
  abl_acc_year: string | null;
  party_id: string | null;
  party_name: string | null;
  area_name: string | null;
  br_name: string | null;
  abl_bill_type: string | null;
  abl_src_doc_type: string | null;
  abl_src_doc_id: string | null;
  abl_src_acc_year: string | null;
  abl_voucher_id: string | null;
  doc_refno: string | null;
  abl_doc_date: Date | null;
  abl_due_date: Date | null;
  due_eff: Date | null;
  bill_amount: Prisma.Decimal | null;
  pending: Prisma.Decimal | null;
  gap: Prisma.Decimal | null;
  is_owed: boolean | null;
  age_days: number | null;
  overdue_days: number | null;
  t_bills: bigint;
  t_bill_amount: Prisma.Decimal;
  t_pending: Prisma.Decimal;
  t_net: Prisma.Decimal;
}

interface AdjRow {
  abj_id: string;
  bill_id: string;
  bill_yr: string;
  adj_type: string;
  adj_date: Date;
  created_on: Date | null;
  row_no: number | null;
  reversal_of: string | null;
  reason: string | null;
  refno: string | null;
}

@Injectable()
export class PartyOutstandingService {
  private readonly logger = new Logger(PartyOutstandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.1 — filter sources
  // ═════════════════════════════════════════════════════════════════════════

  async options(q: OutstandingOptionsDto): Promise<OptionsPayload> {
    await this.assertMenuRight();
    const receivable = q.side === 'RECEIVABLE';
    const rootId = await this.rootGroupId(q.companyId, q.side);
    const [groups, areas, salesmen, branches] = await Promise.all([
      rootId
        ? this.prisma.$queryRaw<{ id: string; name: string; depth: number }[]>`
            WITH RECURSIVE t AS (
              SELECT g.acc_group_id AS id, g.acc_group_name AS name, 0 AS depth,
                     ARRAY[lower(g.acc_group_name), g.acc_group_id::text] AS path
                FROM accounts.acc_group_master g
               WHERE g.acc_group_id = ${rootId}::uuid
              UNION ALL
              SELECT g.acc_group_id, g.acc_group_name, t.depth + 1,
                     t.path || ARRAY[lower(g.acc_group_name), g.acc_group_id::text]
                FROM accounts.acc_group_master g
                JOIN t ON g.acc_group_parent_id = t.id
               WHERE g.acc_group_is_deleted = false
                 AND (g.acc_group_company_id IS NULL OR g.acc_group_company_id = ${q.companyId}::uuid)
                 AND t.depth < 24)
            SELECT id, name, depth FROM t ORDER BY path`
        : Promise.resolve([]),
      receivable
        ? this.prisma.$queryRaw<{ arm_id: string; arm_name: string; days: number[] | null }[]>`
            SELECT arm_id, arm_name, arm_collection_days AS days
              FROM sales.area_master
             WHERE arm_is_deleted = false AND arm_is_active IS DISTINCT FROM false
             ORDER BY arm_sort NULLS LAST, lower(arm_name), arm_id`
        : Promise.resolve([]),
      receivable
        ? this.prisma.$queryRaw<{ emp_id: string; emp_name: string }[]>`
            SELECT e.emp_id, e.emp_name
              FROM public.employee_master e
             WHERE e.emp_is_deleted = false
               AND ((e.emp_is_active IS DISTINCT FROM false
                     AND (e.emp_company_id IS NULL OR e.emp_company_id = ${q.companyId}::uuid))
                    OR EXISTS (SELECT 1 FROM sales.customers c
                                WHERE c.cus_default_salesman = e.emp_id AND c.cus_is_deleted = false))
             ORDER BY lower(e.emp_name), e.emp_id`
        : Promise.resolve([]),
      this.prisma.$queryRaw<{ br_id: string; br_name: string }[]>`
        SELECT br_id, br_name FROM public.branch_master
         WHERE br_comp_id = ${q.companyId}::uuid AND br_is_deleted IS DISTINCT FROM true
         ORDER BY br_is_default DESC NULLS LAST, lower(br_name), br_id`,
    ]);
    return {
      groups: groups.map((g) => ({
        groupId: g.id,
        name: g.name,
        depth: Number(g.depth),
        isDefault: g.id === rootId,
      })),
      areas: areas.map((a) => ({
        areaId: a.arm_id,
        name: a.arm_name,
        collectionDays: collectionDayNames(a.days),
      })),
      salesmen: salesmen.map((s) => ({ salesmanId: s.emp_id, name: s.emp_name })),
      branches: branches.map((b) => ({ branchId: b.br_id, name: b.br_name })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.2 — the party grid, tiles and totals
  // ═════════════════════════════════════════════════════════════════════════

  async parties(q: OutstandingPartiesDto): Promise<PartiesPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q, { partyOnly: false });
    const sort = q.sort ?? 'net';
    this.assertPartySort(scope, sort);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
    const raw = await this.partyRows(scope, sort, q.dir ?? 'desc', pageSize, (page - 1) * pageSize);
    const { tiles, totals } = this.tilesAndTotals(scope, raw[0]);
    return {
      ...head(scope),
      tiles,
      rows: raw.filter((r) => r.party_id !== null).map((r) => this.toPartyRow(scope, r)),
      totals,
      page: { page, pageSize, totalRows: Number(raw[0].t_parties) },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.3 — the party card
  // ═════════════════════════════════════════════════════════════════════════

  async party(q: OutstandingPartyDto): Promise<PartyCardPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q, { partyOnly: true });
    return this.card(scope, q.partyId);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.4 — the open items of one party
  // ═════════════════════════════════════════════════════════════════════════

  async bills(q: OutstandingPartyDto): Promise<BillsPayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q, { partyOnly: true });
    const [list, closing] = await Promise.all([
      this.billRows(scope, { sort: 'date', dir: 'asc', limit: null, offset: 0, dueOn: null }),
      this.ledgerClosing(scope, q.partyId),
    ]);
    return {
      ...head(scope),
      partyId: q.partyId,
      rows: list.rows,
      totals: list.totals,
      ledgerClosing: closing,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.5 — open items across parties
  // ═════════════════════════════════════════════════════════════════════════

  async billWise(q: OutstandingBillWiseDto): Promise<BillWisePayload> {
    await this.assertMenuRight();
    const scope = await this.resolveScope(q, { partyOnly: false });
    if (q.dueOn && !isRealIsoDate(q.dueOn)) {
      refuse(PARTY_OUTSTANDING_ERROR.RANGE_REVERSED, 'dueOn', `${q.dueOn} is not a calendar date.`);
    }
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
    const list = await this.billRows(scope, {
      sort: q.sort ?? 'date',
      dir: q.dir ?? 'asc',
      limit: pageSize,
      offset: (page - 1) * pageSize,
      dueOn: q.dueOn ?? null,
    });
    return {
      ...head(scope),
      rows: list.rows,
      totals: list.totals,
      page: { page, pageSize, totalRows: list.totals.bills },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.6 — what settled one bill (3.0's payments grid)
  // ═════════════════════════════════════════════════════════════════════════

  async billHistory(q: OutstandingBillHistoryDto): Promise<BillHistoryPayload> {
    await this.assertMenuRight();
    if (!isRealIsoDate(q.asOn)) {
      refuse(
        PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS,
        'asOn',
        `${q.asOn} is not a calendar date.`,
      );
    }
    const [bill] = await this.prisma.$queryRaw<
      {
        abl_id: string;
        abl_acc_year: string;
        abl_party_id: string;
        doc_refno: string | null;
        abl_doc_date: Date;
        abl_bill_type: string;
        dr_cr: string;
        abl_bill_amount: Prisma.Decimal;
        cached: Prisma.Decimal;
      }[]
    >`
      SELECT abl_id, abl_acc_year, abl_party_id,
             COALESCE(abl_doc_refno, abl_voucher_refno) AS doc_refno, abl_doc_date, abl_bill_type,
             btrim(abl_dr_cr) AS dr_cr, abl_bill_amount,
             abl_alloc_amount + abl_disc_amount + abl_writeoff_amount AS cached
        FROM accounts.acc_bill_balance
       WHERE abl_id = ${q.billId}::uuid AND abl_acc_year = ${q.accYear}::char(9)
         AND abl_company_id = ${q.companyId}::uuid AND abl_is_deleted = false`;
    if (!bill) {
      throwAccountsNotFound(
        'Bill not found',
        'billId',
        `No bill ${q.billId} in ${q.accYear} for this company`,
      );
    }
    const rows = await this.prisma.$queryRaw<
      {
        abj_id: string;
        abj_adj_date: Date;
        abj_adj_type: string;
        abj_voucher_id: string | null;
        abj_voucher_acc_year: string | null;
        refno: string | null;
        vtype: string | null;
        against_refno: string | null;
        abj_amount: Prisma.Decimal;
        abj_reversal_of_id: string | null;
        abj_reversal_reason: string | null;
        post_dated: boolean;
        cheque_no: string | null;
      }[]
    >`
      SELECT a.abj_id, a.abj_adj_date, a.abj_adj_type, a.abj_voucher_id, a.abj_voucher_acc_year,
             h.avh_voucher_refno AS refno, t.vchr_type_name AS vtype,
             COALESCE(ab.abl_doc_refno, ab.abl_voucher_refno) AS against_refno,
             a.abj_amount, a.abj_reversal_of_id, a.abj_reversal_reason,
             COALESCE(a.abj_is_post_dated, false) AS post_dated,
             r.apd_instrument_no AS cheque_no
        FROM accounts.acc_bill_adjustment a
        LEFT JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = a.abj_voucher_id AND h.avh_acc_year = a.abj_voucher_acc_year
        LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_bill_balance ab
          ON ab.abl_id = a.abj_against_bill_id AND ab.abl_acc_year = a.abj_against_bill_acc_year
        LEFT JOIN accounts.acc_pdc_register r
          ON r.apd_id = a.abj_cheque_id AND r.apd_acc_year = a.abj_cheque_acc_year
       WHERE a.abj_bill_id = ${q.billId}::uuid AND a.abj_bill_acc_year = ${q.accYear}::char(9)
         AND a.abj_is_deleted = false
       ORDER BY a.abj_adj_date, a.abj_row_no NULLS LAST, a.abj_created_on, a.abj_id`;

    // §4.3 for ONE bill — the same terms the SQL builds for many.
    const today = istToday();
    const docDate = isoDate(bill.abl_doc_date);
    let setD = ZERO;
    let setCache = ZERO;
    for (const r of rows) {
      const d = isoDate(r.abj_adj_date);
      if (d <= q.asOn) {
        setD = setD.plus(r.abj_amount);
      }
      if (!(r.post_dated && d > today)) {
        setCache = setCache.plus(r.abj_amount);
      }
    }
    const gap = new Prisma.Decimal(bill.cached).minus(setCache);
    const tendered = gap.greaterThan(0) ? gap : ZERO;
    const pending =
      docDate <= q.asOn
        ? new Prisma.Decimal(bill.abl_bill_amount).minus(setD).minus(tendered)
        : ZERO;
    return {
      asOn: q.asOn,
      bill: {
        billId: bill.abl_id,
        accYear: bill.abl_acc_year.trim(),
        partyId: bill.abl_party_id,
        docRefno: bill.doc_refno,
        docDate,
        billType: bill.abl_bill_type,
        side: bill.dr_cr === 'CR' ? 'CR' : 'DR',
        billAmount: money(bill.abl_bill_amount),
        pending: money(pending),
      },
      rows: rows.map((r) => ({
        adjustmentId: r.abj_id,
        date: isoDate(r.abj_adj_date),
        adjType: r.abj_adj_type,
        voucherId: r.abj_voucher_id,
        voucherAccYear: r.abj_voucher_acc_year?.trim() ?? null,
        voucherNo: r.refno,
        voucherType: r.vtype,
        againstDocRefno: r.against_refno,
        amount: money(r.abj_amount),
        isReversal: r.abj_reversal_of_id !== null,
        reversalReason: r.abj_reversal_reason,
        isPostDated: r.post_dated,
        chequeNo: r.cheque_no,
        effective: isoDate(r.abj_adj_date) <= q.asOn,
      })),
      tenderAtBill: tendered.greaterThan(0) ? money(tendered) : null,
      ...(gap.isNegative() ? { dataWarning: BILL_DATA_WARNING.ALLOC_BELOW_ROWS } : {}),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.7 — Group / area summary
  // ═════════════════════════════════════════════════════════════════════════

  async summary(q: OutstandingSummaryDto): Promise<SummaryPayload> {
    await this.assertMenuRight();
    if (q.side === 'PAYABLE' && (q.groupBy === 'AREA' || q.groupBy === 'SALESMAN')) {
      refuse(
        PARTY_OUTSTANDING_ERROR.NOT_FOR_PAYABLE,
        'groupBy',
        `${q.groupBy} applies to customers only — suppliers have no area or salesman.`,
      );
    }
    const scope = await this.resolveScope(q, { partyOnly: false });
    const cols = bucketColumns(scope);
    const [rows, totalsRaw] = await Promise.all([
      q.groupBy === 'BRANCH'
        ? this.prisma.$queryRaw<Record<string, unknown>[]>(branchSummarySql(scope))
        : this.prisma.$queryRaw<Record<string, unknown>[]>(
            this.partySummarySql(scope, q.groupBy, cols),
          ),
      this.partyRows(scope, 'net', 'desc', 0, 0),
    ]);
    const blank = {
      AREA: '(no area)',
      GROUP: '(no group)',
      SALESMAN: '(no salesman)',
      BRANCH: '(no branch)',
    }[q.groupBy];
    const { totals } = this.tilesAndTotals(scope, totalsRaw[0]);
    return {
      ...head(scope),
      groupBy: q.groupBy,
      rows: rows
        .filter((r) => Number(r.parties) > 0 || !new Prisma.Decimal(r.net as Num).isZero())
        .map(
          (r): SummaryRow => ({
            key: (r.key as string | null) ?? null,
            name: (r.name as string | null) ?? blank,
            parties: Number(r.parties),
            owed: money(r.owed as Num),
            onAccount: money(r.on_account as Num),
            net: bal(r.net as Num, scope.owedSide),
            buckets: cols.map((c) => money(r[c] as Num)),
            overdue: money(r.overdue as Num),
          }),
        ),
      totals: {
        parties: Number(totalsRaw[0].t_parties),
        owed: totals.owed,
        onAccount: totals.onAccount,
        net: totals.net,
        buckets: totals.buckets,
        overdue: totals.overdue,
      },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.8 — Due calendar
  // ═════════════════════════════════════════════════════════════════════════

  async dueCalendar(q: OutstandingDueCalendarDto): Promise<DueCalendarPayload> {
    await this.assertMenuRight();
    if (!isRealIsoDate(q.from) || !isRealIsoDate(q.to) || q.from > q.to) {
      refuse(PARTY_OUTSTANDING_ERROR.RANGE_REVERSED, 'from', `${q.from} – ${q.to} is not a range.`);
    }
    const span = daysBetween(q.from, q.to) + 1;
    if (span > CALENDAR_MAX_DAYS) {
      refuse(
        PARTY_OUTSTANDING_ERROR.RANGE_TOO_LARGE,
        'to',
        `${span} days — the calendar shows at most ${CALENDAR_MAX_DAYS}.`,
      );
    }
    const scope = await this.resolveScope(q, { partyOnly: false });
    const rows = await this.prisma.$queryRaw<
      { kind: string; d: Date | null; amt: Prisma.Decimal; n: bigint; parties: bigint }[]
    >`
      ${billsWith(scope, true)}
      SELECT 'D' AS kind, x.due_eff AS d, SUM(x.pending) AS amt, COUNT(*) AS n,
             COUNT(DISTINCT x.party_id) AS parties
        FROM o x
       WHERE x.is_owed AND x.due_eff BETWEEN ${q.from}::date AND ${q.to}::date
       GROUP BY x.due_eff
      UNION ALL
      SELECT 'B', NULL::date, COALESCE(SUM(x.pending), 0), COUNT(*), COUNT(DISTINCT x.party_id)
        FROM o x
       WHERE x.is_owed AND x.due_eff < ${q.from}::date
       ORDER BY 1, 2`;
    const before = rows.find((r) => r.kind === 'B');
    return {
      asOn: scope.asOn,
      side: scope.side,
      from: q.from,
      to: q.to,
      days: rows
        .filter((r) => r.kind === 'D' && r.d !== null)
        .map((r) => ({
          date: isoDate(r.d as Date),
          amount: money(r.amt),
          bills: Number(r.n),
          parties: Number(r.parties),
        })),
      overdueBefore: { amount: money(before?.amt ?? ZERO), bills: Number(before?.n ?? 0) },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.9 — rows for Print / PDF / Excel / WhatsApp
  // ═════════════════════════════════════════════════════════════════════════

  async export(q: OutstandingExportDto): Promise<ExportPayload> {
    await this.assertMenuRight();
    if (q.shape === 'PARTY_STATEMENT' && !q.partyId) {
      refuse(PARTY_OUTSTANDING_ERROR.PARTY_REQUIRED, 'partyId', 'A party statement needs partyId.');
    }
    const scope = await this.resolveScope(q, { partyOnly: q.shape === 'PARTY_STATEMENT' });
    const names = await this.printNames(scope, q);
    const common = {
      ...head(scope),
      printedAs: this.printedAs(scope, q, names),
      companyName: names.company,
      branchName: names.branch,
    };

    if (q.shape === 'PARTIES') {
      const sort = (q.sort ?? 'net') as PartySort;
      if (!(PARTY_SORTS as readonly string[]).includes(sort)) {
        refuse(PARTY_OUTSTANDING_ERROR.BAD_SORT, 'sort', `${sort} is not a party sort.`);
      }
      this.assertPartySort(scope, sort);
      const raw = await this.partyRows(scope, sort, q.dir ?? 'desc', EXPORT_ROW_CAP + 1, 0);
      this.assertCap(Number(raw[0].t_parties));
      const { tiles, totals } = this.tilesAndTotals(scope, raw[0]);
      const rows = raw.filter((r) => r.party_id !== null).map((r) => this.toPartyRow(scope, r));
      return { ...common, shape: 'PARTIES', rows, totals, tiles, totalRows: rows.length };
    }

    if (q.shape === 'BILLS') {
      const sort = (q.sort ?? 'date') as BillSort;
      if (!(BILL_SORTS as readonly string[]).includes(sort)) {
        refuse(PARTY_OUTSTANDING_ERROR.BAD_SORT, 'sort', `${sort} is not a bill sort.`);
      }
      const list = await this.billRows(scope, {
        sort,
        dir: q.dir ?? 'asc',
        limit: EXPORT_ROW_CAP + 1,
        offset: 0,
        dueOn: null,
      });
      this.assertCap(list.totals.bills);
      return {
        ...common,
        shape: 'BILLS',
        rows: list.rows,
        totals: list.totals,
        totalRows: list.rows.length,
      };
    }

    const partyId = q.partyId as string;
    const [card, list] = await Promise.all([
      this.card(scope, partyId),
      this.billRows(scope, {
        sort: 'date',
        dir: 'asc',
        limit: EXPORT_ROW_CAP + 1,
        offset: 0,
        dueOn: null,
      }),
    ]);
    this.assertCap(list.totals.bills);
    return {
      ...common,
      shape: 'PARTY_STATEMENT',
      party: card.party,
      rows: list.rows,
      totals: list.totals,
      ageing: card.ageing,
      owed: card.owed,
      onAccount: card.onAccount,
      net: card.net,
      pdcInHand: card.pdcInHand,
      totalRows: list.rows.length,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The guards — §8
  // ═════════════════════════════════════════════════════════════════════════

  /** 403 unless the caller may view menu 279 "Party Outstanding" — on every route. */
  private async assertMenuRight(): Promise<void> {
    const userId = this.requestContext.getUserId();
    const rows = isUuid(userId)
      ? await this.prisma.$queryRaw<{ ok: boolean }[]>`
          SELECT true AS ok FROM public.user_menus
           WHERE um_user_id = ${userId}::uuid
             AND um_menu_id = ${PARTY_OUTSTANDING_MENU_ID}::int
             AND um_can_view = true AND um_is_deleted = false
           LIMIT 1`
      : [];
    if (rows.length === 0) {
      throwAccountsForbidden('No access to Party-wise Outstanding', [
        {
          field: 'menu',
          code: PARTY_OUTSTANDING_ERROR.NO_MENU_RIGHT,
          message: `This user may not view menu ${PARTY_OUTSTANDING_MENU_ID} (Reports › Party Outstanding).`,
        },
      ]);
    }
  }

  /**
   * NOT_FOR_PAYABLE, BAD_BUCKETS, AS_ON_OUTSIDE_YEARS, BRANCH_NOT_IN_COMPANY,
   * PARTY_NOT_IN_COMPANY — in that order.
   *
   * `partyOnly` (the card, one party's bills, the statement): the group / area
   * / salesman / collection-day filters are dropped — one party's figures do
   * not depend on how the grid was filtered — and so are the party-level ones
   * (hideZero; onlyOverdue and the due-days window still pick BILLS).
   */
  private async resolveScope(
    q: OutstandingFilterDto & { partyId?: string },
    opts: { partyOnly: boolean },
  ): Promise<Scope> {
    const receivable = q.side === 'RECEIVABLE';
    if (!receivable && !opts.partyOnly) {
      const field = q.areaId
        ? 'areaId'
        : q.salesmanId
          ? 'salesmanId'
          : q.collectionDay
            ? 'collectionDay'
            : null;
      if (field) {
        refuse(
          PARTY_OUTSTANDING_ERROR.NOT_FOR_PAYABLE,
          field,
          'Area, salesman and collection day apply to customers only.',
        );
      }
    }
    const edges = parseBuckets(q.buckets);
    if (!edges) {
      refuse(
        PARTY_OUTSTANDING_ERROR.BAD_BUCKETS,
        'buckets',
        'Buckets must be 1 to 6 rising whole numbers of days, at most 3650, e.g. 30,60,90,180.',
      );
    }
    if (!isRealIsoDate(q.asOn)) {
      refuse(
        PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS,
        'asOn',
        `${q.asOn} is not a calendar date.`,
      );
    }
    if (q.minDueDays !== undefined && q.maxDueDays !== undefined && q.minDueDays > q.maxDueDays) {
      refuse(
        PARTY_OUTSTANDING_ERROR.RANGE_REVERSED,
        'minDueDays',
        `Due days ≥ ${q.minDueDays} and ≤ ${q.maxDueDays} cannot both hold.`,
      );
    }

    const [fy] = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT fy_year_name AS name FROM public.fiscal_years
       WHERE comp_id = ${q.companyId}::uuid AND is_deleted = false
         AND ${q.asOn}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC
       LIMIT 1`;
    if (!fy) {
      refuse(
        PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS,
        'asOn',
        `${q.asOn} is outside every financial year set up for this company.`,
      );
    }
    if (q.branchId) {
      const [br] = await this.prisma.$queryRaw<{ br_comp_id: string | null }[]>`
        SELECT br_comp_id FROM public.branch_master WHERE br_id = ${q.branchId}::uuid`;
      if (!br || br.br_comp_id !== q.companyId) {
        refuse(
          PARTY_OUTSTANDING_ERROR.BRANCH_NOT_IN_COMPANY,
          'branchId',
          'That branch is not part of this company.',
        );
      }
    }
    if (q.partyId) {
      const [hit] = await this.prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM accounts.acc_ledger_master
                        WHERE led_id = ${q.partyId}::uuid
                          AND (led_company_id IS NULL OR led_company_id = ${q.companyId}::uuid))
            OR EXISTS (SELECT 1 FROM accounts.acc_bill_balance
                        WHERE abl_party_id = ${q.partyId}::uuid
                          AND abl_company_id = ${q.companyId}::uuid) AS ok`;
      if (!hit?.ok) {
        refuse(
          PARTY_OUTSTANDING_ERROR.PARTY_NOT_IN_COMPANY,
          'partyId',
          'This party belongs to another company.',
        );
      }
    }

    const rootGroupId = await this.rootGroupId(q.companyId, q.side);
    const groupId = q.groupId ?? rootGroupId;
    const today = istToday();
    const ageBy = q.ageBy ?? 'BILL_DATE';
    const partyOnly = opts.partyOnly;
    return {
      companyId: q.companyId,
      asOn: q.asOn,
      today,
      fyName: fy.name.trim(),
      branchId: q.branchId ?? null,
      side: q.side,
      owedSide: receivable ? 'DR' : 'CR',
      traType: receivable ? 'R' : 'P',
      group: partyOnly
        ? null
        : // A chart that lost its Sundry group still has its customers / suppliers.
          {
            groupId: groupId ?? NIL_UUID,
            rootRole: groupId === null || groupId === rootGroupId,
          },
      areaId: partyOnly ? null : (q.areaId ?? null),
      salesmanId: partyOnly ? null : (q.salesmanId ?? null),
      collectionDay: partyOnly || !q.collectionDay ? null : collectionDayNumber(q.collectionDay),
      partyId: q.partyId ?? null,
      ageBy,
      edges,
      includeOnAccount: q.includeOnAccount ?? true,
      onlyOverdue: q.onlyOverdue ?? false,
      minDueDays: q.minDueDays ?? null,
      maxDueDays: q.maxDueDays ?? null,
      deductPdc: q.deductPdc ?? false,
      hideZero: partyOnly ? false : (q.hideZero ?? true),
      labels: bucketLabels(edges, ageBy),
      isFuture: q.asOn > today,
      rootGroupId,
    };
  }

  /** Sundry Debtors (Receivable) / Sundry Creditors (Payable): the pinned id, else by name. */
  private async rootGroupId(companyId: string, side: OutstandingSide): Promise<string | null> {
    const pinned = side === 'RECEIVABLE' ? SUNDRY_DEBTORS_GROUP_ID : SUNDRY_CREDITORS_GROUP_ID;
    const name = side === 'RECEIVABLE' ? 'sundry debtors' : 'sundry creditors';
    const [row] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT acc_group_id AS id FROM accounts.acc_group_master
       WHERE acc_group_is_deleted = false
         AND (acc_group_company_id IS NULL OR acc_group_company_id = ${companyId}::uuid)
         AND (acc_group_id = ${pinned}::uuid OR lower(btrim(acc_group_name)) = ${name})
       ORDER BY (acc_group_id = ${pinned}::uuid) DESC, acc_group_company_id NULLS LAST
       LIMIT 1`;
    return row?.id ?? null;
  }

  private assertPartySort(scope: Scope, sort: PartySort): void {
    const m = /^bucket(\d)$/.exec(sort);
    if (m && Number(m[1]) >= bucketCount(scope.edges, scope.ageBy)) {
      refuse(
        PARTY_OUTSTANDING_ERROR.BAD_SORT,
        'sort',
        `${sort}: these buckets have ${scope.labels.length} columns (bucket0 … bucket${scope.labels.length - 1}).`,
      );
    }
  }

  private assertCap(count: number): void {
    if (count > EXPORT_ROW_CAP) {
      throwUnprocessable('Range too large', [
        {
          field: 'shape',
          code: PARTY_OUTSTANDING_ERROR.RANGE_TOO_LARGE,
          count,
          message: `${count} rows — the export stops at ${EXPORT_ROW_CAP}. Narrow the filters.`,
        },
      ]);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Parties — pf, its totals and one page, in ONE statement (one snapshot)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Always at least one row: `tot` LEFT JOIN the page, so the totals arrive
   * even past the last page (party_id is then null).
   */
  private async partyRows(
    scope: Scope,
    sort: PartySort,
    dir: SortDir,
    limit: number,
    offset: number,
  ): Promise<PartyAggRow[]> {
    const order = partyOrder(sort, dir);
    return this.prisma.$queryRaw<PartyAggRow[]>`
      ${partiesWith(scope)}, ${partyTotalsCte(scope)},
      pg AS (
        SELECT pf.*, ROW_NUMBER() OVER (ORDER BY ${order}) AS ord
          FROM pf
         ORDER BY ${order}
         LIMIT ${limit} OFFSET ${offset})
      SELECT tot.*, pg.* FROM tot LEFT JOIN pg ON true ORDER BY pg.ord`;
  }

  private toPartyRow(scope: Scope, r: PartyAggRow): PartyRow {
    const net = new Prisma.Decimal(r.net ?? 0);
    const limit = r.credit_limit === null ? null : new Prisma.Decimal(r.credit_limit);
    const flags: PartyFlag[] = [];
    if (r.bounced) {
      flags.push('CHQ_BOUNCED');
    }
    if (scope.side === 'RECEIVABLE' && limit && limit.greaterThan(0) && net.greaterThan(limit)) {
      flags.push('OVER_LIMIT');
    }
    if (r.oldest !== null && r.oldest > scope.edges[scope.edges.length - 1]) {
      flags.push('OVER_180');
    }
    if (net.isNegative()) {
      flags.push('ADVANCE');
    }
    return {
      partyId: r.party_id as string,
      name: r.name ?? '',
      area: r.area_name,
      phone: r.phone,
      creditDays: r.credit_days === null ? null : Number(r.credit_days),
      creditLimit: limit ? money(limit) : null,
      bills: Number(r.bills ?? 0),
      owed: money(r.owed ?? 0),
      onAccount: money(r.on_account ?? 0),
      net: bal(net, scope.owedSide),
      buckets: bucketColumns(scope).map((c) => money((r[c] as Num | null) ?? 0)),
      overdue: money(r.overdue ?? 0),
      oldestDays: r.oldest === null ? null : Number(r.oldest),
      pdcInHand: money(r.pdc_amt ?? 0),
      flags,
    };
  }

  private tilesAndTotals(scope: Scope, t: PartyAggRow): { tiles: PartyTiles; totals: PartyTotals } {
    const owed = new Prisma.Decimal(t.t_owed);
    const overdue = new Prisma.Decimal(t.t_overdue);
    const net = bal(t.t_net, scope.owedSide);
    return {
      tiles: {
        net,
        parties: Number(t.t_parties),
        bills: Number(t.t_bills),
        overdue: money(overdue),
        overduePctOfOwed: owed.greaterThan(0)
          ? overdue.div(owed).times(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toString()
          : '0',
        aboveDays: {
          days: aboveDaysEdge(scope.edges),
          amount: money(t.t_above_amt),
          parties: Number(t.t_above_parties),
        },
        onAccount: money(t.t_on_account),
        pdcInHand: { amount: money(t.t_pdc_amt), cheques: Number(t.t_pdc_n) },
        dueNext: {
          days: DUE_NEXT_DAYS,
          amount: money(t.t_due_next),
          from: addDays(scope.asOn, 1),
          to: addDays(scope.asOn, DUE_NEXT_DAYS),
        },
      },
      totals: {
        bills: Number(t.t_bills),
        owed: money(owed),
        onAccount: money(t.t_on_account),
        net,
        buckets: bucketColumns(scope).map((c) => money(t[`t_${c}`] as Num)),
        overdue: money(overdue),
        pdcInHand: money(t.t_pdc_amt),
      },
    };
  }

  private partySummarySql(
    scope: Scope,
    groupBy: 'AREA' | 'GROUP' | 'SALESMAN',
    cols: string[],
  ): Prisma.Sql {
    const key = { AREA: 'pf.area_id', GROUP: 'pf.group_id', SALESMAN: 'pf.salesman_id' }[groupBy];
    const name = {
      AREA: Prisma.sql`(SELECT a.arm_name FROM sales.area_master a WHERE a.arm_id = sg.key)`,
      GROUP: Prisma.sql`(SELECT g.acc_group_name FROM accounts.acc_group_master g WHERE g.acc_group_id = sg.key)`,
      SALESMAN: Prisma.sql`(SELECT e.emp_name FROM public.employee_master e WHERE e.emp_id = sg.key)`,
    }[groupBy];
    const sums = cols.map((c) => Prisma.sql`SUM(pf.${Prisma.raw(c)}) AS ${Prisma.raw(c)}`);
    return Prisma.sql`
      ${partiesWith(scope)},
      sg AS (
        SELECT ${Prisma.raw(key)} AS key, COUNT(*) AS parties, SUM(pf.owed) AS owed,
               SUM(pf.on_account) AS on_account, SUM(pf.net) AS net,
               ${Prisma.join(sums, ', ')}, SUM(pf.overdue) AS overdue
          FROM pf
         GROUP BY 1)
      SELECT sg.*, ${name} AS name FROM sg ORDER BY name NULLS LAST, sg.key`;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Bills — /bills, /bill-wise, the exports
  // ═════════════════════════════════════════════════════════════════════════

  private async billRows(
    scope: Scope,
    p: { sort: BillSort; dir: SortDir; limit: number | null; offset: number; dueOn: string | null },
  ): Promise<{ rows: BillWiseRow[]; totals: BillTotals }> {
    const where = p.dueOn
      ? Prisma.sql`x.is_owed AND x.due_eff = ${p.dueOn}::date`
      : Prisma.sql`true`;
    const order = billOrder(p.sort, p.dir);
    const limit = p.limit === null ? Prisma.empty : Prisma.sql`LIMIT ${p.limit} OFFSET ${p.offset}`;
    const raw = await this.prisma.$queryRaw<BillDbRow[]>`
      ${billsWith(scope, true)},
      tot AS (
        SELECT COUNT(*) AS t_bills, COALESCE(SUM(x.bill_amount), 0) AS t_bill_amount,
               COALESCE(SUM(x.pending), 0) AS t_pending, COALESCE(SUM(x.signed), 0) AS t_net
          FROM o x WHERE ${where}),
      pg AS (
        SELECT x.*, pt.name AS party_name, pt.area_name, br.br_name,
               ROW_NUMBER() OVER (ORDER BY ${order}) AS ord
          FROM o x
          JOIN pty pt ON pt.party_id = x.party_id
          LEFT JOIN public.branch_master br ON br.br_id = x.abl_branch_id
         WHERE ${where}
         ORDER BY ${order}
         ${limit})
      SELECT tot.*, pg.* FROM tot LEFT JOIN pg ON true ORDER BY pg.ord`;
    const t = raw[0];
    const billRaw = raw.filter((r) => r.abl_id !== null);
    const remarks = await this.remarksOf(scope, billRaw);
    const rows = billRaw.map((r) => {
      const isOwed = r.is_owed === true;
      const gap = new Prisma.Decimal(r.gap ?? 0);
      const row: BillWiseRow = {
        billId: r.abl_id as string,
        accYear: (r.abl_acc_year as string).trim(),
        branchName: r.br_name,
        docDate: isoDate(r.abl_doc_date as Date),
        docRefno: r.doc_refno,
        billType: r.abl_bill_type as string,
        srcDocType: r.abl_src_doc_type,
        srcDocId: r.abl_src_doc_id,
        srcAccYear: r.abl_src_acc_year?.trim() ?? null,
        voucherId: r.abl_voucher_id,
        side: isOwed ? 'OWED' : 'ON_ACCOUNT',
        dueDate: r.abl_due_date ? isoDate(r.abl_due_date) : null,
        dueEff: isoDate(r.due_eff as Date),
        billAmount: money(r.bill_amount ?? 0),
        adjusted: money(new Prisma.Decimal(r.bill_amount ?? 0).minus(r.pending ?? 0)),
        pending: money(r.pending ?? 0),
        ageDays: Number(r.age_days ?? 0),
        overdueDays: isOwed && Number(r.overdue_days) > 0 ? Number(r.overdue_days) : null,
        remarks: remarks.get(billKey(r.abl_id as string, r.abl_acc_year as string)) ?? null,
        tenderDerived: gap.greaterThan(0),
        partyId: r.party_id as string,
        partyName: r.party_name ?? '',
        area: r.area_name,
      };
      if (gap.isNegative()) {
        row.dataWarning = BILL_DATA_WARNING.ALLOC_BELOW_ROWS;
      }
      return row;
    });
    const faulty = rows.filter((r) => r.dataWarning).map((r) => r.docRefno ?? r.billId);
    if (faulty.length > 0) {
      this.logger.warn(
        `${BILL_DATA_WARNING.ALLOC_BELOW_ROWS}: adjustment rows exceed the cached settlement on ` +
          `${faulty.length} bill(s): ${faulty.slice(0, 10).join(', ')}`,
      );
    }
    const billAmount = new Prisma.Decimal(t.t_bill_amount);
    return {
      rows,
      totals: {
        bills: Number(t.t_bills),
        billAmount: money(billAmount),
        adjusted: money(billAmount.minus(t.t_pending)),
        net: bal(t.t_net, scope.owedSide),
      },
    };
  }

  /**
   * §5.4 remarks, server-built from each bill's rows dated ≤ D:
   *   a BNC/ charge bill          → "bounce charge"
   *   an on-account bill          → "on account"
   *   latest movement a bounce    → "re-opened · chq bounced"
   *   latest surviving row        → "part <voucher>" / "disc <voucher>" / "w/off <voucher>"
   *   only retracted rows         → "re-opened"
   * A surviving row is neither a reversal nor reversed.
   */
  private async remarksOf(scope: Scope, bills: BillDbRow[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const owedKeys: { id: string; yr: string }[] = [];
    for (const b of bills) {
      const k = billKey(b.abl_id as string, b.abl_acc_year as string);
      if (b.abl_src_doc_type === 'CHEQUE_BOUNCE_CHARGE') {
        out.set(k, 'bounce charge');
      } else if (b.is_owed !== true) {
        out.set(k, 'on account');
      } else {
        owedKeys.push({ id: b.abl_id as string, yr: b.abl_acc_year as string });
      }
    }
    if (owedKeys.length === 0) {
      return out;
    }
    const rows = await this.prisma.$queryRaw<AdjRow[]>`
      SELECT a.abj_id, a.abj_bill_id AS bill_id, a.abj_bill_acc_year AS bill_yr,
             a.abj_adj_type AS adj_type, a.abj_adj_date AS adj_date, a.abj_created_on AS created_on,
             a.abj_row_no AS row_no, a.abj_reversal_of_id AS reversal_of,
             a.abj_reversal_reason AS reason, h.avh_voucher_refno AS refno
        FROM accounts.acc_bill_adjustment a
        LEFT JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = a.abj_voucher_id AND h.avh_acc_year = a.abj_voucher_acc_year
       WHERE (a.abj_bill_id, a.abj_bill_acc_year) IN (${Prisma.join(
         owedKeys.map((k) => Prisma.sql`(${k.id}::uuid, ${k.yr}::char(9))`),
       )})
         AND a.abj_is_deleted = false
         AND a.abj_adj_date <= ${scope.asOn}::date
       ORDER BY a.abj_adj_date, a.abj_created_on NULLS FIRST, a.abj_row_no NULLS FIRST, a.abj_id`;
    const byBill = new Map<string, AdjRow[]>();
    for (const r of rows) {
      const k = billKey(r.bill_id, r.bill_yr);
      byBill.set(k, [...(byBill.get(k) ?? []), r]);
    }
    for (const [k, list] of byBill) {
      const latest = list[list.length - 1];
      if (latest.reversal_of && /bounced/i.test(latest.reason ?? '')) {
        out.set(k, 're-opened · chq bounced');
        continue;
      }
      const reversed = new Set(list.map((r) => r.reversal_of).filter((id): id is string => !!id));
      const surviving = list.filter((r) => !r.reversal_of && !reversed.has(r.abj_id));
      const last = surviving[surviving.length - 1];
      if (last) {
        const verb =
          last.adj_type === 'DISCOUNT' || last.adj_type === 'ROUND_OFF'
            ? 'disc'
            : last.adj_type === 'WRITEOFF'
              ? 'w/off'
              : 'part';
        out.set(k, `${verb} ${last.refno ?? ''}`.trim());
      } else if (latest.reversal_of) {
        out.set(k, 're-opened');
      }
    }
    return out;
  }

  private async ledgerClosing(scope: Scope, partyId: string): Promise<Bal> {
    const [row] = await this.prisma.$queryRaw<{ bal: Prisma.Decimal }[]>(
      ledgerClosingSql(scope, partyId),
    );
    // The ledger's own sign: +DR / −CR, whatever the side.
    return bal(row?.bal ?? 0, 'DR');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The card — /party and the PARTY_STATEMENT export
  // ═════════════════════════════════════════════════════════════════════════

  private async card(scope: Scope, partyId: string): Promise<PartyCardPayload> {
    // The card's own figures ignore the party-level filters (resolveScope
    // partyOnly), but keep the bill-level ones the grid row was built with.
    const cardScope: Scope = { ...scope, onlyOverdue: false, minDueDays: null, maxDueDays: null };
    const [facts, agg, onAccount, pdcs, last] = await Promise.all([
      this.partyFacts(scope, partyId),
      this.partyRows(cardScope, 'net', 'desc', 1, 0),
      this.prisma.$queryRaw<
        {
          abl_id: string;
          abl_acc_year: string;
          doc_refno: string | null;
          abl_doc_date: Date;
          abl_bill_type: string;
          pending: Prisma.Decimal;
        }[]
      >`
        ${billsWith(cardScope, false)}
        SELECT abl_id, abl_acc_year, doc_refno, abl_doc_date, abl_bill_type, pending
          FROM o WHERE NOT is_owed
         ORDER BY abl_doc_date, doc_refno, abl_id`,
      this.prisma.$queryRaw<
        {
          apd_id: string;
          apd_acc_year: string;
          apd_instrument_no: string | null;
          apd_bank_name: string | null;
          apd_instrument_date: Date;
          apd_amount: Prisma.Decimal;
          apd_status: string;
        }[]
      >`
        SELECT r.apd_id, r.apd_acc_year, r.apd_instrument_no, r.apd_bank_name,
               r.apd_instrument_date, r.apd_amount, r.apd_status
          FROM accounts.acc_pdc_register r
         WHERE r.apd_company_id = ${scope.companyId}::uuid
           AND r.apd_party_id = ${partyId}::uuid
           AND r.apd_is_deleted = false
           AND r.apd_tra_type = ${scope.traType}
           AND r.apd_status IN ('HELD', 'DEPOSITED')
           AND r.apd_received_on <= ${scope.asOn}::date
           AND (${scope.branchId}::uuid IS NULL OR r.apd_branch_id = ${scope.branchId}::uuid)
         ORDER BY r.apd_instrument_date, r.apd_instrument_no, r.apd_id`,
      this.lastSettlement(scope, partyId),
    ]);
    const a = agg.find((r) => r.party_id !== null);
    const row = a ? this.toPartyRow(scope, a) : null;
    const toPdc = (r: (typeof pdcs)[number]): PdcItem => ({
      pdcId: r.apd_id,
      accYear: r.apd_acc_year.trim(),
      chequeNo: r.apd_instrument_no,
      bank: r.apd_bank_name,
      chequeDate: isoDate(r.apd_instrument_date),
      amount: money(r.apd_amount),
      status: r.apd_status,
    });
    return {
      ...head(scope),
      party: facts,
      ageing: {
        labels: scope.labels,
        amounts: row?.buckets ?? scope.labels.map(() => '0.00'),
      },
      owed: row?.owed ?? '0.00',
      onAccount: row?.onAccount ?? '0.00',
      net: row?.net ?? bal(0, scope.owedSide),
      onAccountItems: onAccount.map((b) => ({
        billId: b.abl_id,
        accYear: b.abl_acc_year.trim(),
        docRefno: b.doc_refno,
        date: isoDate(b.abl_doc_date),
        type: b.abl_bill_type,
        amount: money(b.pending),
      })),
      pdcInHand: pdcs.filter((r) => isoDate(r.apd_instrument_date) > scope.asOn).map(toPdc),
      pdcEffectiveUncleared: pdcs
        .filter((r) => isoDate(r.apd_instrument_date) <= scope.asOn)
        .map(toPdc),
      lastSettlement: last,
    };
  }

  private async partyFacts(scope: Scope, partyId: string): Promise<PartyFacts> {
    const [r] = await this.prisma.$queryRaw<
      {
        led_name: string | null;
        group_name: string | null;
        led_gstin_no: string | null;
        led_phone1: string | null;
        is_cus: boolean;
        is_sup: boolean;
        cus_phone1: string | null;
        cus_phone2: string | null;
        cus_gst_no: string | null;
        cus_credit_days: number | null;
        cus_credit_amt_limit: Prisma.Decimal | null;
        cus_credit_bill_limit: number | null;
        arm_name: string | null;
        sup_phone: string | null;
        sup_gst_no: string | null;
        sup_credit_days: number | null;
      }[]
    >`
      SELECT l.led_name, g.acc_group_name AS group_name, l.led_gstin_no, l.led_phone1,
             (c.cus_id IS NOT NULL AND c.cus_is_deleted = false) AS is_cus,
             (sp.sup_id IS NOT NULL AND sp.sup_is_deleted = false) AS is_sup,
             c.cus_phone1, c.cus_phone2, c.cus_gst_no, c.cus_credit_days, c.cus_credit_amt_limit,
             c.cus_credit_bill_limit, am.arm_name, sp.sup_phone, sp.sup_gst_no, sp.sup_credit_days
        FROM accounts.acc_ledger_master l
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
        LEFT JOIN sales.customers c ON c.cus_id = l.led_id
        LEFT JOIN purchase.suppliers sp ON sp.sup_id = l.led_id
        LEFT JOIN sales.area_master am ON am.arm_id = c.cus_area_id
       WHERE l.led_id = ${partyId}::uuid`;
    const receivable = scope.side === 'RECEIVABLE';
    const pick = (...v: (string | null | undefined)[]): string | null =>
      v.map((s) => s?.trim()).find((s) => !!s) ?? null;
    const limit = r?.cus_credit_amt_limit ? new Prisma.Decimal(r.cus_credit_amt_limit) : null;
    return {
      partyId,
      name: r?.led_name ?? '',
      ledgerGroup: r?.group_name ?? null,
      area: receivable ? (r?.arm_name ?? null) : null,
      phone: receivable
        ? pick(r?.cus_phone1, r?.cus_phone2, r?.led_phone1)
        : pick(r?.sup_phone, r?.led_phone1),
      gstin: receivable
        ? pick(r?.cus_gst_no, r?.led_gstin_no)
        : pick(r?.sup_gst_no, r?.led_gstin_no),
      creditDays: receivable ? (r?.cus_credit_days ?? null) : (r?.sup_credit_days ?? null),
      creditLimit: receivable && limit && limit.greaterThan(0) ? money(limit) : null,
      creditBillLimit:
        receivable && r?.cus_credit_bill_limit ? Number(r.cus_credit_bill_limit) : null,
      isDualRole: !!r?.is_cus && !!r?.is_sup,
    };
  }

  /**
   * The latest ALLOCATION on an owed bill of the party dated ≤ D that is
   * neither a reversal nor reversed, grouped by its voucher: "Last receipt"
   * (Receivable) / "Last payment" (Payable). A counter tender has no row
   * (§3.1), so it is never the last settlement.
   */
  private async lastSettlement(
    scope: Scope,
    partyId: string,
  ): Promise<PartyCardPayload['lastSettlement']> {
    const [r] = await this.prisma.$queryRaw<
      {
        vid: string;
        vyr: string;
        d: Date;
        amt: Prisma.Decimal;
        refno: string | null;
        vtype: string | null;
      }[]
    >`
      WITH s AS (
        SELECT a.abj_voucher_id AS vid, a.abj_voucher_acc_year AS vyr, a.abj_adj_date AS d,
               a.abj_amount AS amt, a.abj_created_on AS created_on
          FROM accounts.acc_bill_adjustment a
          JOIN accounts.acc_bill_balance b
            ON b.abl_id = a.abj_bill_id AND b.abl_acc_year = a.abj_bill_acc_year
         WHERE b.abl_company_id = ${scope.companyId}::uuid
           AND b.abl_party_id = ${partyId}::uuid
           AND b.abl_is_deleted = false
           AND btrim(b.abl_dr_cr) = ${scope.owedSide}
           AND (${scope.branchId}::uuid IS NULL OR b.abl_branch_id = ${scope.branchId}::uuid)
           AND a.abj_is_deleted = false
           AND a.abj_adj_type = 'ALLOCATION'
           AND a.abj_reversal_of_id IS NULL
           AND a.abj_voucher_id IS NOT NULL
           AND a.abj_adj_date <= ${scope.asOn}::date
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment rv
                            WHERE rv.abj_reversal_of_id = a.abj_id AND rv.abj_is_deleted = false)),
      last AS (SELECT vid, vyr FROM s ORDER BY d DESC, created_on DESC NULLS LAST LIMIT 1)
      SELECT s.vid, s.vyr, MAX(s.d) AS d, SUM(s.amt) AS amt,
             h.avh_voucher_refno AS refno, t.vchr_type_name AS vtype
        FROM s
        JOIN last ON last.vid = s.vid AND last.vyr = s.vyr
        LEFT JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = s.vid AND h.avh_acc_year = s.vyr
        LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       GROUP BY s.vid, s.vyr, h.avh_voucher_refno, t.vchr_type_name`;
    if (!r) {
      return null;
    }
    return {
      date: isoDate(r.d),
      voucherId: r.vid,
      voucherAccYear: r.vyr.trim(),
      voucherNo: r.refno,
      voucherType: r.vtype,
      amount: money(r.amt),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  printedAs — the applied filters as one sentence (loyalty-status pattern)
  // ═════════════════════════════════════════════════════════════════════════

  private async printNames(
    scope: Scope,
    q: OutstandingExportDto,
  ): Promise<
    Record<'company' | 'branch' | 'group' | 'area' | 'salesman' | 'party', string | null>
  > {
    const [r] = await this.prisma.$queryRaw<
      {
        company: string | null;
        branch: string | null;
        grp: string | null;
        area: string | null;
        salesman: string | null;
        party: string | null;
      }[]
    >`
      SELECT (SELECT comp_name FROM public.companys WHERE comp_id = ${scope.companyId}::uuid) AS company,
             (SELECT br_name FROM public.branch_master WHERE br_id = ${scope.branchId}::uuid) AS branch,
             (SELECT acc_group_name FROM accounts.acc_group_master
               WHERE acc_group_id = ${scope.group?.groupId ?? null}::uuid) AS grp,
             (SELECT arm_name FROM sales.area_master WHERE arm_id = ${q.areaId ?? null}::uuid) AS area,
             (SELECT emp_name FROM public.employee_master WHERE emp_id = ${q.salesmanId ?? null}::uuid) AS salesman,
             (SELECT led_name FROM accounts.acc_ledger_master WHERE led_id = ${q.partyId ?? null}::uuid) AS party`;
    return {
      company: r?.company ?? null,
      branch: r?.branch ?? null,
      group: r?.grp ?? null,
      area: r?.area ?? null,
      salesman: r?.salesman ?? null,
      party: r?.party ?? null,
    };
  }

  private printedAs(
    scope: Scope,
    q: OutstandingExportDto,
    names: Record<'company' | 'branch' | 'group' | 'area' | 'salesman' | 'party', string | null>,
  ): string {
    const dmy = (iso: string): string =>
      `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
    const parts: (string | null)[] = [
      `${scope.side === 'RECEIVABLE' ? 'Receivable' : 'Payable'} outstanding as on ${dmy(scope.asOn)}` +
        ' (as the books stand today)',
      `Branch: ${names.branch ?? 'All branches'}`,
      scope.group && names.group ? `Group: ${names.group} (+ sub-groups)` : null,
      q.partyId ? `Party: ${names.party ?? q.partyId}` : null,
      scope.areaId ? `Area: ${names.area ?? scope.areaId}` : null,
      scope.salesmanId ? `Salesman: ${names.salesman ?? scope.salesmanId}` : null,
      q.collectionDay ? `Collection: ${q.collectionDay}` : null,
      `Aged by ${scope.ageBy === 'DUE_DATE' ? 'due date' : 'bill date'}`,
      `Buckets ${scope.edges.join(', ')}`,
      scope.onlyOverdue ? 'Only overdue' : null,
      scope.minDueDays !== null ? `Due days ≥ ${scope.minDueDays}` : null,
      scope.maxDueDays !== null ? `Due days ≤ ${scope.maxDueDays}` : null,
      scope.includeOnAccount ? null : 'On-account excluded',
      scope.deductPdc ? 'PDC in hand deducted' : null,
      scope.hideZero || q.shape === 'PARTY_STATEMENT' ? null : 'Zero balances shown',
    ];
    return parts.filter(Boolean).join(' · ');
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function refuse(code: string, field: string, message: string): never {
  throwUnprocessable('Party-wise outstanding request refused', [{ field, message, code }]);
}

function head(scope: Scope): ReportHead {
  return {
    asOn: scope.asOn,
    side: scope.side,
    isFuture: scope.isFuture,
    accYear: scope.fyName,
    bucketLabels: scope.labels,
  };
}

function money(value: Num): string {
  return new Prisma.Decimal(value).toFixed(2);
}

/**
 * A signed figure (+ toward `positiveSide`) as `{amount, side}`: never a minus
 * sign on the wire, and side null on 0.00.
 */
function bal(value: Num, positiveSide: Side): Bal {
  const d = new Prisma.Decimal(value).toDecimalPlaces(2);
  if (d.isZero()) {
    return { amount: '0.00', side: null };
  }
  const other: Side = positiveSide === 'DR' ? 'CR' : 'DR';
  return { amount: d.abs().toFixed(2), side: d.isNegative() ? other : positiveSide };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function billKey(id: string, yr: string): string {
  return `${id}|${yr.trim()}`;
}

/** Whitelisted ORDER BY over `pf` — ties break on name, then party id, so paging is stable. */
function partyOrder(sort: PartySort, dir: SortDir): Prisma.Sql {
  const bucket = /^bucket(\d)$/.exec(sort);
  const col = bucket
    ? `pf.b${bucket[1]}`
    : {
        net: 'pf.net',
        name: 'lower(pf.name)',
        overdue: 'pf.overdue',
        oldest: 'pf.oldest',
        owed: 'pf.owed',
      }[sort as 'net' | 'name' | 'overdue' | 'oldest' | 'owed'];
  return Prisma.raw(
    `${col} ${dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, lower(pf.name) ASC, pf.party_id ASC`,
  );
}

/** Whitelisted ORDER BY over `o x` ⋈ `pty pt` — ties break on date, bill no, bill id. */
function billOrder(sort: BillSort, dir: SortDir): Prisma.Sql {
  const col = {
    date: 'x.abl_doc_date',
    party: 'lower(pt.name)',
    due: 'x.due_eff',
    refno: 'x.doc_refno',
    pending: 'x.pending',
    age: 'x.age_days',
    overdue: 'x.overdue_days',
  }[sort];
  return Prisma.raw(
    `${col} ${dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, x.abl_doc_date ASC, x.doc_refno ASC, x.abl_id ASC`,
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
