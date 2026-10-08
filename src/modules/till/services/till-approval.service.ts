import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { TillApprovalNeed } from '../types/till-api.types';

type Client = Prisma.TransactionClient | PrismaService;

/**
 * The approval rules (share file 47 §1.6, `till_approval_rule`), READ ONLY.
 *
 * Phase 3 grows this into the gate (rule × authority × PIN, the inbox, the
 * expiry sweep). Until then a money document asks it only what a rule WOULD
 * ask — plan-till-receipt-payment-expense §3.3 (CASH_PAYMENT) and §4.3
 * (EXPENSE) — and reports the answer; nothing is refused (`enforced: false`).
 *
 * Resolution, as TillApprovalRule.prisma states it: a branch row beats a
 * company row beats the shipped row (both NULL), then the latest
 * `tar_effective_from` on or before the business date. One row.
 */
@Injectable()
export class TillApprovalService {
  async ruleFor(
    client: Client,
    scope: { companyId: string; branchId: string; event: string; onDate: string },
  ) {
    const [row] = await client.$queryRaw<
      {
        tar_id: string;
        tar_event_code: string;
        tar_mode: string;
        tar_threshold_amount: Prisma.Decimal;
        tar_channel: string;
        tar_min_role: string;
        tar_two_person: boolean;
        tar_blocks_till: boolean;
      }[]
    >`
      SELECT tar_id, tar_event_code, tar_mode, tar_threshold_amount, tar_channel, tar_min_role,
             tar_two_person, tar_blocks_till
        FROM accounts.till_approval_rule
       WHERE tar_event_code = ${scope.event}
         AND tar_is_active AND NOT tar_is_deleted
         AND (tar_company_id IS NULL OR tar_company_id = ${scope.companyId}::uuid)
         AND (tar_branch_id  IS NULL OR tar_branch_id  = ${scope.branchId}::uuid)
         AND tar_effective_from <= ${scope.onDate}::date
       ORDER BY (tar_branch_id IS NOT NULL) DESC,
                (tar_company_id IS NOT NULL) DESC,
                tar_effective_from DESC
       LIMIT 1`;
    return row ?? null;
  }

  /**
   * Would `amount` need an approval under the event's rule? NEVER → no;
   * ALWAYS → yes; OVER_AMOUNT → above the threshold. OVER_COUNT and
   * OVER_PERCENT are per-session / per-figure rules no money document trips,
   * so they answer no here.
   */
  async assess(
    client: Client,
    scope: {
      companyId: string;
      branchId: string;
      event: string;
      onDate: string;
      amount: Prisma.Decimal;
    },
  ): Promise<TillApprovalNeed | null> {
    const rule = await this.ruleFor(client, scope);
    if (!rule) {
      return null;
    }
    const threshold = new Prisma.Decimal(rule.tar_threshold_amount);
    const needed =
      rule.tar_mode === 'ALWAYS' ||
      (rule.tar_mode === 'OVER_AMOUNT' && scope.amount.greaterThan(threshold));
    if (!needed) {
      return null;
    }
    return {
      event: rule.tar_event_code,
      ruleId: rule.tar_id,
      mode: rule.tar_mode,
      threshold: Number(threshold.toFixed(2)),
      amount: Number(scope.amount.toFixed(2)),
      minRole: rule.tar_min_role,
      channel: rule.tar_channel,
      twoPerson: rule.tar_two_person,
      blocksTill: rule.tar_blocks_till,
      enforced: false,
    };
  }
}
