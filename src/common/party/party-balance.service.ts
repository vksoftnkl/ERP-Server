import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { wordingFor, type UserWording } from '../error-wording/error-wording';
import {
  countedLegsSql,
  openingSetSql,
} from 'src/modules/reports/common/voucher-books.sql';
import type { PartyRole } from './party-detail.map';

type PartyClient = Prisma.TransactionClient;

/** Lifetime balance of one ledger in one company; + = DR, − = CR. Never zero in a list. */
export interface PartyCompanyBalance {
  companyId: string;
  companyName: string | null;
  amount: Prisma.Decimal;
}

/** `GET /customers/delete-check` · `GET /suppliers/delete-check` → data. */
export interface PartyDeleteCheck {
  partyId: string;
  role: PartyRole;
  /** The other role (supplier for a customer, and back) is live on the same ledger. */
  otherRoleLive: boolean;
  /** No other role is live: the delete soft-deletes the ledger too. */
  ledgerWouldBeDeleted: boolean;
  canDelete: boolean;
  /** The code DELETE would refuse with, or null. */
  refusalCode: string | null;
  /** Each company whose balance is not 0 (empty when every company is 0). */
  balances: { companyId: string; companyName: string | null; amount: string; drCr: 'DR' | 'CR' }[];
  warnings: { draftDocs: number; openBills: number; chequesInHand: number };
  /** The refusal as DELETE would send it (field, code, message, user with real figures). */
  refusals: PartyRefusal[];
}

export interface PartyRefusal {
  field: string;
  code: string;
  message: string;
  user?: UserWording;
}

/** The codes each master refuses a delete with. */
export interface PartyDeleteCodes {
  hasBalance: string;
  hasChequeInHand: string;
}

const FAR_FUTURE = '9999-12-31';
const ROLE_WORD: Record<PartyRole, string> = { CUSTOMER: 'customer', SUPPLIER: 'supplier' };

/**
 * Party master rules D1 (plan §3.1). The books' own balance of a party ledger, every
 * year and every company, the delete guard, and the "has books" test of the company
 * rule (Q7 = a).
 *
 * The sum is the Ledger Statement's — reports/common/voucher-books.sql.ts
 * countedLegsSql + openingSetSql, POSTED + CANCELLED legs, DRAFT never — per
 * (company, year). This file adds only the walk across the years: a year whose opening
 * set exists and is not stale replaces the carried figure (that is what a carry-forward
 * is); otherwise last year's closing carries over. Exact Decimal, no epsilon.
 */
@Injectable()
export class PartyBalanceService {
  /**
   * SELECT … FOR UPDATE on the ledger row: a save of the customer and a save of the
   * supplier of one party, or a delete and a bill post, run one after the other.
   * Returns the ledger's company (null = shared, undefined = no ledger row).
   */
  async lockLedger(
    tx: PartyClient,
    ledId: string,
  ): Promise<{ ledCompanyId: string | null; ledIsDeleted: boolean } | undefined> {
    const rows = await tx.$queryRaw<{ led_company_id: string | null; led_is_deleted: boolean }[]>`
      SELECT led_company_id, led_is_deleted
        FROM accounts.acc_ledger_master
       WHERE led_id = ${ledId}::uuid
       FOR UPDATE`;
    const row = rows[0];
    return row ? { ledCompanyId: row.led_company_id, ledIsDeleted: row.led_is_deleted } : undefined;
  }

  /** Every company with books for the ledger whose lifetime balance is not 0. */
  async balances(tx: PartyClient, ledId: string): Promise<PartyCompanyBalance[]> {
    // The `$x IS NULL OR …` predicates of the shared fragments go generic (and slow)
    // after a few runs of one prepared statement; call this inside a transaction.
    await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
    const pairs = await tx.$queryRaw<{ company_id: string; acc_year: string }[]>`
      SELECT av_company_id AS company_id, av_acc_year::text AS acc_year
        FROM accounts.acc_vouchers
       WHERE av_ledger_id = ${ledId}::uuid AND av_is_deleted = false AND av_company_id IS NOT NULL
      UNION
      SELECT op_company_id, op_acc_year::text
        FROM accounts.acc_opening_balance
       WHERE op_ledger_id = ${ledId}::uuid AND op_is_deleted = false AND op_company_id IS NOT NULL
       ORDER BY 1, 2`;
    const byCompany = new Map<string, string[]>();
    for (const p of pairs) {
      byCompany.set(p.company_id, [...(byCompany.get(p.company_id) ?? []), p.acc_year]);
    }
    const out: PartyCompanyBalance[] = [];
    for (const [companyId, years] of byCompany) {
      let running = new Prisma.Decimal(0);
      let first = true;
      for (const accYear of years.sort()) {
        const scope = { companyId, accYear, branchId: null };
        const ledgers = { ledgerId: ledId };
        const [row] = await tx.$queryRaw<
          { legs: Prisma.Decimal | null; opening: Prisma.Decimal | null; rows: number; stale: boolean }[]
        >`
          SELECT (SELECT COALESCE(SUM(l.av_signed_amount), 0)
                    FROM (${countedLegsSql(scope, { upTo: FAR_FUTURE, ledgers })}) l) AS legs,
                 (SELECT o.amt FROM (${openingSetSql(scope, ledgers)}) o)          AS opening,
                 (SELECT count(*)::int
                    FROM accounts.acc_opening_balance s
                   WHERE s.op_company_id = ${companyId}::uuid AND s.op_ledger_id = ${ledId}::uuid
                     AND s.op_acc_year = ${accYear}::char(9) AND s.op_is_deleted = false) AS rows,
                 COALESCE((SELECT bool_or(s.op_is_stale)
                    FROM accounts.acc_opening_balance s
                   WHERE s.op_company_id = ${companyId}::uuid AND s.op_ledger_id = ${ledId}::uuid
                     AND s.op_acc_year = ${accYear}::char(9) AND s.op_is_deleted = false), false) AS stale`;
        // The opening set replaces the carried figure when it is a live carry-forward,
        // or when it is the first year with books (nothing to carry from).
        if (row.rows > 0 && (!row.stale || first)) {
          running = new Prisma.Decimal(row.opening ?? 0);
        }
        running = running.plus(new Prisma.Decimal(row.legs ?? 0));
        first = false;
      }
      if (!running.isZero()) {
        out.push({ companyId, companyName: null, amount: running });
      }
    }
    if (out.length > 0) {
      const companies = await tx.company.findMany({
        where: { compId: { in: out.map((b) => b.companyId) } },
        select: { compId: true, compName: true },
      });
      const names = new Map(companies.map((c) => [c.compId, c.compName]));
      for (const b of out) {
        b.companyName = names.get(b.companyId) ?? null;
      }
    }
    return out;
  }

  /** Cheques for the party still in hand (HELD / DEPOSITED) that post only on clearing (Q3). */
  async chequesInHand(tx: PartyClient, ledId: string): Promise<number> {
    const [row] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
        FROM accounts.acc_pdc_register
       WHERE apd_party_id = ${ledId}::uuid
         AND apd_is_deleted = false
         AND apd_status IN ('HELD', 'DEPOSITED')
         AND apd_posting_mode = 'ON_CLEARING'`;
    return Number(row?.n ?? 0);
  }

  /** Unposted drafts naming the party, and its bills still open (warnings, not refusals). */
  async warnings(tx: PartyClient, ledId: string): Promise<{ draftDocs: number; openBills: number }> {
    const [row] = await tx.$queryRaw<{ drafts: number; open_bills: number }[]>`
      SELECT (
               (SELECT count(*) FROM sales.sale_bill      WHERE sb_cust_id  = ${ledId}::uuid AND sb_status  = 'DRAFT' AND sb_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_order     WHERE so_cust_id  = ${ledId}::uuid AND so_status  = 'DRAFT' AND so_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_quotation WHERE sq_cust_id  = ${ledId}::uuid AND sq_status  = 'DRAFT' AND sq_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_return    WHERE sr_cust_id  = ${ledId}::uuid AND sr_status  = 'DRAFT' AND sr_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_dc        WHERE sdc_cust_id = ${ledId}::uuid AND sdc_status = 'DRAFT' AND sdc_is_deleted = false)
             + (SELECT count(*) FROM accounts.acc_voucher_header WHERE avh_party_id = ${ledId}::uuid AND avh_voucher_status = 'DRAFT' AND avh_is_deleted = false)
             + (SELECT count(*) FROM purchase.pur_invoice WHERE pi_supplier_id  = ${ledId}::uuid AND pi_status  = 'DRAFT' AND pi_is_deleted  = false)
             + (SELECT count(*) FROM purchase.pur_order   WHERE po_supplier_id  = ${ledId}::uuid AND po_status  = 'DRAFT' AND po_is_deleted  = false)
             + (SELECT count(*) FROM purchase.pur_grn     WHERE grn_supplier_id = ${ledId}::uuid AND grn_status = 'DRAFT' AND grn_is_deleted = false)
             + (SELECT count(*) FROM purchase.pur_return  WHERE pr_supplier_id  = ${ledId}::uuid AND pr_status  = 'DRAFT' AND pr_is_deleted  = false)
             )::int AS drafts,
             (SELECT count(*)::int FROM accounts.acc_bill_balance
               WHERE abl_party_id = ${ledId}::uuid AND abl_is_deleted = false AND abl_pending_amount <> 0) AS open_bills`;
    return { draftDocs: Number(row?.drafts ?? 0), openBills: Number(row?.open_bills ?? 0) };
  }

  /**
   * Q7 = a — the company a party's books are in that a company change would strand,
   * or null when the change is free. From company C: any leg or opening row in C. From
   * shared (null): any in a company other than the new one.
   */
  async companyWithBooks(
    tx: PartyClient,
    ledId: string,
    currentCompanyId: string | null,
    nextCompanyId: string | null,
  ): Promise<{ companyId: string; companyName: string | null } | null> {
    if (currentCompanyId === nextCompanyId) {
      return null;
    }
    const rows = await tx.$queryRaw<{ company_id: string }[]>`
      SELECT company_id FROM (
        SELECT av_company_id AS company_id FROM accounts.acc_vouchers
         WHERE av_ledger_id = ${ledId}::uuid AND av_is_deleted = false
        UNION
        SELECT op_company_id FROM accounts.acc_opening_balance
         WHERE op_ledger_id = ${ledId}::uuid AND op_is_deleted = false
      ) b
      WHERE company_id IS NOT NULL
        AND CASE WHEN ${currentCompanyId}::uuid IS NOT NULL
                 THEN company_id = ${currentCompanyId}::uuid
                 ELSE company_id IS DISTINCT FROM ${nextCompanyId}::uuid END
      LIMIT 1`;
    const hit = rows[0];
    if (!hit) {
      return null;
    }
    const company = await tx.company.findFirst({
      where: { compId: hit.company_id },
      select: { compName: true },
    });
    return { companyId: hit.company_id, companyName: company?.compName ?? null };
  }

  /**
   * The delete guard (plan §3.1 delete flow, steps 2–3) as a question: what DELETE would
   * answer. With the other role live the ledger stays, its balance with it, so only the
   * role row goes (Q2): no balance or cheque refusal then.
   */
  async deleteCheck(
    tx: PartyClient,
    input: { partyId: string; role: PartyRole; otherRoleLive: boolean; codes: PartyDeleteCodes },
  ): Promise<PartyDeleteCheck> {
    const { partyId, role, otherRoleLive, codes } = input;
    const [balances, chequesInHand, warnings] = await Promise.all([
      otherRoleLive ? Promise.resolve([] as PartyCompanyBalance[]) : this.balances(tx, partyId),
      this.chequesInHand(tx, partyId),
      this.warnings(tx, partyId),
    ]);
    const refusals: PartyRefusal[] = [];
    if (!otherRoleLive && balances.length > 0) {
      const first = balances[0];
      const amount = formatRupees(first.amount.abs());
      const side = first.amount.isNegative() ? 'Cr' : 'Dr';
      const where = first.companyName ?? 'a company';
      refusals.push(
        withFigures(
          {
            field: role === 'CUSTOMER' ? 'cusId' : 'supId',
            code: codes.hasBalance,
            message: `The ${ROLE_WORD[role]}'s ledger balance is ${first.amount.abs().toFixed(2)} ${side.toUpperCase()} in company ${first.companyId}; a party is deleted only at a zero balance`,
          },
          `This ${ROLE_WORD[role]} still has ₹${amount} ${side} in ${where}.`,
        ),
      );
    }
    if (!otherRoleLive && chequesInHand > 0) {
      refusals.push(
        withFigures(
          {
            field: role === 'CUSTOMER' ? 'cusId' : 'supId',
            code: codes.hasChequeInHand,
            message: `${chequesInHand} cheque(s) of this party are HELD / DEPOSITED and post only on clearing`,
          },
          null,
        ),
      );
    }
    return {
      partyId,
      role,
      otherRoleLive,
      ledgerWouldBeDeleted: !otherRoleLive,
      canDelete: refusals.length === 0,
      refusalCode: refusals[0]?.code ?? null,
      balances: balances.map((b) => ({
        companyId: b.companyId,
        companyName: b.companyName,
        amount: b.amount.abs().toFixed(2),
        drCr: b.amount.isNegative() ? 'CR' : 'DR',
      })),
      warnings: { ...warnings, chequesInHand },
      refusals,
    };
  }
}

/**
 * The catalogue's words for `code` with the real figures in `line` (the user said yes
 * to "Balance ₹1,250.00 Dr in Acme"). The registry has no placeholders, so the block is
 * attached here; wordList() leaves an error that already carries `user` alone.
 */
export function withFigures(refusal: PartyRefusal, line: string | null): PartyRefusal {
  const words = wordingFor({ code: refusal.code, field: refusal.field });
  if (!words) {
    return refusal;
  }
  return { ...refusal, user: line ? { ...words, line } : words };
}

/** 1250 → "1,250.00" (Indian grouping: 1,25,000.00). */
export function formatRupees(value: Prisma.Decimal): string {
  const [whole, fraction] = value.toFixed(2).split('.');
  const negative = whole.startsWith('-');
  const digits = negative ? whole.slice(1) : whole;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '-' : ''}${grouped}.${fraction}`;
}
