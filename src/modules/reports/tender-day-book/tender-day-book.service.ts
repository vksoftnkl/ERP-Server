import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  throwAccountsBadRequest,
  throwAccountsForbidden,
} from 'src/common/utils/module-service.utils';
import { openingSetSql } from '../common/voucher-books.sql';
import { labelledMoneyLinesSql, type MoneyLinesScope } from './tender-day-book.sql';
import type { NoTenderQueryDto, TenderBooksScopeDto, TenderDayBookQueryDto } from './tender-day-book.dto';
import {
  TENDER_BOOKS_ERROR,
  type NoTenderPayload,
  type TenderBookGroup,
  type TenderBookLedger,
  type TenderBookRow,
  type TenderDayBookPayload,
} from './tender-day-book.types';

type Db = Prisma.TransactionClient;
type Dec = Prisma.Decimal;

const DAY_SUMMARY_MENU_ID = 284; // Account Day Summary — the same readers (notes 126 §4)
const DAY_BOOK_DETAIL_MENU_ID = 181;
const DEFAULT_ROW_CAP = 5000;
const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 10_000,
  timeout: 120_000,
} as const;
const ZERO = new Prisma.Decimal(0);

interface Scope {
  companyId: string;
  accYear: string;
  branchId: string | null;
  from: string;
  to: string;
  sessionId: string | null;
}

interface RawRow {
  voucher_id: string;
  acc_year: string;
  voucher_date: string;
  voucher_type_id: number;
  voucher_type_code: string | null;
  refno: string | null;
  branch_id: string;
  session_id: string | null;
  party_id: string | null;
  party_name: string | null;
  ledger_id: string;
  ledger_name: string;
  ledger_type: 'CASH' | 'BANK';
  side: 'DR' | 'CR';
  is_mirror: boolean;
  tender_id: string | null;
  tender_name: string | null;
  tender_type_id: number | null;
  tender_type_name: string | null;
  amount: Dec;
}

/**
 * Notes 126 §4 — the Day Book by tender and the money lines with no tender:
 * the cash and bank ledgers' legs, each labelled with the tender it moved by
 * (`labelledMoneyLinesSql`). Read only, one REPEATABLE READ snapshot per call,
 * custom plans (see prisma-generic-plan-slow-reports). Who may read it: the
 * Account Day Summary's readers — menu 284, or 181 Day Book Detail.
 */
@Injectable()
export class TenderDayBookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async dayBook(q: TenderDayBookQueryDto): Promise<TenderDayBookPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      if (!q.fromDate) {
        refuse(TENDER_BOOKS_ERROR.DATE_REQUIRED, 'fromDate', 'fromDate is required.');
      }
      const scope = await this.resolveScope(db, q, q.fromDate, q.toDate ?? q.fromDate);
      const groupBy = q.groupBy ?? 'TENDER';
      const tenderIds = new Set(q.tenderIds ?? []);
      const typeIds = new Set((q.tenderTypeIds ?? []).map(Number));
      const filtered = tenderIds.size > 0 || typeIds.size > 0;
      const keep = (tenderId: string | null, typeId: number | null) =>
        !filtered ||
        (tenderId !== null && tenderIds.has(tenderId)) ||
        (typeId !== null && typeIds.has(typeId));

      // ── the year up to toDate, per ledger × tender (or type) ──────────────
      const lines = labelledMoneyLinesSql(this.linesScope(scope, null));
      const byType = groupBy === 'TYPE';
      const agg = await db.$queryRaw<
        {
          ledger_id: string;
          ledger_name: string;
          ledger_type: 'CASH' | 'BANK';
          tender_id: string | null;
          tender_name: string | null;
          tender_type_id: number | null;
          tender_type_name: string | null;
          opening: Dec;
          debit: Dec;
          credit: Dec;
        }[]
      >`
        WITH x0 AS (${lines}),
        -- the group key once, so SELECT and GROUP BY read the same column
        x AS (SELECT x0.*, CASE WHEN ${byType} THEN NULL ELSE x0.tender_id END AS gkey FROM x0)
        SELECT x.ledger_id, l.led_name AS ledger_name, upper(l.led_ledger_type) AS ledger_type,
               x.gkey AS tender_id, max(tm.tnd_name) AS tender_name,
               x.tender_type_id, max(tt.ttm_type_name) AS tender_type_name,
               COALESCE(sum(x.signed) FILTER (WHERE x.voucher_date < ${scope.from}), 0) AS opening,
               COALESCE(sum(x.amount) FILTER (WHERE x.voucher_date >= ${scope.from} AND x.side = 'DR'), 0) AS debit,
               COALESCE(sum(x.amount) FILTER (WHERE x.voucher_date >= ${scope.from} AND x.side = 'CR'), 0) AS credit
          FROM x
          JOIN accounts.acc_ledger_master l ON l.led_id = x.ledger_id::uuid
          LEFT JOIN accounts.acc_tender_master tm ON tm.tnd_id = x.gkey::uuid
          LEFT JOIN accounts.acc_tender_types tt ON tt.ttm_type_id = x.tender_type_id
         GROUP BY x.ledger_id, l.led_name, l.led_ledger_type, x.gkey, x.tender_type_id
         ORDER BY l.led_name, x.tender_type_id NULLS LAST, x.gkey`;

      const groups: TenderBookGroup[] = [];
      const books = new Map<string, TenderBookLedger & { o: Dec; d: Dec; c: Dec; n: Dec }>();
      for (const a of agg) {
        const opening = dec(a.opening);
        const debit = dec(a.debit);
        const credit = dec(a.credit);
        const book = books.get(a.ledger_id) ?? {
          ledgerId: a.ledger_id,
          ledgerName: a.ledger_name,
          ledgerType: a.ledger_type,
          openingSet: '0.00',
          opening: '0.00',
          debit: '0.00',
          credit: '0.00',
          closing: '0.00',
          noTender: '0.00',
          o: ZERO,
          d: ZERO,
          c: ZERO,
          n: ZERO,
        };
        book.o = book.o.plus(opening);
        book.d = book.d.plus(debit);
        book.c = book.c.plus(credit);
        if (a.tender_type_id === null) {
          book.n = book.n.plus(debit).plus(credit);
        }
        books.set(a.ledger_id, book);
        if (!keep(a.tender_id, a.tender_type_id)) {
          continue;
        }
        groups.push({
          key: `${a.ledger_id}|${byType ? (a.tender_type_id ?? 'NONE') : (a.tender_id ?? 'NONE')}`,
          tenderId: a.tender_id,
          tenderName: a.tender_name,
          tenderTypeId: a.tender_type_id,
          tenderTypeName: a.tender_type_name,
          ledgerId: a.ledger_id,
          ledgerName: a.ledger_name,
          ledgerType: a.ledger_type,
          opening: money(opening),
          debit: money(debit),
          credit: money(credit),
          closing: money(opening.plus(debit).minus(credit)),
        });
      }

      // ── the books per ledger: the opening set has no tender ───────────────
      const ledgerIds = [...books.keys()];
      const sets = ledgerIds.length
        ? await db.$queryRaw<{ ledger_id: string; amt: Dec }[]>`
            SELECT ledger_id::text, amt FROM (${openingSetSql(
              { companyId: scope.companyId, accYear: scope.accYear, branchId: scope.branchId },
              { ledgerIds },
            )}) s`
        : [];
      const setOf = new Map(sets.map((s) => [s.ledger_id, dec(s.amt)]));
      const ledgers: TenderBookLedger[] = [...books.values()].map((b) => {
        const set = setOf.get(b.ledgerId) ?? ZERO;
        const opening = set.plus(b.o);
        return {
          ledgerId: b.ledgerId,
          ledgerName: b.ledgerName,
          ledgerType: b.ledgerType,
          openingSet: money(set),
          opening: money(opening),
          debit: money(b.d),
          credit: money(b.c),
          closing: money(opening.plus(b.d).minus(b.c)),
          noTender: money(b.n),
        };
      });

      // ── the lines of the range ────────────────────────────────────────────
      let rows: TenderBookRow[] = [];
      let rowsTruncated = false;
      if (q.withRows !== false) {
        const cap = q.limit ?? DEFAULT_ROW_CAP;
        const raw = (await this.rows(db, scope, false, cap + 1)).filter((r) =>
          keep(r.tender_id, r.tender_type_id),
        );
        rowsTruncated = raw.length > cap;
        rows = raw.slice(0, cap).map(toRow);
      }
      return {
        companyId: scope.companyId,
        accYear: scope.accYear,
        branchId: scope.branchId,
        fromDate: scope.from,
        toDate: scope.to,
        groupBy,
        groups,
        ledgers,
        rows,
        rowsTruncated,
      };
    });
  }

  async noTender(q: NoTenderQueryDto): Promise<NoTenderPayload> {
    return this.snapshot(async (db) => {
      await this.assertMenuRight(db);
      const scope = await this.resolveScope(db, q, q.fromDate ?? null, q.toDate ?? null);
      const lines = labelledMoneyLinesSql(this.linesScope(scope, scope.from));
      const byType = await db.$queryRaw<{ code: string | null; n: number; amt: Dec }[]>`
        WITH x AS (${lines})
        SELECT vt.vchr_type_code AS code, count(*)::int AS n, sum(x.amount) AS amt
          FROM x LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = x.voucher_type_id
         WHERE x.tender_id IS NULL
         GROUP BY vt.vchr_type_code ORDER BY 2 DESC, 1`;
      const cap = q.limit ?? DEFAULT_ROW_CAP;
      const raw = await this.rows(db, scope, true, cap + 1);
      const count = byType.reduce((n, t) => n + t.n, 0);
      return {
        companyId: scope.companyId,
        accYear: scope.accYear,
        branchId: scope.branchId,
        fromDate: scope.from,
        toDate: scope.to,
        count,
        amount: money(byType.reduce((s, t) => s.plus(dec(t.amt)), ZERO)),
        byVoucherType: byType.map((t) => ({
          voucherTypeCode: t.code,
          count: t.n,
          amount: money(dec(t.amt)),
        })),
        rows: raw.slice(0, cap).map(toRow),
        rowsTruncated: raw.length > cap,
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════

  private linesScope(scope: Scope, from: string | null): MoneyLinesScope {
    return {
      companyId: scope.companyId,
      accYear: scope.accYear,
      branchId: scope.branchId,
      upTo: scope.to,
      from,
      sessionId: scope.sessionId,
    };
  }

  private rows(db: Db, scope: Scope, noTenderOnly: boolean, cap: number): Promise<RawRow[]> {
    const lines = labelledMoneyLinesSql(this.linesScope(scope, scope.from));
    return db.$queryRaw<RawRow[]>`
      WITH x AS (${lines})
      SELECT x.voucher_id, x.acc_year, x.voucher_date, x.voucher_type_id,
             vt.vchr_type_code AS voucher_type_code, x.refno, x.branch_id, x.session_id,
             x.party_id, p.led_name AS party_name, x.ledger_id, l.led_name AS ledger_name,
             upper(l.led_ledger_type) AS ledger_type, x.side, x.is_mirror,
             x.tender_id, tm.tnd_name AS tender_name, x.tender_type_id,
             tt.ttm_type_name AS tender_type_name, x.amount
        FROM x
        JOIN accounts.acc_ledger_master l ON l.led_id = x.ledger_id::uuid
        LEFT JOIN accounts.acc_ledger_master p ON p.led_id = x.party_id::uuid
        LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = x.voucher_type_id
        LEFT JOIN accounts.acc_tender_master tm ON tm.tnd_id = x.tender_id::uuid
        LEFT JOIN accounts.acc_tender_types tt ON tt.ttm_type_id = x.tender_type_id
       WHERE (NOT ${noTenderOnly} OR x.tender_id IS NULL)
       ORDER BY x.voucher_date, x.refno NULLS LAST, l.led_name, x.side DESC
       LIMIT ${cap}::int`;
  }

  private snapshot<T>(work: (db: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      return work(tx);
    }, TX_OPTIONS);
  }

  /** 403 unless the caller may view 284 Account Day Summary or 181 Day Book Detail. */
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
      throwAccountsForbidden('No access to the Day Book by tender', [
        {
          field: 'menu',
          code: TENDER_BOOKS_ERROR.NO_MENU_RIGHT,
          message: `This user may not view menu ${DAY_SUMMARY_MENU_ID} (Account Day Summary) or ${DAY_BOOK_DETAIL_MENU_ID} (Day Book Detail).`,
        },
      ]);
    }
  }

  /** YEAR_UNKNOWN, BRANCH_NOT_IN_COMPANY, RANGE_REVERSED, RANGE_OUTSIDE_YEAR. */
  private async resolveScope(
    db: Db,
    q: TenderBooksScopeDto,
    from: string | null,
    to: string | null,
  ): Promise<Scope> {
    const [fy] = await db.$queryRaw<{ begin: string; end: string; today: string }[]>`
      SELECT to_char(f.fy_begin_date, 'YYYY-MM-DD') AS begin,
             to_char(f.fy_end_date, 'YYYY-MM-DD') AS end,
             to_char((now() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS today
        FROM public.fiscal_years f
       WHERE f.comp_id = ${q.companyId}::uuid AND f.fy_year_name = ${q.accYear}::char(9)
         AND f.is_deleted = false
       LIMIT 1`;
    if (!fy) {
      refuse(TENDER_BOOKS_ERROR.YEAR_UNKNOWN, 'accYear', `No fiscal year ${q.accYear} for this company.`);
    }
    if (q.branchId) {
      const [br] = await db.$queryRaw<{ br_comp_id: string | null }[]>`
        SELECT br_comp_id FROM public.branch_master WHERE br_id = ${q.branchId}::uuid`;
      if (!br || br.br_comp_id !== q.companyId) {
        refuse(TENDER_BOOKS_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'This branch does not belong to the company.');
      }
    }
    const f = from ?? fy.begin;
    const t = to ?? (fy.today < fy.end ? fy.today : fy.end);
    if (f > t) {
      refuse(TENDER_BOOKS_ERROR.RANGE_REVERSED, 'fromDate', `${f} is after ${t}.`);
    }
    if (f < fy.begin || t > fy.end) {
      refuse(
        TENDER_BOOKS_ERROR.RANGE_OUTSIDE_YEAR,
        f < fy.begin ? 'fromDate' : 'toDate',
        `${q.accYear} runs ${fy.begin} to ${fy.end}; ${f} – ${t} is outside it.`,
      );
    }
    return {
      companyId: q.companyId,
      accYear: q.accYear,
      branchId: q.branchId ?? null,
      from: f,
      to: t,
      sessionId: q.sessionId ?? null,
    };
  }
}

function toRow(r: RawRow): TenderBookRow {
  const amount = money(dec(r.amount));
  return {
    voucherDate: r.voucher_date,
    voucherId: r.voucher_id,
    accYear: r.acc_year,
    voucherNo: r.refno,
    voucherTypeId: r.voucher_type_id,
    voucherTypeCode: r.voucher_type_code,
    branchId: r.branch_id,
    sessionId: r.session_id,
    partyId: r.party_id,
    partyName: r.party_name,
    ledgerId: r.ledger_id,
    ledgerName: r.ledger_name,
    ledgerType: r.ledger_type,
    tenderId: r.tender_id,
    tenderName: r.tender_name,
    tenderTypeId: r.tender_type_id,
    tenderTypeName: r.tender_type_name,
    isMirror: r.is_mirror,
    debit: r.side === 'DR' ? amount : '0.00',
    credit: r.side === 'CR' ? amount : '0.00',
  };
}

function refuse(code: string, field: string, message: string): never {
  throwAccountsBadRequest('Invalid report request', [{ field, message, code } as never]);
}

function dec(v: Dec | number | string | null | undefined): Dec {
  return new Prisma.Decimal(v ?? 0);
}

function money(v: Dec): string {
  return v.toFixed(2);
}

function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
