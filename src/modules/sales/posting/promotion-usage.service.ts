import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SALES_ERROR_CODES } from './types/posting.types';
import { throwSalesRefused } from './sales.errors';
import type {
  PromotionApplied,
  PromotionCapReport,
  PromotionUsageDoc,
} from './types/promotion.types';

/**
 * §3.5 — the campaign's own tally, and the caps it makes checkable.
 *
 * ── Why this table exists at all ───────────────────────────────────────────
 *
 * A single shop enforcing "one per customer" or a ₹2 lakh campaign budget can
 * count from `sale_bill_item`, because every bill it ever raised is on its own
 * database. **A CHAIN CANNOT.** The bill that spent the last of the budget may
 * have been raised offline at another branch an hour ago and may not have
 * synced yet. The counter has to be ACCUMULATED, not derived — which is the
 * whole reason `promotion_usage` is a table and not a query.
 *
 * It is NOT a second copy of the discount. The authoritative per-line figures
 * stay on `sbi_sch_disc_*` / `sbi_bill_sch_*`, where the printed bill reads
 * them. This is one row per document per scheme: what the campaign gave.
 *
 * ── Caps are ADVISORY at the till and authoritative here ───────────────────
 *
 * `prm_max_uses_total`, `prm_max_uses_per_cust` and `prm_budget_amount` cannot
 * be enforced by a counter that cannot see the other branches. It warns; the
 * server decides after sync. Same rule as accounts posting.
 *
 * ── A cancel writes a REVERSAL ROW, never a delete ─────────────────────────
 *
 * The campaign's history stays auditable and the running total stays a SUM,
 * which is safe to compute concurrently at any branch. `ck_pru_sign` makes a
 * reversal's figures negative and `ux_pru_doc_scheme` — (doc, scheme,
 * is_reversal, year) — allows exactly one of each direction.
 */
@Injectable()
export class PromotionUsageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record what each applied scheme gave on this document.
   *
   * Idempotent on `ux_pru_doc_scheme`, so a re-post of the same bill collides
   * rather than double-counting a campaign — and an offline till that pushes
   * twice is the ordinary case, not the exception.
   */
  async record(
    tx: Prisma.TransactionClient,
    doc: PromotionUsageDoc,
    applied: PromotionApplied[],
  ): Promise<number> {
    // ck_pru_gave_something: a usage row that gave nothing is not an event.
    const rows = applied.filter((a) => a.benefitAmt !== 0 || a.freeQty !== 0);
    if (rows.length === 0) {
      return 0;
    }

    const values = rows.map(
      (a) => Prisma.sql`(
        ${doc.accYear}::char(9), ${doc.companyId}::uuid, ${doc.branchId ?? null}::uuid,
        ${a.schemeId}::uuid, ${doc.custId ?? null}::uuid,
        ${a.schemeCode ?? null}, ${a.schemeName ?? null}, ${a.benefit ?? null},
        ${doc.srcModule ?? 'SALES'}, ${doc.docType}, ${doc.docId}::uuid,
        ${doc.accYear}::char(9), ${doc.docRefno ?? null}, ${doc.docDate}::date,
        ${money(a.baseAmount)}::numeric, ${money(a.baseQty, 4)}::numeric,
        ${money(Math.abs(a.benefitAmt))}::numeric, ${money(Math.abs(a.freeQty), 4)}::numeric,
        ${a.lineCount}::int, ${a.couponId ?? null}::uuid,
        false, ${doc.userId ?? null}::uuid, ${doc.deviceId ?? null}::uuid,
        ${a.remarks ?? null}, ${doc.createdBy ?? 'SYSTEM'}
      )`,
    );

    const written = await tx.$executeRaw`
      INSERT INTO sales.promotion_usage (
        pru_acc_year, pru_comp_id, pru_branch_id,
        pru_prm_id, pru_cust_id,
        pru_scheme_code, pru_scheme_name, pru_benefit,
        pru_src_module, pru_src_doc_type, pru_src_doc_id,
        pru_src_acc_year, pru_src_doc_refno, pru_doc_date,
        pru_base_amount, pru_base_qty,
        pru_benefit_amt, pru_free_qty,
        pru_line_count, pru_coupon_id,
        pru_is_reversal, pru_user_id, pru_device_id,
        pru_remarks, pru_created_by
      )
      VALUES ${Prisma.join(values)}
      -- A re-push of the same document is the ordinary case offline, and it
      -- must be a no-op rather than a second tally against the campaign.
      ON CONFLICT DO NOTHING`;

    return written;
  }

  /**
   * Cancel or return: write the mirror row, never delete the original.
   *
   * `ck_pru_sign` requires a reversal's figures to be NEGATIVE, so the running
   * total nets out as a plain SUM with no special case at any reader.
   */
  async reverse(
    tx: Prisma.TransactionClient,
    doc: { docId: string; accYear: string },
    reason: string,
    createdBy = 'SYSTEM',
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO sales.promotion_usage (
        pru_acc_year, pru_comp_id, pru_branch_id,
        pru_prm_id, pru_cust_id,
        pru_scheme_code, pru_scheme_name, pru_benefit,
        pru_src_module, pru_src_doc_type, pru_src_doc_id,
        pru_src_acc_year, pru_src_doc_refno, pru_doc_date,
        pru_base_amount, pru_base_qty,
        pru_benefit_amt, pru_free_qty,
        pru_line_count, pru_coupon_id,
        pru_is_reversal, pru_reversal_of_id, pru_reversal_of_acc_year,
        pru_reversal_reason, pru_user_id, pru_device_id, pru_created_by
      )
      SELECT o.pru_acc_year, o.pru_comp_id, o.pru_branch_id,
             o.pru_prm_id, o.pru_cust_id,
             o.pru_scheme_code, o.pru_scheme_name, o.pru_benefit,
             o.pru_src_module, o.pru_src_doc_type, o.pru_src_doc_id,
             o.pru_src_acc_year, o.pru_src_doc_refno, o.pru_doc_date,
             o.pru_base_amount, o.pru_base_qty,
             -o.pru_benefit_amt, -o.pru_free_qty,
             o.pru_line_count, o.pru_coupon_id,
             true, o.pru_id, o.pru_acc_year,
             ${reason}, o.pru_user_id, o.pru_device_id, ${createdBy}
        FROM sales.promotion_usage o
       WHERE o.pru_src_doc_id = ${doc.docId}::uuid
         AND o.pru_acc_year   = ${doc.accYear}::char(9)
         AND o.pru_is_reversal = false
         AND o.pru_is_deleted  = false
      ON CONFLICT DO NOTHING`;
  }

  /**
   * The client applied these schemes; the server does not trust that.
   *
   * Each must still be live for the date, the branch, the party and the bill
   * type, or the post is refused with `SALES_PROMO_NOT_LIVE`. A scheme can be
   * suspended between the moment the till cached it and the moment the bill
   * reaches the server — that is not a rare case for a counter that has been
   * offline since morning.
   */
  async validateApplied(
    tx: Prisma.TransactionClient,
    doc: PromotionUsageDoc,
    schemeIds: string[],
    opts: { throwOnFirst?: boolean } = {},
  ): Promise<{ code: string; message: string; schemeId: string }[]> {
    const ids = [...new Set(schemeIds)].filter(Boolean);
    if (ids.length === 0) {
      return [];
    }

    const live = await tx.$queryRaw<{ prm_id: string }[]>`
      SELECT s.prm_id
        FROM sales.promotion_scheme s
       WHERE s.prm_id = ANY(${ids}::uuid[])
         AND s.prm_comp_id    = ${doc.companyId}::uuid
         AND s.prm_is_deleted = false
         AND s.prm_is_active  = true
         AND s.prm_status     = 'APPROVED'
         AND (s.prm_start_date IS NULL OR s.prm_start_date <= ${doc.docDate}::date)
         AND (s.prm_end_date   IS NULL OR s.prm_end_date   >= ${doc.docDate}::date)
         AND (s.prm_bill_type = 'ALL' OR s.prm_bill_type = ${doc.billType ?? 'ALL'})
         AND (s.prm_branch_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.promotion_scheme_branch b
                WHERE b.prb_prm_id     = s.prm_id
                  AND b.prb_branch_id  = ${doc.branchId ?? null}::uuid
                  AND b.prb_is_exclude = false
                  AND b.prb_is_deleted = false))
         AND NOT EXISTS (
               SELECT 1 FROM sales.promotion_scheme_branch b
                WHERE b.prb_prm_id     = s.prm_id
                  AND b.prb_branch_id  = ${doc.branchId ?? null}::uuid
                  AND b.prb_is_exclude = true
                  AND b.prb_is_deleted = false)
         AND (s.prm_cust_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.promotion_scheme_party p
                WHERE p.prp_prm_id     = s.prm_id
                  AND p.prp_is_exclude = false
                  AND p.prp_is_deleted = false
                  AND (p.prp_cust_id = ${doc.custId ?? null}::uuid
                    OR p.prp_cust_group_id = ${doc.custGroupId ?? null}::uuid)))
         AND NOT EXISTS (
               SELECT 1 FROM sales.promotion_scheme_party p
                WHERE p.prp_prm_id     = s.prm_id
                  AND p.prp_is_exclude = true
                  AND p.prp_is_deleted = false
                  AND (p.prp_cust_id = ${doc.custId ?? null}::uuid
                    OR p.prp_cust_group_id = ${doc.custGroupId ?? null}::uuid))`;

    const liveIds = new Set(live.map((r) => r.prm_id));
    const dead = ids.filter((id) => !liveIds.has(id));

    if (dead.length > 0 && opts.throwOnFirst !== false) {
      throwSalesRefused(
        `Scheme ${dead[0]} is not live for this document`,
        SALES_ERROR_CODES.PROMO_NOT_LIVE,
        'schemeId',
      );
    }

    return dead.map((schemeId) => ({
      code: SALES_ERROR_CODES.PROMO_NOT_LIVE,
      message: `Scheme ${schemeId} is not live for this document`,
      schemeId,
    }));
  }

  /**
   * What the campaign has given so far, chain-wide — the three caps.
   *
   * The reversal rows are negative, so every figure here is a plain SUM and
   * needs no special case. `report` is what a guard turns into a WARN offline
   * and a refusal on the server.
   */
  async caps(
    tx: Prisma.TransactionClient,
    schemeId: string,
    custId: string | null,
  ): Promise<PromotionCapReport> {
    const [scheme] = await tx.$queryRaw<
      {
        prm_max_uses_total: number;
        prm_max_uses_per_cust: number;
        prm_budget_amount: Prisma.Decimal;
      }[]
    >`
      SELECT prm_max_uses_total, prm_max_uses_per_cust, prm_budget_amount
        FROM sales.promotion_scheme WHERE prm_id = ${schemeId}::uuid`;

    const [used] = await tx.$queryRaw<
      { uses: bigint; cust_uses: bigint; given: Prisma.Decimal | null }[]
    >`
      SELECT COUNT(*) FILTER (WHERE pru_is_reversal = false)                      AS uses,
             COUNT(*) FILTER (WHERE pru_is_reversal = false
                                AND pru_cust_id = ${custId}::uuid)                AS cust_uses,
             SUM(pru_benefit_amt)                                                 AS given
        FROM sales.promotion_usage
       WHERE pru_prm_id    = ${schemeId}::uuid
         AND pru_is_deleted = false`;

    const maxUses = scheme?.prm_max_uses_total ?? 0;
    const maxPerCust = scheme?.prm_max_uses_per_cust ?? 0;
    const budget = Number(scheme?.prm_budget_amount ?? 0);

    return {
      schemeId,
      uses: Number(used?.uses ?? 0),
      custUses: Number(used?.cust_uses ?? 0),
      given: Number(used?.given ?? 0),
      maxUses,
      maxPerCust,
      budget,
      // A zero cap means "no cap", which is what the DEFAULT 0 columns mean.
      usesExceeded: maxUses > 0 && Number(used?.uses ?? 0) >= maxUses,
      custUsesExceeded: maxPerCust > 0 && Number(used?.cust_uses ?? 0) >= maxPerCust,
      budgetExceeded: budget > 0 && Number(used?.given ?? 0) >= budget,
    };
  }
}

function money(value: number, decimals = 2): string {
  const f = Math.pow(10, decimals);
  return (Math.round(value * f) / f).toFixed(decimals);
}
