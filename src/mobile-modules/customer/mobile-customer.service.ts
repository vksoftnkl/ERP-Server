import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PARTY_GST_TYPES } from '../../common/party/party-gst-type';
import {
  countedLegsSql,
  money,
  openingSetSql,
  sided,
  type BooksScope,
  type LedgerFilter,
} from '../../modules/reports/common/voucher-books.sql';
import {
  DEFAULT_BUCKETS,
  istToday,
} from '../../modules/reports/party-outstanding/party-outstanding.ageing';
import {
  partiesWith,
  type SqlScope,
} from '../../modules/reports/party-outstanding/party-outstanding.sql';
import { CustomerService } from '../../modules/sales/customer/customer.service';
import {
  ListMobileCustomersQueryDto,
  MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE,
} from './dto/mobile-customer.dto';
import type {
  MobileCustomerBalance,
  MobileCustomerBalanceStatus,
  MobileCustomerDetail,
  MobileCustomerOutstanding,
  MobileCustomerFilter,
  MobileCustomerFormOptions,
  MobileCustomerListItem,
  MobileCustomerListPayload,
} from './types/mobile-customer-api.types';

/** The books a balance is read from: the login company, the year holding today, all branches. */
export interface MobileBalanceScope extends BooksScope {
  asOn: string;
}

type Num = Prisma.Decimal | string | number;

interface ListRow {
  n_all: number;
  n_outstanding: number;
  n_unregistered: number;
  n_inactive: number;
  n_filtered: number;
  // Page columns: all null on the one row a page past the end still returns.
  cus_id: string | null;
  cus_name: string | null;
  cus_short: string | null;
  cus_code: string | null;
  cus_city: string | null;
  area_name: string | null;
  cus_phone1: string | null;
  cus_whatsapp_no: string | null;
  cus_gst_no: string | null;
  cus_gst_type: string | null;
  cus_is_active: boolean | null;
  cus_credit_amt_limit: Num | null;
  bal: Num | null;
  owed: Num | null;
  owed_bills: number | null;
  oldest_date: string | null;
}

interface OutstandingRow {
  owed: Num | null;
  owed_bills: number | null;
  oldest_date: string | null;
}

/** ILIKE's own wildcards and its escape character, taken literally. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/**
 * The search box: name, short name, code, city, GSTIN, phones. A term made of
 * digits, spaces and + - ( ) also matches the phone columns with their own
 * punctuation stripped, so "98431 23456" finds "9843123456" and back.
 */
export function searchSql(raw: string | undefined): Prisma.Sql {
  const term = raw?.trim();
  if (!term) {
    return Prisma.empty;
  }
  const like = `%${escapeLike(term)}%`;
  const digits = term.replace(/\D/g, '');
  const phoneLike = /^[\d\s+\-()]+$/.test(term) && digits.length >= 3 ? `%${digits}%` : null;
  const phoneDigits = phoneLike
    ? Prisma.sql`
        OR regexp_replace(COALESCE(c.cus_phone1, ''),      '[^0-9]', '', 'g') LIKE ${phoneLike}
        OR regexp_replace(COALESCE(c.cus_phone2, ''),      '[^0-9]', '', 'g') LIKE ${phoneLike}
        OR regexp_replace(COALESCE(c.cus_whatsapp_no, ''), '[^0-9]', '', 'g') LIKE ${phoneLike}
        OR regexp_replace(COALESCE(c.cus_tel, ''),         '[^0-9]', '', 'g') LIKE ${phoneLike}`
    : Prisma.empty;
  return Prisma.sql`
     AND (c.cus_name ILIKE ${like}
       OR c.cus_short ILIKE ${like}
       OR c.cus_code ILIKE ${like}
       OR c.cus_city ILIKE ${like}
       OR c.cus_gst_no ILIKE ${like}
       OR c.cus_phone1 ILIKE ${like}
       OR c.cus_phone2 ILIKE ${like}
       OR c.cus_whatsapp_no ILIKE ${like}
       OR c.cus_tel ILIKE ${like}
       ${phoneDigits})`;
}

/** The chip, over the `base` CTE of the list query. */
export function filterSql(filter: MobileCustomerFilter): Prisma.Sql {
  switch (filter) {
    case 'OUTSTANDING':
      return Prisma.sql`b.bal > 0`;
    case 'UNREGISTERED':
      return Prisma.sql`b.is_unregistered`;
    case 'INACTIVE':
      return Prisma.sql`NOT b.cus_is_active`;
    default:
      return Prisma.sql`true`;
  }
}

/**
 * Per ledger: the closing on `asOn` = this year's opening set + the counted
 * legs up to `asOn`. The same two fragments as the Ledger Statement and the
 * Party Outstanding card, so the phone shows the figure the desktop shows.
 */
export function balancesSql(scope: MobileBalanceScope | null, ledgers: LedgerFilter): Prisma.Sql {
  if (!scope) {
    return Prisma.sql`SELECT NULL::uuid AS ledger_id, NULL::numeric AS bal WHERE false`;
  }
  return Prisma.sql`
      SELECT x.ledger_id, SUM(x.amt) AS bal
        FROM (SELECT o.ledger_id, o.amt
                FROM (${openingSetSql(scope, ledgers)}) o
              UNION ALL
              SELECT l.av_ledger_id, l.av_signed_amount
                FROM (${countedLegsSql(scope, { upTo: scope.asOn, ledgers })}) l) x
       GROUP BY x.ledger_id`;
}

/**
 * The Party Outstanding report's scope for the login company's receivables on
 * `asOn`, as its party card reads them: no group, area, salesman or
 * collection-day filter, all branches, on-account kept apart (it never lowers
 * "owed"), PDC in hand not deducted. `partyId` = one customer; null = all.
 */
export function outstandingScope(
  scope: MobileBalanceScope,
  partyId: string | null,
  today: string = istToday(),
): SqlScope {
  return {
    companyId: scope.companyId,
    asOn: scope.asOn,
    today,
    fyName: scope.accYear,
    branchId: null,
    side: 'RECEIVABLE',
    owedSide: 'DR',
    traType: 'R',
    group: null,
    areaId: null,
    salesmanId: null,
    collectionDay: null,
    partyId,
    ageBy: 'BILL_DATE',
    edges: [...DEFAULT_BUCKETS],
    includeOnAccount: true,
    onlyOverdue: false,
    minDueDays: null,
    maxDueDays: null,
    deductPdc: false,
    hideZero: true,
  };
}

/**
 * Per party with anything open: owed (Σ pending of its DR bills on asOn), how
 * many such bills, and the oldest one's bill date. Read through the report's
 * own CTEs (partiesWith), not a copy, so the phone shows the figure the
 * desktop and web Party Outstanding screens show. A party with nothing open
 * has no row (read it as 0).
 */
export function outstandingSql(
  scope: MobileBalanceScope | null,
  partyId: string | null,
): Prisma.Sql {
  if (!scope) {
    return Prisma.sql`SELECT NULL::uuid AS party_id, NULL::numeric AS owed, NULL::int AS owed_bills,
                             NULL::date AS oldest_date WHERE false`;
  }
  const s = outstandingScope(scope, partyId);
  return Prisma.sql`${partiesWith(s)}
      SELECT pf.party_id, pf.owed, pf.bills::int AS owed_bills,
             CASE WHEN pf.bills > 0 THEN ${s.asOn}::date - pf.oldest::int END AS oldest_date
        FROM pf`;
}

function outstandingOf(r: OutstandingRow | null, read: boolean): MobileCustomerOutstanding {
  if (!read) {
    return { outstanding: null, outstandingBills: null, oldestBillDate: null };
  }
  return {
    outstanding: money(r?.owed ?? 0),
    outstandingBills: r?.owed_bills ?? 0,
    oldestBillDate: r?.oldest_date ?? null,
  };
}

export function balanceStatusOf(
  bal: Num | null,
  creditAmtLimit: Num | null,
): MobileCustomerBalanceStatus | null {
  if (bal === null) {
    return null;
  }
  const amount = new Prisma.Decimal(bal);
  if (amount.gt(0)) {
    const limit = new Prisma.Decimal(creditAmtLimit ?? 0);
    return limit.gt(0) && amount.gt(limit) ? 'OVER_LIMIT' : 'OUTSTANDING';
  }
  return amount.lt(0) ? 'ADVANCE' : 'SETTLED';
}

function balanceOf(bal: Num | null, creditAmtLimit: Num | null): MobileCustomerBalance {
  return {
    balance: bal === null ? null : sided(bal),
    balanceStatus: balanceStatusOf(bal, creditAmtLimit),
  };
}

/**
 * The phone's reads of the Customer master. Writes are not here: the
 * controller sends them to the desktop CustomerService, so the linked ledger,
 * party rules, audit and rights stay in one place.
 */
@Injectable()
export class MobileCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
    private readonly customerService: CustomerService,
  ) {}

  async list(q: ListMobileCustomersQueryDto): Promise<MobileCustomerListPayload> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE;
    const filter = q.filter ?? 'ALL';
    return this.prisma.$transaction(async (tx) => {
      // The `$x IS NULL OR …` predicates of the shared fragments go generic (and
      // slow) after a few runs of one prepared statement.
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      const scope = await this.balanceScope(tx);
      const rows = await tx.$queryRaw<ListRow[]>`
        WITH bal AS MATERIALIZED (${balancesSql(scope, null)}),
        os AS MATERIALIZED (${outstandingSql(scope, null)}),
        base AS MATERIALIZED (
          SELECT c.cus_id, c.cus_name, c.cus_short, c.cus_code, c.cus_city,
                 a.arm_name AS area_name, c.cus_phone1, c.cus_whatsapp_no,
                 c.cus_gst_no, c.cus_gst_type, c.cus_is_active, c.cus_credit_amt_limit,
                 CASE WHEN ${scope !== null}::boolean THEN COALESCE(lb.bal, 0) END AS bal,
                 o.owed, o.owed_bills, o.oldest_date::text AS oldest_date,
                 upper(COALESCE(btrim(c.cus_gst_type), '')) IN ('UNREGISTERED', '') AS is_unregistered
            FROM sales.customers c
            LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
            LEFT JOIN bal lb ON lb.ledger_id = c.cus_id
            LEFT JOIN os o ON o.party_id = c.cus_id
           WHERE c.cus_is_deleted = false
           ${searchSql(q.search)}
        ),
        counts AS (
          SELECT count(*)::int                                  AS n_all,
                 count(*) FILTER (WHERE b.bal > 0)::int         AS n_outstanding,
                 count(*) FILTER (WHERE b.is_unregistered)::int AS n_unregistered,
                 count(*) FILTER (WHERE NOT b.cus_is_active)::int AS n_inactive,
                 count(*) FILTER (WHERE ${filterSql(filter)})::int AS n_filtered
            FROM base b
        ),
        page AS (
          SELECT b.* FROM base b
           WHERE ${filterSql(filter)}
           ORDER BY lower(b.cus_name) NULLS LAST, b.cus_id
           LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        )
        SELECT k.n_all, k.n_outstanding, k.n_unregistered, k.n_inactive, k.n_filtered,
               p.cus_id, p.cus_name, p.cus_short, p.cus_code, p.cus_city, p.area_name,
               p.cus_phone1, p.cus_whatsapp_no, p.cus_gst_no, p.cus_gst_type,
               p.cus_is_active, p.cus_credit_amt_limit, p.bal,
               p.owed, p.owed_bills, p.oldest_date
          FROM counts k
          LEFT JOIN page p ON true
         ORDER BY lower(p.cus_name) NULLS LAST, p.cus_id`;
      const head = rows[0];
      const items = rows.filter((r) => r.cus_id !== null).map((r) => this.toListItem(r));
      const total = head?.n_filtered ?? 0;
      return {
        items,
        counts: {
          all: head?.n_all ?? 0,
          outstanding: head?.n_outstanding ?? 0,
          unregistered: head?.n_unregistered ?? 0,
          inactive: head?.n_inactive ?? 0,
        },
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
        balanceAsOn: scope?.asOn ?? null,
        accYear: scope?.accYear ?? null,
        companyId: scope?.companyId ?? null,
      };
    });
  }

  /** The desktop GET /customers/get payload (404 CUSTOMER_NOT_FOUND) plus the balance and outstanding. */
  async getById(cusId: string): Promise<MobileCustomerDetail> {
    const customer = await this.customerService.getById(cusId);
    const figures = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      const scope = await this.balanceScope(tx);
      if (!scope) {
        return { ...balanceOf(null, null), ...outstandingOf(null, false) };
      }
      const [row] = await tx.$queryRaw<{ bal: Num | null }[]>`
        SELECT b.bal FROM (${balancesSql(scope, { ledgerId: cusId })}) b`;
      const [open] = await tx.$queryRaw<OutstandingRow[]>`
        SELECT o.owed, o.owed_bills, o.oldest_date::text AS oldest_date
          FROM (${outstandingSql(scope, cusId)}) o`;
      return {
        ...balanceOf(row?.bal ?? 0, customer.cusCreditAmtLimit),
        ...outstandingOf(open ?? null, true),
      };
    });
    return { ...customer, ...figures };
  }

  /** Everything the entry form picks from, in one call: live and active rows only. */
  async formOptions(): Promise<MobileCustomerFormOptions> {
    const [areas, groups, priceLevels, states] = await Promise.all([
      this.prisma.areaMaster.findMany({
        where: { armIsDeleted: false, armIsActive: true },
        select: {
          armId: true,
          armName: true,
          armCityId: true,
          city: { select: { ctmName: true } },
        },
        orderBy: [{ armSort: 'asc' }, { armName: 'asc' }],
      }),
      this.prisma.custGroup.findMany({
        where: { cgrIsDeleted: false, cgrIsActive: true },
        select: { cgrId: true, cgrName: true },
        orderBy: [{ cgrOrder: 'asc' }, { cgrName: 'asc' }],
      }),
      this.prisma.itemPriceLevel.findMany({
        where: { iplIsDeleted: false, iplStatus: true },
        select: { iplId: true, iplName: true },
        orderBy: { iplId: 'asc' },
      }),
      this.prisma.stateCode.findMany({
        where: { isDeleted: false, isActive: true },
        select: { stateCode: true, stateName: true },
        orderBy: { stateName: 'asc' },
      }),
    ]);
    return {
      areas: areas.map((a) => ({
        id: a.armId,
        name: a.armName,
        // arm_city_id (NOT NULL): the phone's offer engine matches CITY scheme rows
        // through the customer's beat, as the desktop rules do (since 2026-11-19).
        cityId: a.armCityId,
        cityName: a.city?.ctmName ?? null,
      })),
      groups: groups.map((g) => ({ id: g.cgrId, name: g.cgrName })),
      priceLevels: priceLevels.map((p) => ({ id: p.iplId, name: p.iplName })),
      states: states.map((s) => ({ code: s.stateCode, name: s.stateName })),
      gstTypes: PARTY_GST_TYPES,
    };
  }

  /**
   * The login's company and the financial year holding today (database date,
   * IST). null = no balance can be read: the row shows none rather than a
   * wrong 0.
   */
  private async balanceScope(tx: Prisma.TransactionClient): Promise<MobileBalanceScope | null> {
    const companyId = this.requestContextService.getCompanyId();
    if (!companyId) {
      return null;
    }
    const [fy] = await tx.$queryRaw<{ name: string; today: string }[]>`
      SELECT btrim(fy_year_name) AS name, CURRENT_DATE::text AS today
        FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND CURRENT_DATE BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC
       LIMIT 1`;
    return fy ? { companyId, accYear: fy.name, branchId: null, asOn: fy.today } : null;
  }

  private toListItem(r: ListRow): MobileCustomerListItem {
    return {
      cusId: r.cus_id as string,
      cusName: r.cus_name,
      cusShort: r.cus_short,
      cusCode: r.cus_code,
      cusCity: r.cus_city,
      cusAreaName: r.area_name,
      cusPhone1: r.cus_phone1,
      cusWhatsappNo: r.cus_whatsapp_no,
      cusGstNo: r.cus_gst_no,
      cusGstType: r.cus_gst_type,
      cusIsActive: r.cus_is_active ?? false,
      cusCreditAmtLimit: money(r.cus_credit_amt_limit),
      ...balanceOf(r.bal, r.cus_credit_amt_limit),
      // bal is null exactly when no balance scope could be read: outstanding is then null too.
      ...outstandingOf(r, r.bal !== null),
    };
  }
}
