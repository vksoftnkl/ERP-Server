import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  throwAccountsBadRequest,
  throwAccountsForbidden,
  throwUnprocessable,
} from 'src/common/utils/module-service.utils';
import {
  countedLegsSql,
  createdByJoinSql,
  isoDate,
  money,
  openingNoteSql,
  openingSetSql,
  sided,
} from '../common/voucher-books.sql';
import {
  buildGroupTree,
  groupsRollingInto,
  rollupGroupId,
  treeSortKey,
  type GroupNode,
  type GroupTree,
} from './day-summary.groups';
import { coreCtes, draftsSql, leglessSql, numberGapsSql, type DsSqlScope } from './day-summary.sql';
import type {
  DaySummaryCheckDetailDto,
  DaySummaryExportDto,
  DaySummaryGroupLedgersDto,
  DaySummaryScopeDto,
  DaySummaryVouchersDto,
} from './dto/day-summary-query.dto';
import {
  CHECK_CODES,
  DAY_SUMMARY_ERROR,
  type BusinessDay,
  type BusinessDayStatus,
  type Check,
  type CheckCode,
  type CheckDetailPayload,
  type DailyPayload,
  type DailyRow,
  type DayVoucherLeg,
  type DayVoucherRow,
  type DraftRow,
  type ExportPayload,
  type GroupLedgersPayload,
  type GroupLevel,
  type GroupRow,
  type MoneyKind,
  type MoneyLedgerRow,
  type MoneyTotal,
  type RowKind,
  type SummaryPayload,
  type Tile,
  type TypeRow,
  type VoucherNature,
  type VouchersPayload,
  type VoucherTypesPayload,
} from './types/day-summary.types';

/**
 * Account Day Summary — the day book (plan 2026-10-12). A read-only report over
 * the `acc_vouchers` legs of ONE company, one branch or all, one day or a range
 * inside one fiscal year: by voucher type, by money ledger and by ledger group.
 * It writes nothing.
 *
 * Every figure is read from `coreCtes` (day-summary.sql.ts) over the shared
 * balance definition (../common/voucher-books.sql.ts — the Ledger Statement
 * reads the same fragments, plan D1). No route of another module is called
 * (§2), and no DB function (notes 42).
 *
 * Each route runs in ONE read-only REPEATABLE READ transaction, so the tiles,
 * grids and checks of a response are the same moment's numbers (§5.2).
 */

const DAY_SUMMARY_MENU_ID = 284; // "Account Day Summary" under 137 (§10)
const DAY_BOOK_DETAIL_MENU_ID = 181; // "Day Book Detail" opens the same screen (D8)
const EXPORT_ROW_CAP = 20_000;
const DEFAULT_PAGE_SIZE = 200;
const DETAIL_CAP = 500;
const FACT_LIST_CAP = 20;
const GAP_LIST_CAP = 50;
const ZERO = new Prisma.Decimal(0);
const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 10_000,
  timeout: 120_000,
} as const;

type Db = Prisma.TransactionClient;
type Dec = Prisma.Decimal;

interface Scope extends DsSqlScope {
  companyName: string | null;
  branchName: string;
  fyBegin: string;
  fyEnd: string;
  clearingAsBank: boolean;
  groupLevel: GroupLevel;
  zeroRows: boolean;
  days: number;
  /** IST calendar date of the snapshot. */
  today: string;
  /** IST timestamp of the snapshot, with offset. */
  asOf: string;
}

interface TypeInfo {
  id: number;
  code: string;
  short: string | null;
  name: string;
  nature: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
  affectsAccounts: boolean;
}

interface MoneyLedger {
  id: string;
  name: string;
  kind: MoneyKind;
  isDeleted: boolean;
}

/** What the masters say, read once per request inside the snapshot. */
interface Books {
  tree: GroupTree;
  types: Map<number, TypeInfo>;
  money: MoneyLedger[];
  cashIds: string[];
  /** BANK, plus CLEARING when clearingAsBank — the type grid's / Day-wise bank columns. */
  bankishIds: string[];
  clearingIds: string[];
}

interface TypeAgg {
  vouchers: number;
  lone: number;
  amt: Dec;
  cashIn: Dec;
  cashOut: Dec;
  bankIn: Dec;
  bankOut: Dec;
}

interface MoneyFigures {
  ledger: MoneyLedger;
  /** null under a voucherTypeId filter. */
  opening: Dec | null;
  in: Dec;
  out: Dec;
  /** Σ signed of EVERY counted leg in range, pairs included (the AMOUNT_TIES cross-check). */
  rawNet: Dec;
  movedInRange: boolean;
  openingNote: string | null;
}

interface LegRow {
  vid: string;
  vyr: string;
  row_no: number;
  dr_cr: string;
  ledger_id: string;
  ledger_name: string | null;
  amount: Dec;
  role: string | null;
  opp_ledger_id: string | null;
  opp_ledger_name: string | null;
}

interface VoucherCoreRow {
  vid: string;
  vyr: string;
  vt: number;
  st: string;
  vdate: Date;
  kind: RowKind;
  pair_in: boolean;
  amt: Dec;
  legs: bigint;
  refno: string | null;
  br: string;
  br_name: string | null;
  party_id: string | null;
  party_name: string | null;
  remarks: string | null;
  created_by: string | null;
  created_by_name: string | null;
  src_module: string | null;
  src_doc_type: string | null;
  src_doc_id: string | null;
}

interface VoucherFilter {
  includeCancelledPairs: boolean;
  nature: VoucherNature | null;
  moneyKind: MoneyKind | null;
}

interface BusinessDayRow {
  br: string;
  d: Date;
  st: string;
  z: number | null;
  total: bigint;
  closed: bigint;
}

@Injectable()
export class DaySummaryService {
  private readonly logger = new Logger(DaySummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.1 — the Type combo
  // ═════════════════════════════════════════════════════════════════════════

  async voucherTypes(): Promise<VoucherTypesPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const types = await this.loadTypes(db);
      // D4 — types that can never post a leg (Quo, SOr: vchr_affects_accounts
      // = false) are left out; the INVENTORY types that do post (OPENING, Phy,
      // StkAdj) stay.
      return {
        items: [...types.values()]
          .filter((t) => t.isActive && t.affectsAccounts)
          .map((t) => ({
            voucherTypeId: t.id,
            code: t.code,
            short: t.short,
            name: t.name,
            nature: t.nature,
            category: t.category,
            sortOrder: t.sortOrder,
          })),
      };
    }, true);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.2 — the Summary tab, one snapshot
  // ═════════════════════════════════════════════════════════════════════════

  async summary(q: DaySummaryScopeDto): Promise<SummaryPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const scope = await this.resolveScope(db, q);
      const books = await this.loadBooks(db, scope);
      return this.buildSummary(db, scope, books);
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.3 — the Vouchers tab (day book detail)
  // ═════════════════════════════════════════════════════════════════════════

  async vouchers(q: DaySummaryVouchersDto): Promise<VouchersPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const scope = await this.resolveScope(db, q);
      const books = await this.loadBooks(db, scope);
      return this.buildVouchers(db, scope, books, q);
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.4 — the Day-wise tab
  // ═════════════════════════════════════════════════════════════════════════

  async daily(q: DaySummaryScopeDto): Promise<DailyPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const scope = await this.resolveScope(db, q);
      const books = await this.loadBooks(db, scope);
      return this.buildDaily(db, scope, books);
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.5 — Enter on a group row
  // ═════════════════════════════════════════════════════════════════════════

  async groupLedgers(q: DaySummaryGroupLedgersDto): Promise<GroupLedgersPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const scope = await this.resolveScope(db, q);
      const books = await this.loadBooks(db, scope);
      const node = books.tree.nodes.get(q.groupId);
      const visible = await db.$queryRaw<{ ok: boolean }[]>`
        SELECT true AS ok FROM accounts.acc_group_master
         WHERE acc_group_id = ${q.groupId}::uuid AND acc_group_is_deleted = false
           AND (acc_group_company_id IS NULL OR acc_group_company_id = ${scope.companyId}::uuid)`;
      if (!node || visible.length === 0) {
        refuse(
          DAY_SUMMARY_ERROR.GROUP_UNKNOWN,
          'groupId',
          'No live account group with this id is visible to the company.',
        );
      }
      const groupIds = groupsRollingInto(books.tree, q.groupId, scope.groupLevel);
      const rows = await db.$queryRaw<
        {
          ledger_id: string;
          ledger_name: string;
          group_id: string;
          group_name: string | null;
          dr: Dec;
          cr: Dec;
        }[]
      >`
        WITH ${coreCtes(scope, 'RANGE')}
        SELECT l.led_id AS ledger_id, l.led_name AS ledger_name, l.led_group_id AS group_id,
               g.acc_group_name AS group_name,
               COALESCE(SUM(cl.amount) FILTER (WHERE cl.dr_cr = 'DR'), 0) AS dr,
               COALESCE(SUM(cl.amount) FILTER (WHERE cl.dr_cr = 'CR'), 0) AS cr
          FROM cl
          JOIN accounts.acc_ledger_master l ON l.led_id = cl.ledger_id
          LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
         WHERE l.led_group_id = ANY(${groupIds}::uuid[])
         GROUP BY l.led_id, l.led_name, l.led_group_id, g.acc_group_name
         ORDER BY l.led_name, l.led_id`;
      let totalDr = ZERO;
      let totalCr = ZERO;
      const ledgers = rows.map((r) => {
        totalDr = totalDr.plus(r.dr);
        totalCr = totalCr.plus(r.cr);
        return {
          ledgerId: r.ledger_id,
          ledgerName: r.ledger_name,
          groupId: r.group_id,
          groupName: r.group_name,
          debit: money(r.dr),
          credit: money(r.cr),
          net: sided(dec(r.dr).minus(r.cr)),
        };
      });
      return {
        groupId: q.groupId,
        groupName: node.name,
        groupLevel: scope.groupLevel,
        ledgers,
        totals: { debit: money(totalDr), credit: money(totalCr) },
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.6 — the rows behind one check
  // ═════════════════════════════════════════════════════════════════════════

  async checkDetail(q: DaySummaryCheckDetailDto): Promise<CheckDetailPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const code = q.code;
      if (!(CHECK_CODES as readonly string[]).includes(code)) {
        refuse(
          DAY_SUMMARY_ERROR.CHECK_UNKNOWN,
          'code',
          `Unknown check ${String(q.code)}. One of ${CHECK_CODES.join(', ')}.`,
        );
      }
      const scope = await this.resolveScope(db, q);
      const books = await this.loadBooks(db, scope);
      const rows = await this.checkRows(db, scope, books, code);
      return {
        code,
        rows: rows.slice(0, DETAIL_CAP),
        truncated: rows.length > DETAIL_CAP,
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.7 — everything, for the client to print / file
  // ═════════════════════════════════════════════════════════════════════════

  async export(q: DaySummaryExportDto): Promise<ExportPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const scope = await this.resolveScope(db, q);
      const books = await this.loadBooks(db, scope);
      const filter = voucherFilterOf(q);
      const [count] = await db.$queryRaw<{ n: bigint }[]>`
        WITH ${this.voucherCtes(scope, books, filter)}
        SELECT COUNT(*) AS n FROM f`;
      const n = Number(count.n);
      if (n > EXPORT_ROW_CAP) {
        throwUnprocessable('Range too large', [
          {
            field: 'fromDate',
            code: DAY_SUMMARY_ERROR.RANGE_TOO_LARGE,
            count: n,
            message: `${n} vouchers in this range — the export stops at ${EXPORT_ROW_CAP}. Narrow the dates.`,
          },
        ]);
      }
      const summary = await this.buildSummary(db, scope, books);
      const core = await this.voucherCoreRows(db, scope, books, filter, {
        limit: EXPORT_ROW_CAP,
        offset: 0,
      });
      const vouchers = await this.decorate(db, core, books, q.withLegs ?? true);
      return { summary, vouchers, totalRows: n };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The snapshot, the guards (§9, §10) and the masters
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * One read-only REPEATABLE READ transaction: every query of the response sees
   * one moment. Custom plans only (SET LOCAL, this transaction): Prisma prepares
   * every statement, and after five runs Postgres may switch to a generic plan
   * that cannot see through the `$branch IS NULL OR …` / `= ANY($ids)`
   * predicates — measured at ~3 s instead of ~20 ms for the money figures.
   */
  private snapshot<T>(work: (db: Db) => Promise<T>, light = false): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
        return work(tx);
      },
      light ? { ...TX_OPTIONS, timeout: 15_000 } : TX_OPTIONS,
    );
  }

  /**
   * 403 unless the caller may view 284 "Account Day Summary" — or 181 "Day Book
   * Detail", which opens the same screen on the Vouchers tab (D8). On every
   * route.
   */
  private async assertMenuRight(db: Db): Promise<void> {
    const userId = this.requestContext.getUserId();
    const rows = isUuid(userId)
      ? await db.$queryRaw<{ ok: boolean }[]>`
          SELECT true AS ok FROM public.user_menus
           WHERE um_user_id = ${userId}::uuid
             AND um_menu_id IN (${DAY_SUMMARY_MENU_ID}::int, ${DAY_BOOK_DETAIL_MENU_ID}::int)
             AND um_can_view = true AND um_is_deleted = false
           LIMIT 1`
      : [];
    if (rows.length === 0) {
      throwAccountsForbidden('No access to the Account Day Summary', [
        {
          field: 'menu',
          code: DAY_SUMMARY_ERROR.NO_MENU_RIGHT,
          message: `This user may not view menu ${DAY_SUMMARY_MENU_ID} (Account Day Summary) or ${DAY_BOOK_DETAIL_MENU_ID} (Day Book Detail).`,
        },
      ]);
    }
  }

  /** YEAR_UNKNOWN, BRANCH_NOT_IN_COMPANY, RANGE_REVERSED, RANGE_OUTSIDE_YEAR, TYPE_UNKNOWN — in that order. */
  private async resolveScope(db: Db, q: DaySummaryScopeDto): Promise<Scope> {
    const [fy] = await db.$queryRaw<
      {
        fy_begin_date: Date;
        fy_end_date: Date;
        fy_books_begin_date: Date | null;
        comp_name: string | null;
        today: string;
        as_of: string;
      }[]
    >`
      SELECT f.fy_begin_date, f.fy_end_date, f.fy_books_begin_date, c.comp_name,
             to_char((now() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS today,
             to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS as_of
        FROM public.fiscal_years f
        LEFT JOIN public.companys c ON c.comp_id = f.comp_id
       WHERE f.comp_id = ${q.companyId}::uuid AND f.fy_year_name = ${q.accYear}::char(9)
         AND f.is_deleted = false
       LIMIT 1`;
    if (!fy) {
      refuse(
        DAY_SUMMARY_ERROR.YEAR_UNKNOWN,
        'accYear',
        `No fiscal year ${q.accYear} for this company.`,
      );
    }
    let branchName = 'All branches';
    if (q.branchId) {
      const [br] = await db.$queryRaw<{ br_comp_id: string | null; br_name: string }[]>`
        SELECT br_comp_id, br_name FROM public.branch_master WHERE br_id = ${q.branchId}::uuid`;
      if (!br || br.br_comp_id !== q.companyId) {
        refuse(
          DAY_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY,
          'branchId',
          'This branch does not belong to the company.',
        );
      }
      branchName = br.br_name;
    }
    const from = q.fromDate;
    const to = q.toDate ?? q.fromDate;
    if (from > to) {
      refuse(DAY_SUMMARY_ERROR.RANGE_REVERSED, 'fromDate', `${from} is after ${to}.`);
    }
    const fyBegin = isoDate(fy.fy_begin_date);
    const fyEnd = isoDate(fy.fy_end_date);
    const books = fy.fy_books_begin_date ? isoDate(fy.fy_books_begin_date) : fyBegin;
    const begin = books > fyBegin ? books : fyBegin;
    if (from < begin || to > fyEnd) {
      refuse(
        DAY_SUMMARY_ERROR.RANGE_OUTSIDE_YEAR,
        from < begin ? 'fromDate' : 'toDate',
        `${q.accYear} runs ${begin} to ${fyEnd}; ${from} – ${to} is outside it.`,
      );
    }
    if (q.voucherTypeId !== undefined) {
      const [t] = await db.$queryRaw<{ ok: boolean }[]>`
        SELECT true AS ok FROM accounts.acc_voucher_types WHERE vchr_type_id = ${q.voucherTypeId}::int`;
      if (!t) {
        refuse(
          DAY_SUMMARY_ERROR.TYPE_UNKNOWN,
          'voucherTypeId',
          `No voucher type ${q.voucherTypeId}.`,
        );
      }
    }
    return {
      companyId: q.companyId,
      accYear: q.accYear,
      branchId: q.branchId ?? null,
      from,
      to,
      voucherTypeId: q.voucherTypeId ?? null,
      companyName: fy.comp_name,
      branchName,
      fyBegin,
      fyEnd,
      clearingAsBank: q.clearingAsBank ?? true,
      groupLevel: q.groupLevel ?? 'REPORT',
      zeroRows: q.zeroRows ?? false,
      days: datesBetween(from, to).length,
      today: fy.today,
      asOf: fy.as_of,
    };
  }

  private async loadTypes(db: Db): Promise<Map<number, TypeInfo>> {
    const rows = await db.$queryRaw<
      {
        id: number;
        code: string;
        short: string | null;
        name: string;
        nature: string;
        category: string;
        sort_order: number;
        is_active: boolean;
        affects_accounts: boolean;
      }[]
    >`
      SELECT vchr_type_id AS id, vchr_type_code AS code, vchr_type_short AS short,
             vchr_type_name AS name, vchr_nature::text AS nature, vchr_category::text AS category,
             vchr_sort_order AS sort_order, vchr_is_active AS is_active,
             vchr_affects_accounts AS affects_accounts
        FROM accounts.acc_voucher_types
       ORDER BY vchr_sort_order, vchr_type_id`;
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          code: r.code,
          short: r.short,
          name: r.name,
          nature: r.nature,
          category: r.category,
          sortOrder: r.sort_order,
          isActive: r.is_active,
          affectsAccounts: r.affects_accounts,
        },
      ]),
    );
  }

  /**
   * §4.2 / §4.3 — the group tree, the voucher types and the money ledgers of the
   * company. CLEARING = the ledger of one of the company's live tenders that
   * names a settlement ledger, unless the group chain already says CASH / BANK.
   */
  private async loadBooks(db: Db, scope: Scope): Promise<Books> {
    const groups = await db.$queryRaw<
      {
        id: string;
        name: string;
        parent_id: string | null;
        nature: string | null;
        profile: string | null;
        sort: number | null;
        is_deleted: boolean;
      }[]
    >`
      SELECT acc_group_id AS id, acc_group_name AS name, acc_group_parent_id AS parent_id,
             acc_group_nature AS nature, acc_ledger_profile AS profile, acc_group_sort AS sort,
             acc_group_is_deleted AS is_deleted
        FROM accounts.acc_group_master`;
    const tree = buildGroupTree(
      groups.map(
        (g): GroupNode => ({
          id: g.id,
          name: g.name,
          parentId: g.parent_id,
          nature: g.nature?.trim() || null,
          profile: g.profile,
          sort: g.sort,
          isDeleted: g.is_deleted,
        }),
      ),
    );
    const cashBankGroups = [...tree.classes.entries()]
      .filter(([, c]) => c.moneyKind !== null)
      .map(([id]) => id);
    const types = await this.loadTypes(db);
    const ledgers = await db.$queryRaw<
      { id: string; name: string; group_id: string; is_deleted: boolean; clearing: boolean }[]
    >`
        SELECT l.led_id AS id, l.led_name AS name, l.led_group_id AS group_id,
               l.led_is_deleted AS is_deleted,
               EXISTS (SELECT 1 FROM accounts.acc_tender_master t
                        WHERE t.tnd_ledger_id = l.led_id
                          AND t.tnd_company_id = ${scope.companyId}::uuid
                          AND t.tnd_is_deleted = false
                          AND t.tnd_settlement_ledger_id IS NOT NULL) AS clearing
          FROM accounts.acc_ledger_master l
         WHERE (l.led_company_id IS NULL OR l.led_company_id = ${scope.companyId}::uuid)
           AND (l.led_group_id = ANY(${cashBankGroups}::uuid[])
                OR EXISTS (SELECT 1 FROM accounts.acc_tender_master t
                            WHERE t.tnd_ledger_id = l.led_id
                              AND t.tnd_company_id = ${scope.companyId}::uuid
                              AND t.tnd_is_deleted = false
                              AND t.tnd_settlement_ledger_id IS NOT NULL))`;
    const money: MoneyLedger[] = [];
    for (const l of ledgers) {
      const kind: MoneyKind | null =
        tree.classes.get(l.group_id)?.moneyKind ?? (l.clearing ? 'CLEARING' : null);
      if (kind) {
        money.push({ id: l.id, name: l.name, kind, isDeleted: l.is_deleted });
      }
    }
    const idsOf = (kind: MoneyKind) => money.filter((m) => m.kind === kind).map((m) => m.id);
    const clearingIds = idsOf('CLEARING');
    return {
      tree,
      types,
      money,
      cashIds: idsOf('CASH'),
      bankishIds: [...idsOf('BANK'), ...(scope.clearingAsBank ? clearingIds : [])],
      clearingIds,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.2 — assembling the summary
  // ═════════════════════════════════════════════════════════════════════════

  private async buildSummary(db: Db, scope: Scope, books: Books): Promise<SummaryPayload> {
    const s = scope;
    const typeAgg = await this.typeAggregates(db, s, books);
    const pairs = await this.pairCounts(db, s);
    const drafts = await this.draftCounts(db, s);
    const balance = await this.balanceFacts(db, s);
    const groupAgg = await this.groupAggregates(db, s);
    const moneyFigs = await this.moneyFigures(db, s, books);
    const legless = await db.$queryRaw<{ vid: string }[]>`
      SELECT x.vid FROM (${leglessSql(s)}) x ORDER BY x.vdate, x.vid`;
    const future = s.to >= s.today ? await this.futureDated(db, s) : null;
    const gaps = await this.numberGaps(db, s);
    const businessDay =
      s.from === s.to ? foldBusinessDay(await this.businessDayRows(db, s, s.from, s.from)) : null;

    // ── types ──
    const typeIds = new Set<number>([...typeAgg.keys(), ...pairs.keys(), ...drafts.keys()]);
    if (s.zeroRows) {
      for (const t of books.types.values()) {
        if (
          t.isActive &&
          t.affectsAccounts &&
          (s.voucherTypeId === null || t.id === s.voucherTypeId)
        ) {
          typeIds.add(t.id);
        }
      }
    }
    const types: TypeRow[] = [...typeIds]
      .map((id) => books.types.get(id) ?? unknownType(id))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((t) => {
        const a = typeAgg.get(t.id);
        return {
          voucherTypeId: t.id,
          code: t.code,
          short: t.short,
          name: t.name,
          nature: t.nature,
          category: t.category,
          vouchers: a?.vouchers ?? 0,
          drafts: drafts.get(t.id)?.n ?? 0,
          cancelledPairs: pairs.get(t.id) ?? 0,
          loneHalves: a?.lone ?? 0,
          amount: money(a?.amt),
          cashIn: money(a?.cashIn),
          cashOut: money(a?.cashOut),
          bankIn: money(a?.bankIn),
          bankOut: money(a?.bankOut),
        };
      });
    const sumOf = (pick: (a: TypeAgg) => Dec) =>
      [...typeAgg.values()].reduce((acc, a) => acc.plus(pick(a)), ZERO);
    const typeAmount = sumOf((a) => a.amt);
    const draftCount = [...drafts.values()].reduce((n, d) => n + d.n, 0);
    const draftAmount = [...drafts.values()].reduce((acc, d) => acc.plus(d.amount), ZERO);
    const pairCount = [...pairs.values()].reduce((n, p) => n + p, 0);
    const loneCount = [...typeAgg.values()].reduce((n, a) => n + a.lone, 0);
    const typeTotals = {
      vouchers: [...typeAgg.values()].reduce((n, a) => n + a.vouchers, 0),
      drafts: draftCount,
      cancelledPairs: pairCount,
      loneHalves: loneCount,
      amount: money(typeAmount),
      cashIn: money(sumOf((a) => a.cashIn)),
      cashOut: money(sumOf((a) => a.cashOut)),
      bankIn: money(sumOf((a) => a.bankIn)),
      bankOut: money(sumOf((a) => a.bankOut)),
    };

    // ── money ──
    const typeFiltered = s.voucherTypeId !== null;
    const moneyRows: MoneyLedgerRow[] = moneyFigs
      .filter(
        (m) =>
          m.movedInRange ||
          (m.opening !== null && !m.opening.isZero()) ||
          (s.zeroRows && !m.ledger.isDeleted),
      )
      .map((m) => ({
        ledgerId: m.ledger.id,
        ledgerName: m.ledger.name,
        kind: m.ledger.kind,
        opening: m.opening === null ? null : sided(m.opening),
        in: money(m.in),
        out: money(m.out),
        closing: m.opening === null ? null : sided(m.opening.plus(m.in).minus(m.out)),
        openingNote: m.openingNote,
      }));
    const moneyTotal = (pick: (m: MoneyFigures) => boolean): MoneyTotal => {
      const set = moneyFigs.filter(pick);
      const opening = typeFiltered
        ? null
        : set.reduce((acc, m) => acc.plus(m.opening ?? ZERO), ZERO);
      const tin = set.reduce((acc, m) => acc.plus(m.in), ZERO);
      const tout = set.reduce((acc, m) => acc.plus(m.out), ZERO);
      return {
        opening: opening === null ? null : sided(opening),
        in: money(tin),
        out: money(tout),
        closing: opening === null ? null : sided(opening.plus(tin).minus(tout)),
      };
    };
    const moneyTotals = {
      CASH: moneyTotal((m) => m.ledger.kind === 'CASH'),
      BANK: moneyTotal((m) => m.ledger.kind === 'BANK'),
      CLEARING: moneyTotal((m) => m.ledger.kind === 'CLEARING'),
      ALL: moneyTotal(() => true),
    };

    // ── groups ──
    const rolled = new Map<string, { dr: Dec; cr: Dec }>();
    let groupDr = ZERO;
    let groupCr = ZERO;
    for (const g of groupAgg) {
      const id = g.gid === null ? null : rollupGroupId(books.tree, g.gid, s.groupLevel);
      const key = id ?? '';
      const cur = rolled.get(key) ?? { dr: ZERO, cr: ZERO };
      rolled.set(key, { dr: cur.dr.plus(g.dr), cr: cur.cr.plus(g.cr) });
      groupDr = groupDr.plus(g.dr);
      groupCr = groupCr.plus(g.cr);
    }
    const groups: GroupRow[] = [...rolled.entries()]
      .map(([id, v]) => {
        const node = books.tree.nodes.get(id);
        return {
          row: {
            groupId: id,
            groupName: node?.name ?? '(no group)',
            nature: node?.nature ?? null,
            debit: money(v.dr),
            credit: money(v.cr),
            net: sided(v.dr.minus(v.cr)),
            hasChildren: books.tree.withChildren.has(id),
          },
          key: treeSortKey(books.tree, id),
        };
      })
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((x) => x.row);

    // ── tiles (§6.4) ──
    const tileOf = (code: Tile['code'], pick: (t: TypeRow) => boolean): Tile => {
      const set = types.filter(pick);
      return {
        code,
        amount: money(set.reduce((acc, t) => acc.plus(t.amount), ZERO)),
        vouchers: set.reduce((n, t) => n + t.vouchers, 0),
        drafts: set.reduce((n, t) => n + t.drafts, 0),
        cancelledPairs: set.reduce((n, t) => n + t.cancelledPairs, 0),
      };
    };
    const cashTotal = moneyTotals.CASH;
    const tiles: Tile[] = [
      tileOf('SALES', (t) => t.nature === 'SALES'),
      tileOf('SALE_RETURNS', (t) => t.nature === 'CREDIT_NOTE'),
      tileOf('RECEIPTS', (t) => t.nature === 'RECEIPT'),
      tileOf('PAYMENTS', (t) => t.nature === 'PAYMENT' && t.code !== 'ExpV'),
      tileOf('EXPENSES', (t) => t.code === 'ExpV'),
      {
        code: 'CASH_IN_HAND',
        opening: cashTotal.opening,
        closing: cashTotal.closing,
        net: sided(new Prisma.Decimal(cashTotal.in).minus(cashTotal.out)),
      },
    ];

    // ── checks (§8) ──
    const checks: Check[] = [];
    const unbalanced = balance.badCount > 0 || !balance.dr.equals(balance.cr);
    checks.push({
      code: 'BALANCED',
      level: unbalanced ? 'FAIL' : 'OK',
      facts: {
        debit: money(balance.dr),
        credit: money(balance.cr),
        unbalancedVouchers: balance.badCount,
        voucherIds: balance.badIds,
      },
    });
    const moneyMismatches = typeFiltered
      ? []
      : moneyFigs.filter((m) => !m.in.minus(m.out).equals(m.rawNet)).map((m) => m.ledger.id);
    const tiesBroken =
      !typeAmount.equals(groupDr) || !typeAmount.equals(groupCr) || moneyMismatches.length > 0;
    if (tiesBroken) {
      this.logger.error(
        `AMOUNT_TIES broken for ${s.companyId} ${s.branchId ?? 'ALL'} ${s.from}..${s.to}: ` +
          `types ${money(typeAmount)}, groups ${money(groupDr)} / ${money(groupCr)}, ` +
          `money ledgers ${moneyMismatches.join(',') || '-'}`,
      );
    }
    checks.push({
      code: 'AMOUNT_TIES',
      level: tiesBroken ? 'FAIL' : 'OK',
      facts: {
        typeAmount: money(typeAmount),
        groupDebit: money(groupDr),
        groupCredit: money(groupCr),
        moneyChecked: !typeFiltered,
        moneyMismatches,
      },
    });
    checks.push({
      code: 'LEGLESS',
      level: legless.length > 0 ? 'WARN' : 'OK',
      facts: {
        count: legless.length,
        voucherIds: legless.slice(0, FACT_LIST_CAP).map((r) => r.vid),
      },
    });
    checks.push({
      code: 'DRAFTS',
      level: draftCount > 0 ? 'WARN' : 'OK',
      facts: { count: draftCount, amount: money(draftAmount) },
    });
    checks.push({
      code: 'CANCELLED_PAIRS',
      level: pairCount + loneCount > 0 ? 'INFO' : 'OK',
      facts: { pairs: pairCount, loneHalves: loneCount },
    });
    if (!typeFiltered) {
      const pending = moneyFigs
        .filter((m) => m.ledger.kind === 'CLEARING' && m.opening !== null)
        .map((m) => ({ m, closing: (m.opening as Dec).plus(m.in).minus(m.out) }))
        .filter((x) => !x.closing.isZero());
      checks.push({
        code: 'CLEARING_PENDING',
        level: pending.length > 0 ? 'WARN' : 'OK',
        facts: {
          ledgers: pending.map((x) => ({
            ledgerId: x.m.ledger.id,
            ledgerName: x.m.ledger.name,
            closing: sided(x.closing),
          })),
        },
      });
    }
    if (businessDay) {
      checks.push({
        code: 'BUSINESS_DAY',
        level:
          businessDay.status === 'CLOSED' ? 'OK' : businessDay.status === 'NONE' ? 'INFO' : 'WARN',
        facts: { ...businessDay },
      });
    }
    if (future) {
      checks.push({
        code: 'FUTURE_DATED',
        level: future.count > 0 ? 'INFO' : 'OK',
        facts: { count: future.count, lastDate: future.lastDate, today: s.today },
      });
    }
    checks.push({
      code: 'NUMBER_GAPS',
      level: gaps.length > 0 ? 'INFO' : 'OK',
      facts: { series: gaps },
    });

    return {
      scope: {
        companyId: s.companyId,
        companyName: s.companyName,
        branchId: s.branchId,
        branchName: s.branchName,
        accYear: s.accYear,
        fromDate: s.from,
        toDate: s.to,
        days: s.days,
        voucherTypeId: s.voucherTypeId,
        clearingAsBank: s.clearingAsBank,
        groupLevel: s.groupLevel,
        asOf: s.asOf,
      },
      businessDay,
      tiles,
      types,
      typeTotals,
      moneyLedgers: moneyRows,
      moneyTotals,
      groups,
      groupTotals: { debit: money(groupDr), credit: money(groupCr) },
      checks,
    };
  }

  /** `cash_in, cash_out, bank_in, bank_out` sums over `cl` columns (select-list fragment). */
  private moneySums(books: Books): Prisma.Sql {
    return Prisma.sql`
      COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR' AND ledger_id = ANY(${books.cashIds}::uuid[])), 0) AS cash_in,
      COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'CR' AND ledger_id = ANY(${books.cashIds}::uuid[])), 0) AS cash_out,
      COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR' AND ledger_id = ANY(${books.bankishIds}::uuid[])), 0) AS bank_in,
      COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'CR' AND ledger_id = ANY(${books.bankishIds}::uuid[])), 0) AS bank_out`;
  }

  /** Per voucher type: counted vouchers, lone halves, Σ DR amount, cash / bank in and out. */
  private async typeAggregates(db: Db, s: Scope, books: Books): Promise<Map<number, TypeAgg>> {
    const rows = await db.$queryRaw<
      {
        vt: number;
        n: bigint;
        lone: bigint;
        amt: Dec;
        cash_in: Dec;
        cash_out: Dec;
        bank_in: Dec;
        bank_out: Dec;
      }[]
    >`
      WITH ${coreCtes(s, 'RANGE')},
      pv AS (
        SELECT vid, vyr, vt, kind,
               COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR'), 0) AS amt,
               ${this.moneySums(books)}
          FROM cl GROUP BY vid, vyr, vt, kind)
      SELECT vt, COUNT(*) AS n, COUNT(*) FILTER (WHERE kind <> 'NORMAL') AS lone,
             SUM(amt) AS amt, SUM(cash_in) AS cash_in, SUM(cash_out) AS cash_out,
             SUM(bank_in) AS bank_in, SUM(bank_out) AS bank_out
        FROM pv GROUP BY vt`;
    return new Map(
      rows.map((r) => [
        r.vt,
        {
          vouchers: Number(r.n),
          lone: Number(r.lone),
          amt: dec(r.amt),
          cashIn: dec(r.cash_in),
          cashOut: dec(r.cash_out),
          bankIn: dec(r.bank_in),
          bankOut: dec(r.bank_out),
        },
      ]),
    );
  }

  /** Cancelled pairs left out (§4.1), by the CANCELLED original's type. */
  private async pairCounts(db: Db, s: Scope): Promise<Map<number, number>> {
    const rows = await db.$queryRaw<{ vt: number; n: bigint }[]>`
      WITH ${coreCtes(s, 'RANGE')}
      SELECT vt, COUNT(*) AS n FROM k
       WHERE st = 'CANCELLED' AND pair_in
         AND (${s.voucherTypeId}::int IS NULL OR vt = ${s.voucherTypeId}::int)
       GROUP BY vt`;
    return new Map(rows.map((r) => [r.vt, Number(r.n)]));
  }

  private async draftCounts(db: Db, s: Scope): Promise<Map<number, { n: number; amount: Dec }>> {
    const rows = await db.$queryRaw<{ vt: number; n: bigint; amt: Dec }[]>`
      SELECT x.vt, COUNT(*) AS n, COALESCE(SUM(x.doc_amount), 0) AS amt
        FROM (${draftsSql(s)}) x GROUP BY x.vt`;
    return new Map(rows.map((r) => [r.vt, { n: Number(r.n), amount: dec(r.amt) }]));
  }

  /** §8.1 BALANCED — Σ DR / Σ CR of counted legs and the vouchers whose legs do not net to zero. */
  private async balanceFacts(
    db: Db,
    s: Scope,
  ): Promise<{ dr: Dec; cr: Dec; badCount: number; badIds: string[] }> {
    const [row] = await db.$queryRaw<
      { dr: Dec; cr: Dec; bad_n: bigint; bad_ids: string[] | null }[]
    >`
      WITH ${coreCtes(s, 'RANGE')},
      pv AS (SELECT vid, vyr, SUM(signed) AS net FROM cl GROUP BY vid, vyr),
      bad AS (SELECT vid FROM pv WHERE net <> 0)
      SELECT (SELECT COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR'), 0) FROM cl) AS dr,
             (SELECT COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'CR'), 0) FROM cl) AS cr,
             (SELECT COUNT(*) FROM bad) AS bad_n,
             (SELECT array_agg(vid::text) FROM (SELECT vid FROM bad ORDER BY vid LIMIT ${FACT_LIST_CAP}) b) AS bad_ids`;
    return {
      dr: dec(row.dr),
      cr: dec(row.cr),
      badCount: Number(row.bad_n),
      badIds: row.bad_ids ?? [],
    };
  }

  /** Σ DR / Σ CR of counted legs per ledger's own group (rolled up in TypeScript, §4.3). */
  private async groupAggregates(
    db: Db,
    s: Scope,
  ): Promise<{ gid: string | null; dr: Dec; cr: Dec }[]> {
    const rows = await db.$queryRaw<{ gid: string | null; dr: Dec; cr: Dec }[]>`
      WITH ${coreCtes(s, 'RANGE')}
      SELECT l.led_group_id AS gid,
             COALESCE(SUM(cl.amount) FILTER (WHERE cl.dr_cr = 'DR'), 0) AS dr,
             COALESCE(SUM(cl.amount) FILTER (WHERE cl.dr_cr = 'CR'), 0) AS cr
        FROM cl
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = cl.ledger_id
       GROUP BY l.led_group_id`;
    return rows.map((r) => ({ gid: r.gid, dr: dec(r.dr), cr: dec(r.cr) }));
  }

  /**
   * §4.4 — per money ledger: opening at `from` (opening set + counted legs dated
   * before `from`), in / out of the counted legs in range (pair rule applied),
   * and the raw net of every counted leg in range (pairs included) for the
   * AMOUNT_TIES cross-check. Under a voucherTypeId filter there is no opening
   * (a balance has no voucher type).
   */
  private async moneyFigures(db: Db, s: Scope, books: Books): Promise<MoneyFigures[]> {
    const ids = books.money.map((m) => m.id);
    if (ids.length === 0) {
      return [];
    }
    const typeFiltered = s.voucherTypeId !== null;
    const ledgers = { ledgerIds: ids } as const;
    const rows = await db.$queryRaw<
      {
        ledger_id: string;
        op_amt: Dec | null;
        bf_amt: Dec | null;
        din: Dec | null;
        dout: Dec | null;
        moved: boolean;
        raw_amt: Dec | null;
      }[]
    >`
      WITH ${coreCtes(s, 'RANGE')},
      ml AS (SELECT unnest(${ids}::uuid[]) AS ledger_id),
      op AS (${openingSetSql(s, ledgers)}),
      bf AS (SELECT x.av_ledger_id AS ledger_id, SUM(x.av_signed_amount) AS amt
               FROM (${countedLegsSql(s, { upTo: dayBefore(s.from), ledgers })}) x
              GROUP BY x.av_ledger_id),
      mv AS (SELECT ledger_id,
                    COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR'), 0) AS din,
                    COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'CR'), 0) AS dout
               FROM cl WHERE ledger_id = ANY(${ids}::uuid[]) GROUP BY ledger_id),
      rw AS (SELECT ledger_id, SUM(signed) AS amt
               FROM lg WHERE ledger_id = ANY(${ids}::uuid[]) GROUP BY ledger_id)
      SELECT ml.ledger_id, op.amt AS op_amt, bf.amt AS bf_amt, mv.din, mv.dout,
             (mv.ledger_id IS NOT NULL OR (${typeFiltered}::boolean = false AND rw.ledger_id IS NOT NULL)) AS moved,
             rw.amt AS raw_amt
        FROM ml
        LEFT JOIN op ON op.ledger_id = ml.ledger_id
        LEFT JOIN bf ON bf.ledger_id = ml.ledger_id
        LEFT JOIN mv ON mv.ledger_id = ml.ledger_id
        LEFT JOIN rw ON rw.ledger_id = ml.ledger_id`;
    const notes = new Map<string, string>();
    if (s.branchId && !typeFiltered) {
      const noteRows = await db.$queryRaw<
        { ledger_id: string; branch_rows: bigint; company_rows: bigint }[]
      >`${openingNoteSql(s, ledgers)}`;
      for (const n of noteRows) {
        if (Number(n.branch_rows) === 0 && Number(n.company_rows) > 0) {
          notes.set(n.ledger_id, 'COMPANY_LEVEL_ONLY');
        }
      }
    }
    const byId = new Map(rows.map((r) => [r.ledger_id, r]));
    const order: Record<MoneyKind, number> = { CASH: 0, BANK: 1, CLEARING: 2 };
    return [...books.money]
      .sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
      .map((ledger) => {
        const r = byId.get(ledger.id);
        return {
          ledger,
          opening: typeFiltered ? null : dec(r?.op_amt).plus(dec(r?.bf_amt)),
          in: dec(r?.din),
          out: dec(r?.dout),
          rawNet: dec(r?.raw_amt),
          movedInRange: r?.moved === true,
          openingNote: notes.get(ledger.id) ?? null,
        };
      });
  }

  /** /daily — cash and bank(-ish) opening at `from`; null under a type filter. */
  private async dailyOpenings(
    db: Db,
    s: Scope,
    books: Books,
  ): Promise<{ cash: Dec; bank: Dec } | null> {
    if (s.voucherTypeId !== null) {
      return null;
    }
    const ids = [...books.cashIds, ...books.bankishIds];
    if (ids.length === 0) {
      return { cash: ZERO, bank: ZERO };
    }
    const ledgers = { ledgerIds: ids } as const;
    const rows = await db.$queryRaw<{ ledger_id: string; amt: Dec }[]>`
      SELECT ledger_id, SUM(amt) AS amt FROM (
        ${openingSetSql(s, ledgers)}
        UNION ALL
        SELECT x.av_ledger_id, SUM(x.av_signed_amount)
          FROM (${countedLegsSql(s, { upTo: dayBefore(s.from), ledgers })}) x
         GROUP BY x.av_ledger_id) u
       GROUP BY ledger_id`;
    const cash = new Set(books.cashIds);
    const bank = new Set(books.bankishIds);
    let c = ZERO;
    let b = ZERO;
    for (const r of rows) {
      if (cash.has(r.ledger_id)) {
        c = c.plus(r.amt);
      }
      if (bank.has(r.ledger_id)) {
        b = b.plus(r.amt);
      }
    }
    return { cash: c, bank: b };
  }

  /** §7 — the till business-day rows (with session counts) of the scope in [from, to]. */
  private businessDayRows(db: Db, s: Scope, from: string, to: string): Promise<BusinessDayRow[]> {
    return db.$queryRaw<BusinessDayRow[]>`
      SELECT b.tbd_branch_id AS br, b.tbd_business_date AS d, b.tbd_status AS st,
             b.tbd_z_no AS z,
             (SELECT COUNT(*) FROM accounts.till_session t
               WHERE t.tss_day_id = b.tbd_id AND t.tss_acc_year = b.tbd_acc_year
                 AND t.tss_is_deleted = false AND t.tss_status <> 'VOIDED') AS total,
             (SELECT COUNT(*) FROM accounts.till_session t
               WHERE t.tss_day_id = b.tbd_id AND t.tss_acc_year = b.tbd_acc_year
                 AND t.tss_is_deleted = false AND t.tss_status = 'CLOSED') AS closed
        FROM accounts.till_business_day b
       WHERE b.tbd_company_id = ${s.companyId}::uuid
         AND b.tbd_acc_year = ${s.accYear}::char(9)
         AND b.tbd_business_date BETWEEN ${from}::date AND ${to}::date
         AND b.tbd_is_deleted = false
         AND (${s.branchId}::uuid IS NULL OR b.tbd_branch_id = ${s.branchId}::uuid)
       ORDER BY b.tbd_business_date, b.tbd_branch_id`;
  }

  /** §8.2 FUTURE_DATED — non-draft vouchers of the company dated after today (any year, any branch). */
  private async futureDated(db: Db, s: Scope): Promise<{ count: number; lastDate: string | null }> {
    const [row] = await db.$queryRaw<{ n: bigint; last: Date | null }[]>`
      SELECT COUNT(*) AS n, MAX(avh_voucher_date) AS last
        FROM accounts.acc_voucher_header
       WHERE avh_company_id = ${s.companyId}::uuid
         AND avh_is_deleted = false
         AND avh_voucher_status <> 'DRAFT'
         AND avh_voucher_date > ${s.today}::date`;
    return { count: Number(row.n), lastDate: row.last ? isoDate(row.last) : null };
  }

  /** §8.3 NUMBER_GAPS facts — per series, the first 50 deleted / unused numbers and the counts. */
  private async numberGaps(db: Db, s: Scope): Promise<Record<string, unknown>[]> {
    const rows = await this.gapRows(db, s);
    const series = groupBy(rows, (r) => `${r.br}|${r.vt}`);
    return [...series.values()].map((list) => {
      const first = list[0];
      const deleted = list.filter((r) => r.deleted).map((r) => Number(r.n));
      const unused = list.filter((r) => !r.deleted).map((r) => Number(r.n));
      return {
        voucherTypeId: first.vt,
        short: first.short,
        branchId: first.br,
        branchName: first.br_name,
        lo: Number(first.lo),
        hi: Number(first.hi),
        deletedCount: deleted.length,
        unusedCount: unused.length,
        deleted: deleted.slice(0, GAP_LIST_CAP),
        unused: unused.slice(0, GAP_LIST_CAP),
      };
    });
  }

  private gapRows(db: Db, s: Scope) {
    return db.$queryRaw<
      {
        br: string;
        br_name: string | null;
        vt: number;
        short: string | null;
        lo: bigint;
        hi: bigint;
        n: bigint;
        deleted: boolean;
        dead_id: string | null;
        dead_refno: string | null;
      }[]
    >`
      SELECT g.br, b.br_name, g.vt, t.vchr_type_short AS short, g.lo, g.hi, g.n, g.deleted,
             g.dead_id, g.dead_refno
        FROM (${numberGapsSql(s)}) g
        LEFT JOIN public.branch_master b ON b.br_id = g.br
        LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = g.vt
       ORDER BY t.vchr_sort_order, g.vt, b.br_name, g.br, g.n`;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.4 — the Day-wise rows
  // ═════════════════════════════════════════════════════════════════════════

  /** §5.4 — one row per calendar day; each day its own day book (pair rule DAY). */
  private async buildDaily(db: Db, scope: Scope, books: Books): Promise<DailyPayload> {
    const s = scope;
    const [moves, pairs, drafts, openings, bdays] = await sequential([
      () => db.$queryRaw<
        {
          d: Date;
          n: bigint;
          amt: Dec;
          cash_in: Dec;
          cash_out: Dec;
          bank_in: Dec;
          bank_out: Dec;
        }[]
      >`
        WITH ${coreCtes(s, 'DAY')},
        pv AS (
          SELECT vid, vyr, vdate,
                 COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR'), 0) AS amt,
                 ${this.moneySums(books)}
            FROM cl GROUP BY vid, vyr, vdate)
        SELECT vdate AS d, COUNT(*) AS n, SUM(amt) AS amt,
               SUM(cash_in) AS cash_in, SUM(cash_out) AS cash_out,
               SUM(bank_in) AS bank_in, SUM(bank_out) AS bank_out
          FROM pv GROUP BY vdate`,
      () => db.$queryRaw<{ d: Date; n: bigint }[]>`
        WITH ${coreCtes(s, 'DAY')}
        SELECT vdate AS d, COUNT(*) AS n FROM k
         WHERE st = 'CANCELLED' AND pair_day
           AND (${s.voucherTypeId}::int IS NULL OR vt = ${s.voucherTypeId}::int)
         GROUP BY vdate`,
      () => db.$queryRaw<{ d: Date; n: bigint }[]>`
        SELECT x.vdate AS d, COUNT(*) AS n FROM (${draftsSql(s)}) x GROUP BY x.vdate`,
      () => this.dailyOpenings(db, scope, books),
      () => this.businessDayRows(db, scope, scope.from, scope.to),
    ]);
    const byDate = <T extends { d: Date }>(rows: T[]) =>
      new Map(rows.map((r) => [isoDate(r.d), r]));
    const mv = byDate(moves);
    const pr = byDate(pairs);
    const dr = byDate(drafts);
    const bd = groupBy(bdays, (r) => isoDate(r.d));
    let cash = openings?.cash ?? null;
    let bank = openings?.bank ?? null;
    const days: DailyRow[] = [];
    for (const date of datesBetween(s.from, s.to)) {
      const m = mv.get(date);
      const cashIn = dec(m?.cash_in);
      const cashOut = dec(m?.cash_out);
      const bankIn = dec(m?.bank_in);
      const bankOut = dec(m?.bank_out);
      cash = cash === null ? null : cash.plus(cashIn).minus(cashOut);
      bank = bank === null ? null : bank.plus(bankIn).minus(bankOut);
      const vouchers = Number(m?.n ?? 0);
      const nDrafts = Number(dr.get(date)?.n ?? 0);
      const nPairs = Number(pr.get(date)?.n ?? 0);
      const dayRows = bd.get(date) ?? [];
      if (!scope.zeroRows && vouchers === 0 && nDrafts === 0 && nPairs === 0) {
        continue;
      }
      days.push({
        date,
        vouchers,
        drafts: nDrafts,
        cancelledPairs: nPairs,
        amount: money(m?.amt),
        cashIn: money(cashIn),
        cashOut: money(cashOut),
        cashClosing: cash === null ? null : sided(cash),
        bankIn: money(bankIn),
        bankOut: money(bankOut),
        bankClosing: bank === null ? null : sided(bank),
        businessDay: foldBusinessDay(dayRows).status,
      });
    }
    return {
      cashOpening: openings ? sided(openings.cash) : null,
      bankOpening: openings ? sided(openings.bank) : null,
      days,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.3 — the voucher rows
  // ═════════════════════════════════════════════════════════════════════════

  /** §5.3 — one page of voucher rows (or of drafts) with the filtered set's totals. */
  private async buildVouchers(
    db: Db,
    scope: Scope,
    books: Books,
    q: DaySummaryVouchersDto,
  ): Promise<VouchersPayload> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
    if (q.draftsOnly === true) {
      return this.draftRows(db, scope, page, pageSize);
    }
    const filter = voucherFilterOf(q);
    const [totals] = await db.$queryRaw<{ n: bigint; amt: Dec }[]>`
      WITH ${this.voucherCtes(scope, books, filter)}
      SELECT COUNT(*) AS n, COALESCE(SUM(f.amt), 0) AS amt FROM f`;
    const core = await this.voucherCoreRows(db, scope, books, filter, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const rows = await this.decorate(db, core, books, q.withLegs ?? false);
    return {
      draftsOnly: false,
      rows,
      page: { page, pageSize, totalRows: Number(totals.n) },
      totals: { amount: money(totals.amt) },
    };
  }

  /**
   * `f`: one row per counted voucher in range after the /vouchers filters —
   * type, nature, money kind, and whether pairs wholly inside the range show.
   * amt = Σ DR legs; legs = live leg count.
   */
  private voucherCtes(s: Scope, books: Books, filter: VoucherFilter): Prisma.Sql {
    const kindIds =
      filter.moneyKind === 'CASH'
        ? books.cashIds
        : filter.moneyKind === 'BANK'
          ? books.bankishIds
          : filter.moneyKind === 'CLEARING'
            ? books.clearingIds
            : [];
    return Prisma.sql`
      ${coreCtes(s, 'RANGE')},
      pv AS (
        SELECT vid, vyr,
               COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR'), 0) AS amt,
               COUNT(*) AS legs,
               bool_or(ledger_id = ANY(${kindIds}::uuid[])) AS touches
          FROM lg GROUP BY vid, vyr),
      f AS (
        SELECT k.vid, k.vyr, k.vt, k.st, k.vdate, k.kind, k.pair_in, pv.amt, pv.legs
          FROM k
          JOIN pv ON pv.vid = k.vid AND pv.vyr = k.vyr
          LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = k.vt
         WHERE (${s.voucherTypeId}::int IS NULL OR k.vt = ${s.voucherTypeId}::int)
           AND (${filter.nature}::text IS NULL OR t.vchr_nature::text = ${filter.nature}::text)
           AND (${filter.moneyKind}::text IS NULL OR pv.touches)
           AND (${filter.includeCancelledPairs}::boolean OR NOT k.pair_in))`;
  }

  private voucherCoreRows(
    db: Db,
    s: Scope,
    books: Books,
    filter: VoucherFilter,
    paging: { limit: number; offset: number },
  ): Promise<VoucherCoreRow[]> {
    return db.$queryRaw<VoucherCoreRow[]>`
      WITH ${this.voucherCtes(s, books, filter)}
      SELECT f.vid, f.vyr, f.vt, f.st, f.vdate, f.kind, f.pair_in, f.amt, f.legs,
             h.avh_voucher_refno AS refno, h.avh_branch_id AS br, b.br_name,
             h.avh_party_id AS party_id, pl.led_name AS party_name, h.avh_remarks AS remarks,
             h.avh_created_by AS created_by, u.usr_login_name AS created_by_name,
             h.avh_src_module AS src_module, h.avh_src_doc_type AS src_doc_type,
             h.avh_src_doc_id AS src_doc_id
        FROM f
        JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = f.vid AND h.avh_acc_year = f.vyr
        LEFT JOIN public.branch_master b ON b.br_id = h.avh_branch_id
        LEFT JOIN accounts.acc_ledger_master pl ON pl.led_id = h.avh_party_id
        ${createdByJoinSql('h.avh_created_by', 'u')}
       ORDER BY f.vdate, h.avh_voucher_slno NULLS LAST, f.vid
       LIMIT ${paging.limit} OFFSET ${paging.offset}`;
  }

  private async decorate(
    db: Db,
    core: VoucherCoreRow[],
    books: Books,
    withLegs: boolean,
  ): Promise<DayVoucherRow[]> {
    if (core.length === 0) {
      return [];
    }
    const legs = await this.legsOf(
      db,
      core.map((r) => ({ vid: r.vid, vyr: r.vyr })),
    );
    const legsByVoucher = groupBy(legs, (leg) => key(leg.vid, leg.vyr));
    return core.map((r) => {
      const t = books.types.get(r.vt);
      const vLegs = legsByVoucher.get(key(r.vid, r.vyr)) ?? [];
      const particulars = particularsOf(vLegs, anchorLedger(vLegs, r.party_id, t?.nature ?? null));
      return {
        voucherId: r.vid,
        accYear: r.vyr,
        date: isoDate(r.vdate),
        voucherTypeId: r.vt,
        short: t?.short ?? null,
        name: t?.name ?? null,
        nature: t?.nature ?? null,
        voucherNo: r.refno,
        branchId: r.br,
        branchName: r.br_name,
        party: r.party_name,
        particulars,
        asPerDetails: particulars === null,
        legCount: Number(r.legs),
        narration: r.remarks?.trim() || null,
        amount: money(r.amt),
        status: r.st,
        rowKind: r.kind,
        pairInRange: r.pair_in,
        createdBy: r.created_by_name ?? r.created_by,
        src: srcOf(r),
        ...(withLegs ? { legs: vLegs.map(toLeg) } : {}),
      };
    });
  }

  /** Every live leg of the given vouchers, in av_row_no order, with ledger names. */
  private async legsOf(db: Db, keys: readonly { vid: string; vyr: string }[]): Promise<LegRow[]> {
    const rows: LegRow[] = [];
    // Chunked: an export can name 20,000 vouchers.
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      rows.push(
        ...(await db.$queryRaw<LegRow[]>`
          SELECT v.av_voucher_id AS vid, v.av_acc_year AS vyr, v.av_row_no AS row_no,
                 v.av_dr_cr AS dr_cr, v.av_ledger_id AS ledger_id, l.led_name AS ledger_name,
                 v.av_amount AS amount, v.av_role AS role,
                 v.av_opp_ledger_id AS opp_ledger_id, ol.led_name AS opp_ledger_name
            FROM accounts.acc_vouchers v
            LEFT JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
            LEFT JOIN accounts.acc_ledger_master ol ON ol.led_id = v.av_opp_ledger_id
           WHERE (v.av_voucher_id, v.av_acc_year) IN (${Prisma.join(
             chunk.map((k) => Prisma.sql`(${k.vid}::uuid, ${k.vyr}::char(9))`),
           )})
             AND v.av_is_deleted = false
           ORDER BY v.av_voucher_id, v.av_row_no`),
      );
    }
    return rows;
  }

  private async draftRows(
    db: Db,
    s: Scope,
    page: number,
    pageSize: number,
  ): Promise<VouchersPayload> {
    const [totals] = await db.$queryRaw<{ n: bigint; amt: Dec }[]>`
      SELECT COUNT(*) AS n, COALESCE(SUM(x.doc_amount), 0) AS amt FROM (${draftsSql(s)}) x`;
    const rows = await db.$queryRaw<
      {
        vid: string;
        vyr: string;
        vt: number;
        vdate: Date;
        doc_amount: Dec;
        created_by: string | null;
        created_by_name: string | null;
        src_module: string | null;
        src_doc_type: string | null;
        src_doc_id: string | null;
        short: string | null;
        name: string | null;
      }[]
    >`
      SELECT x.*, u.usr_login_name AS created_by_name, t.vchr_type_short AS short,
             t.vchr_type_name AS name
        FROM (${draftsSql(s)}) x
        LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = x.vt
        ${createdByJoinSql('x.created_by', 'u')}
       ORDER BY x.vdate, x.vid
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const drafts: DraftRow[] = rows.map((r) => ({
      voucherId: r.vid,
      accYear: r.vyr,
      date: isoDate(r.vdate),
      voucherTypeId: r.vt,
      short: r.short,
      name: r.name,
      amount: money(r.doc_amount),
      createdBy: r.created_by_name ?? r.created_by,
      src: srcOf(r),
    }));
    return {
      draftsOnly: true,
      rows: drafts,
      page: { page, pageSize, totalRows: Number(totals.n) },
      totals: { amount: money(totals.amt) },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §5.6 — rows behind each check (DETAIL_CAP + 1 read, to flag truncation)
  // ═════════════════════════════════════════════════════════════════════════

  private async checkRows(
    db: Db,
    s: Scope,
    books: Books,
    code: CheckCode,
  ): Promise<Record<string, unknown>[]> {
    const cap = DETAIL_CAP + 1;
    switch (code) {
      case 'BALANCED': {
        const rows = await db.$queryRaw<
          {
            vid: string;
            vyr: string;
            vdate: Date;
            short: string | null;
            refno: string | null;
            dr: Dec;
            cr: Dec;
          }[]
        >`
          WITH ${coreCtes(s, 'RANGE')},
          pv AS (SELECT vid, vyr, MIN(vdate) AS vdate,
                        COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR'), 0) AS dr,
                        COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'CR'), 0) AS cr
                   FROM cl GROUP BY vid, vyr)
          SELECT pv.vid, pv.vyr, pv.vdate, t.vchr_type_short AS short, h.avh_voucher_refno AS refno,
                 pv.dr, pv.cr
            FROM pv
            JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = pv.vid AND h.avh_acc_year = pv.vyr
            LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
           WHERE pv.dr <> pv.cr
           ORDER BY pv.vdate, pv.vid LIMIT ${cap}`;
        return rows.map((r) => ({
          voucherId: r.vid,
          accYear: r.vyr,
          date: isoDate(r.vdate),
          short: r.short,
          voucherNo: r.refno,
          debit: money(r.dr),
          credit: money(r.cr),
        }));
      }
      case 'AMOUNT_TIES': {
        const figs = s.voucherTypeId === null ? await this.moneyFigures(db, s, books) : [];
        return figs
          .filter((m) => !m.in.minus(m.out).equals(m.rawNet))
          .map((m) => ({
            ledgerId: m.ledger.id,
            ledgerName: m.ledger.name,
            kind: m.ledger.kind,
            in: money(m.in),
            out: money(m.out),
            rawNet: sided(m.rawNet),
          }));
      }
      case 'LEGLESS': {
        const rows = await db.$queryRaw<
          {
            vid: string;
            vyr: string;
            vdate: Date;
            vt: number;
            refno: string | null;
            status: string;
            br_name: string | null;
          }[]
        >`
          SELECT x.vid, x.vyr, x.vdate, x.vt, x.refno, x.status, b.br_name
            FROM (${leglessSql(s)}) x
            LEFT JOIN public.branch_master b ON b.br_id = x.br
           ORDER BY x.vdate, x.vid LIMIT ${cap}`;
        return rows.map((r) => ({
          voucherId: r.vid,
          accYear: r.vyr,
          date: isoDate(r.vdate),
          voucherTypeId: r.vt,
          short: books.types.get(r.vt)?.short ?? null,
          voucherNo: r.refno,
          status: r.status,
          branchName: r.br_name,
        }));
      }
      case 'DRAFTS': {
        const page = await this.draftRows(db, s, 1, cap);
        return page.rows as unknown as Record<string, unknown>[];
      }
      case 'CANCELLED_PAIRS': {
        const rows = await db.$queryRaw<
          {
            vid: string;
            vyr: string;
            vdate: Date;
            vt: number;
            kind: RowKind;
            pair_in: boolean;
            other_id: string | null;
            refno: string | null;
            amt: Dec;
          }[]
        >`
          WITH ${coreCtes(s, 'RANGE')},
          pv AS (SELECT vid, vyr, COALESCE(SUM(amount) FILTER (WHERE dr_cr = 'DR'), 0) AS amt
                   FROM lg GROUP BY vid, vyr)
          SELECT k.vid, k.vyr, k.vdate, k.vt, k.kind, k.pair_in, k.other_id,
                 h.avh_voucher_refno AS refno, pv.amt
            FROM k
            JOIN pv ON pv.vid = k.vid AND pv.vyr = k.vyr
            JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = k.vid AND h.avh_acc_year = k.vyr
           WHERE k.kind <> 'NORMAL'
             AND (${s.voucherTypeId}::int IS NULL OR k.vt = ${s.voucherTypeId}::int)
           ORDER BY k.vdate, h.avh_voucher_slno NULLS LAST, k.vid LIMIT ${cap}`;
        return rows.map((r) => ({
          voucherId: r.vid,
          accYear: r.vyr,
          date: isoDate(r.vdate),
          voucherTypeId: r.vt,
          short: books.types.get(r.vt)?.short ?? null,
          voucherNo: r.refno,
          rowKind: r.kind,
          pairInRange: r.pair_in,
          otherVoucherId: r.other_id,
          amount: money(r.amt),
        }));
      }
      case 'CLEARING_PENDING': {
        if (s.voucherTypeId !== null) {
          return [];
        }
        const figs = await this.moneyFigures(db, s, books);
        return figs
          .filter((m) => m.ledger.kind === 'CLEARING' && m.opening !== null)
          .map((m) => ({ m, closing: (m.opening as Dec).plus(m.in).minus(m.out) }))
          .filter((x) => !x.closing.isZero())
          .map((x) => ({
            ledgerId: x.m.ledger.id,
            ledgerName: x.m.ledger.name,
            opening: sided(x.m.opening as Dec),
            in: money(x.m.in),
            out: money(x.m.out),
            closing: sided(x.closing),
          }));
      }
      case 'BUSINESS_DAY': {
        const rows = await this.businessDayRows(db, s, s.from, s.to);
        const names = await this.branchNames(
          db,
          rows.map((r) => r.br),
        );
        return rows.slice(0, cap).map((r) => ({
          date: isoDate(r.d),
          branchId: r.br,
          branchName: names.get(r.br) ?? null,
          status: r.st,
          zNo: r.z,
          sessions: { total: Number(r.total), closed: Number(r.closed) },
        }));
      }
      case 'FUTURE_DATED': {
        const rows = await db.$queryRaw<
          {
            vid: string;
            vyr: string;
            vdate: Date;
            vt: number;
            refno: string | null;
            status: string;
            br_name: string | null;
            amt: Dec;
          }[]
        >`
          SELECT h.avh_voucher_id AS vid, h.avh_acc_year AS vyr, h.avh_voucher_date AS vdate,
                 h.avh_voucher_type_id AS vt, h.avh_voucher_refno AS refno,
                 h.avh_voucher_status AS status, b.br_name, h.avh_total_debit AS amt
            FROM accounts.acc_voucher_header h
            LEFT JOIN public.branch_master b ON b.br_id = h.avh_branch_id
           WHERE h.avh_company_id = ${s.companyId}::uuid
             AND h.avh_is_deleted = false
             AND h.avh_voucher_status <> 'DRAFT'
             AND h.avh_voucher_date > ${s.today}::date
           ORDER BY h.avh_voucher_date, h.avh_voucher_id LIMIT ${cap}`;
        return rows.map((r) => ({
          voucherId: r.vid,
          accYear: r.vyr,
          date: isoDate(r.vdate),
          voucherTypeId: r.vt,
          short: books.types.get(r.vt)?.short ?? null,
          voucherNo: r.refno,
          status: r.status,
          branchName: r.br_name,
          amount: money(r.amt),
        }));
      }
      case 'NUMBER_GAPS': {
        const rows = await this.gapRows(db, s);
        return rows.slice(0, cap).map((r) => ({
          voucherTypeId: r.vt,
          short: r.short,
          branchId: r.br,
          branchName: r.br_name,
          voucherNo: Number(r.n),
          state: r.deleted ? 'DELETED' : 'UNUSED',
          deletedVoucherId: r.dead_id,
          deletedVoucherRefno: r.dead_refno,
        }));
      }
    }
  }

  private async branchNames(db: Db, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await db.$queryRaw<{ id: string; name: string }[]>`
      SELECT br_id AS id, br_name AS name FROM public.branch_master
       WHERE br_id = ANY(${[...new Set(ids)]}::uuid[])`;
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function refuse(code: string, field: string, message: string): never {
  throwAccountsBadRequest('Day summary request refused', [{ field, message, code }]);
}

function dec(value: Dec | string | number | null | undefined): Dec {
  return new Prisma.Decimal(value ?? 0);
}

function key(vid: string, vyr: string): string {
  return `${vid}|${vyr.trim()}`;
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = keyOf(row);
    const list = out.get(k);
    if (list) {
      list.push(row);
    } else {
      out.set(k, [row]);
    }
  }
  return out;
}

/** Runs the thunks one after another (an interactive transaction is one connection anyway). */
async function sequential<T extends readonly (() => Promise<unknown>)[]>(
  thunks: readonly [...T],
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const out: unknown[] = [];
  for (const thunk of thunks) {
    out.push(await thunk());
  }
  return out as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

/** YYYY-MM-DD for every calendar day in [from, to]. */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function voucherFilterOf(q: DaySummaryExportDto): VoucherFilter {
  return {
    includeCancelledPairs: q.includeCancelledPairs ?? true,
    nature: q.natureFilter ?? null,
    moneyKind: q.moneyKind ?? null,
  };
}

function unknownType(id: number): TypeInfo {
  return {
    id,
    code: String(id),
    short: null,
    name: `Type ${id}`,
    nature: 'JOURNAL',
    category: 'ACCOUNTING',
    sortOrder: Number.MAX_SAFE_INTEGER,
    isActive: false,
    affectsAccounts: true,
  };
}

/**
 * §7 — the business-day rows of one date folded to one status. No row → NONE
 * (a branch that does not run tills). One branch → its row. All branches →
 * the common status of the branches that have a row, MIXED when they differ.
 */
function foldBusinessDay(rows: readonly BusinessDayRow[]): BusinessDay {
  if (rows.length === 0) {
    return { status: 'NONE', zNo: null, sessions: { total: 0, closed: 0 } };
  }
  const statuses = new Set(rows.map((r) => r.st));
  const status: BusinessDayStatus =
    statuses.size === 1 ? ([...statuses][0] as BusinessDayStatus) : 'MIXED';
  return {
    status,
    zNo: rows.length === 1 ? rows[0].z : null,
    sessions: {
      total: rows.reduce((n, r) => n + Number(r.total), 0),
      closed: rows.reduce((n, r) => n + Number(r.closed), 0),
    },
  };
}

function srcOf(r: {
  src_module: string | null;
  src_doc_type: string | null;
  src_doc_id: string | null;
}): { module: string; docType: string; docId: string } | null {
  return r.src_module && r.src_doc_type && r.src_doc_id
    ? { module: r.src_module, docType: r.src_doc_type, docId: r.src_doc_id }
    : null;
}

/**
 * §5.3 — "this ledger" for particulars: the party when it has a leg here; else
 * the first CR leg on a receipt-nature voucher; else the first DR leg.
 */
function anchorLedger(
  legs: LegRow[],
  partyId: string | null,
  nature: string | null,
): string | null {
  if (partyId && legs.some((leg) => leg.ledger_id === partyId)) {
    return partyId;
  }
  const side = nature === 'RECEIPT' ? 'CR' : 'DR';
  return legs.find((leg) => leg.dr_cr.trim() === side)?.ledger_id ?? legs[0]?.ledger_id ?? null;
}

/**
 * The Ledger Statement's §8 rule, copied (plan §2 — a rule, not a route):
 *   1. the anchor's legs all name the same av_opp_ledger_id → that ledger
 *   2. else exactly one distinct ledger on the OPPOSITE side → that ledger
 *   3. else null — "(as per details)"
 */
function particularsOf(legs: LegRow[], ledgerId: string | null): string | null {
  if (!ledgerId) {
    return null;
  }
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

function toLeg(leg: LegRow): DayVoucherLeg {
  return {
    rowNo: leg.row_no,
    ledgerId: leg.ledger_id,
    ledgerName: leg.ledger_name,
    side: leg.dr_cr.trim() === 'CR' ? 'CR' : 'DR',
    amount: money(leg.amount),
    role: leg.role,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
