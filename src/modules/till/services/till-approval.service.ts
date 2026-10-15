import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { verifySecret } from '../../../common/utils/secret-hash.utils';
import { UserType } from '../../settings/userAdministration/types/user-administration.enum';
import { throwTill } from '../till-errors';
import { approverRoleRank, TillErrorCode, type TillApproverRole } from '../types/till-enum';
import type { TillApprovalNeed } from '../types/till-api.types';

type Client = Prisma.TransactionClient | PrismaService;

/** One till_approval_rule row as ruleFor reads it; `tar_id` null = the built-in fallback. */
export interface TillApprovalRuleRow {
  tar_id: string | null;
  tar_event_code: string;
  tar_mode: string;
  tar_threshold_amount: Prisma.Decimal;
  tar_channel: string;
  tar_min_role: string;
  tar_two_person: boolean;
  tar_allow_self: boolean;
  tar_blocks_till: boolean;
}

/** Who wants to decide what (notes 105 A2). */
export interface ApproverAsk {
  companyId: string;
  branchId: string;
  /** ck_tar_event: CASH_VARIANCE, NONCASH_VARIANCE … */
  event: string;
  /** What is being approved: Σ|counted − expected| for a variance. */
  amount: Prisma.Decimal;
  rule: TillApprovalRuleRow;
  /** The caller: the approver IS the login (the cockpit is a supervisor's screen). */
  approverId: string;
  /** The session's cashier — the request's author, the moment it went PENDING_APPROVAL. */
  requesterId: string;
  /** The approver's till PIN as typed, when the channel wants one. */
  pin: string | null;
  /**
   * Notes 118 — a safe gap judges nobody else's cash: the requester (who
   * counted) may decide it, the rule's no-self flag notwithstanding.
   */
  selfExempt?: boolean;
  /**
   * Notes 118 — the second signature a two-person rule asks for, its PIN
   * already checked by the caller (a safe count's witness). Left out (undefined)
   * = the caller has no way to take one, and a two-person rule is refused as
   * "Part B" as before; null = it could have, and none came (APPROVER_SECOND).
   */
  second?: { userId: string } | null;
}

export interface ApproverVerdict {
  /** The level the grant confers — HO_FINANCE for a SUPER ADMIN's implicit one. */
  role: TillApproverRole;
  /** The channel actually used (ck_tap_channel: never EITHER). */
  channel: 'COUNTER' | 'REMOTE';
  /** The till_approval_authority row, or null for the implicit SUPER ADMIN grant. */
  grantId: string | null;
  implicit: boolean;
  /** Notes 118 — the second signature of a two-person rule (tap_second_by); null otherwise. */
  secondBy: string | null;
}

/** One till_approval row (A3): a decision taken, recorded once. */
export interface ApprovalRecordInput {
  companyId: string;
  branchId: string;
  tenantId: string | null;
  accYear: string;
  event: string;
  sessionId: string | null;
  counterId: string | null;
  srcDocType: string;
  srcDocId: string;
  srcRefno: string | null;
  amount: Prisma.Decimal;
  rule: TillApprovalRuleRow;
  verdict: ApproverVerdict;
  requestedBy: string;
  requestedOn: Date;
  reasonId: string | null;
  status: 'APPROVED' | 'REJECTED';
  decidedBy: string;
  decidedOn: Date;
  decidedDeviceId: string | null;
  decisionNote: string;
  payload?: Record<string, unknown>;
  /** Notes 118 — a safe gap decided by whoever counted it (ApproverAsk.selfExempt). */
  selfAllowed?: boolean;
  /** When the second signature was taken (with verdict.secondBy). */
  secondOn?: Date | null;
}

interface Grant {
  id: string | null;
  role: string;
  maxAmount: Prisma.Decimal | null;
  canRemote: boolean;
  implicit: boolean;
}

/** What a session's /close answered before any rule row existed; still the fallback. */
const FALLBACK_RULE = (event: string): TillApprovalRuleRow => ({
  tar_id: null,
  tar_event_code: event,
  tar_mode: 'ALWAYS',
  tar_threshold_amount: new Prisma.Decimal(0),
  tar_channel: 'EITHER',
  tar_min_role: 'SUPERVISOR',
  tar_two_person: false,
  tar_allow_self: false,
  tar_blocks_till: true,
});

/**
 * The approval rules (share file 47 §1.6, `till_approval_rule`) and — since
 * notes 105 Part A — who may decide under one, and the record of a decision.
 *
 * Resolution, as TillApprovalRule.prisma states it: a branch row beats a
 * company row beats the shipped row (both NULL), then the latest
 * `tar_effective_from` on or before the business date. One row.
 *
 * `assess` is still the read-only report a money document asks for
 * (plan-till-receipt-payment-expense §3.3 CASH_PAYMENT, §4.3 EXPENSE); the
 * full gate — request · decide · get · cancel, the inbox, the expiry sweep
 * (TILL_DESIGN.md §S7) — is Part B. `assertApprover` + `record` are what the
 * variance decision needs of it today, written so Part B's `decide` can grow
 * out of them rather than beside them.
 */
@Injectable()
export class TillApprovalService {
  async ruleFor(
    client: Client,
    scope: { companyId: string; branchId: string; event: string; onDate: string },
  ): Promise<(TillApprovalRuleRow & { tar_id: string }) | null> {
    const [row] = await client.$queryRaw<(TillApprovalRuleRow & { tar_id: string })[]>`
      SELECT tar_id, tar_event_code, tar_mode, tar_threshold_amount, tar_channel, tar_min_role,
             tar_two_person, tar_allow_self, tar_blocks_till
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

  /** The rule, or the built-in one (SUPERVISOR, EITHER, no self-approval) when none is set up. */
  async ruleOrDefault(
    client: Client,
    scope: { companyId: string; branchId: string; event: string; onDate: string },
  ): Promise<TillApprovalRuleRow> {
    return (await this.ruleFor(client, scope)) ?? FALLBACK_RULE(scope.event);
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

  /**
   * May the caller decide this? Notes 105 A2, in order — every step a 403 with
   * its own code so the screen can say which:
   *
   *   1. not the requester (`tar_allow_self = false`) — TILL_APPROVER_SELF;
   *   2. a `till_approval_authority` grant, active today, for this company
   *      (and branch, or every branch), this event (or every event), at the
   *      rule's level or above — TILL_APPROVER_NO_GRANT. A SUPER ADMIN
   *      (`usr_type`, decided 2026-10-12) holds an implicit HO_FINANCE grant on
   *      every event and branch with no ceiling; an ADMIN needs a real one;
   *   3. among those, one whose `taa_max_amount` covers the amount —
   *      TILL_APPROVER_LIMIT, naming the highest ceiling held;
   *   4. the channel: COUNTER verifies the till PIN; REMOTE wants
   *      `taa_can_remote`; EITHER takes a PIN when one is typed, else remote
   *      authority — TILL_APPROVER_PIN.
   *
   * Reads only: a caller judges before it writes, so a wrong PIN can be
   * journalled (PIN_FAIL) outside the transaction it would have rolled back.
   */
  async assertApprover(client: Client, ask: ApproverAsk): Promise<ApproverVerdict> {
    const { rule, event } = ask;
    if (ask.approverId === ask.requesterId && !rule.tar_allow_self && !ask.selfExempt) {
      throwTill(
        TillErrorCode.APPROVER_SELF,
        'The cashier of a session does not decide its own variance: the rule allows no self-approval',
        'userId',
        { event, requiredRole: rule.tar_min_role },
      );
    }
    const second = rule.tar_two_person ? this.assertSecond(ask) : null;

    const user = await client.userMaster.findUnique({
      where: { usrId: ask.approverId },
      select: { usrLoginName: true, usrType: true, usrPinHash: true, usrIsActive: true },
    });
    const login = user?.usrLoginName ?? ask.approverId;
    const grants: Grant[] =
      user?.usrIsActive && user.usrType === UserType.SUPER_ADMIN
        ? [{ id: null, role: 'HO_FINANCE', maxAmount: null, canRemote: true, implicit: true }]
        : [];
    const rows = await client.$queryRaw<
      {
        taa_id: string;
        taa_role: string;
        taa_max_amount: Prisma.Decimal | null;
        taa_can_remote: boolean;
      }[]
    >`
      SELECT taa_id, taa_role, taa_max_amount, taa_can_remote
        FROM accounts.till_approval_authority
       WHERE taa_user_id = ${ask.approverId}::uuid
         AND taa_is_active AND NOT taa_is_deleted
         AND (taa_company_id IS NULL OR taa_company_id = ${ask.companyId}::uuid)
         AND (taa_branch_id  IS NULL OR taa_branch_id  = ${ask.branchId}::uuid)
         AND (taa_event_code IS NULL OR taa_event_code = ${event})
         AND taa_valid_from <= current_date
         AND (taa_valid_to IS NULL OR taa_valid_to >= current_date)`;
    grants.push(
      ...rows.map((r) => ({
        id: r.taa_id,
        role: r.taa_role,
        maxAmount: r.taa_max_amount === null ? null : new Prisma.Decimal(r.taa_max_amount),
        canRemote: r.taa_can_remote,
        implicit: false,
      })),
    );

    const minRank = approverRoleRank(rule.tar_min_role);
    const atLevel = grants.filter((g) => approverRoleRank(g.role) >= minRank);
    if (atLevel.length === 0) {
      throwTill(
        TillErrorCode.APPROVER_NO_GRANT,
        `${login} holds no approval authority for ${event} at ${rule.tar_min_role} or above in this branch (Till Approval Authority, menu 285)`,
        'userId',
        { event, requiredRole: rule.tar_min_role },
      );
    }
    const amount = new Prisma.Decimal(ask.amount.toFixed(2));
    const covering = atLevel.filter((g) => g.maxAmount === null || g.maxAmount.gte(amount));
    if (covering.length === 0) {
      const ceiling = atLevel.reduce(
        (max, g) => (g.maxAmount && g.maxAmount.gt(max) ? g.maxAmount : max),
        new Prisma.Decimal(0),
      );
      throwTill(
        TillErrorCode.APPROVER_LIMIT,
        `${login}'s authority for ${event} stops at ${ceiling.toFixed(2)}; this one is ${amount.toFixed(2)}`,
        'userId',
        {
          event,
          requiredRole: rule.tar_min_role,
          amount: Number(amount.toFixed(2)),
          maxAmount: Number(ceiling.toFixed(2)),
        },
      );
    }

    const pin = ask.pin?.trim() || null;
    const remoteOk = covering.some((g) => g.canRemote);
    let channel: 'COUNTER' | 'REMOTE';
    if (rule.tar_channel === 'REMOTE') {
      if (!remoteOk) {
        throwTill(
          TillErrorCode.APPROVER_NO_GRANT,
          `The ${event} rule is decided remotely, and ${login}'s authority is not a remote one (taa_can_remote)`,
          'userId',
          { event, requiredRole: rule.tar_min_role, channel: 'REMOTE' },
        );
      }
      channel = 'REMOTE';
    } else if (rule.tar_channel === 'COUNTER' || pin !== null || !remoteOk) {
      if (pin === null) {
        throwTill(
          TillErrorCode.APPROVER_PIN,
          rule.tar_channel === 'COUNTER'
            ? `The ${event} rule is decided at the counter: type the approver's till PIN`
            : `${login} has no remote authority for ${event}: type the till PIN`,
          'approverPin',
          { event, requiredRole: rule.tar_min_role, channel: 'COUNTER' },
        );
      }
      if (!(await verifySecret(pin, user?.usrPinHash ?? null))) {
        throwTill(
          TillErrorCode.APPROVER_PIN,
          user?.usrPinHash
            ? 'The till PIN is wrong'
            : `${login} has no till PIN (User Administration, notes 95)`,
          'approverPin',
          { event, requiredRole: rule.tar_min_role, channel: 'COUNTER' },
        );
      }
      channel = 'COUNTER';
    } else {
      channel = 'REMOTE';
    }

    const usable = channel === 'REMOTE' ? covering.filter((g) => g.canRemote) : covering;
    const grant = usable.reduce((best, g) =>
      approverRoleRank(g.role) > approverRoleRank(best.role) ? g : best,
    );
    return {
      role: grant.role as TillApproverRole,
      channel,
      grantId: grant.id,
      implicit: grant.implicit,
      secondBy: second,
    };
  }

  /**
   * A two-person rule (notes 118: SAFE_VARIANCE as shipped). A caller that
   * cannot take a second signature leaves `second` out and is refused as
   * before; one that can must bring a person other than the approver and the
   * requester (ck_tap_second), whose PIN it has already checked.
   */
  private assertSecond(ask: ApproverAsk): string {
    const { rule, event } = ask;
    if (ask.second === undefined) {
      throwTill(
        TillErrorCode.APPROVER_NO_GRANT,
        `The ${event} rule asks for two approvers; the two-person gate is Part B of the approvals work`,
        'decision',
        { event, requiredRole: rule.tar_min_role, twoPerson: true },
      );
    }
    if (ask.second === null) {
      throwTill(
        TillErrorCode.APPROVER_SECOND,
        `The ${event} rule asks for two people: a second person signs with their till PIN`,
        'secondId',
        { event, requiredRole: rule.tar_min_role, twoPerson: true },
      );
    }
    const by = ask.second.userId;
    if (by === ask.approverId || by === ask.requesterId) {
      throwTill(
        TillErrorCode.APPROVER_SECOND,
        by === ask.approverId
          ? 'The second signature is another person than the one deciding'
          : 'The second signature is another person than the one who raised it',
        'secondId',
        { event, requiredRole: rule.tar_min_role, twoPerson: true },
      );
    }
    return by;
  }

  /** The till_approval row of a decision (A3). Returns `tap_id`. */
  async record(tx: Prisma.TransactionClient, input: ApprovalRecordInput): Promise<string> {
    const countInSession = input.sessionId
      ? await tx.tillApproval.count({
          where: {
            tapSessionId: input.sessionId,
            tapAccYear: input.accYear,
            tapEventCode: input.event,
            tapIsDeleted: false,
          },
        })
      : 0;
    const snapshot: Prisma.InputJsonValue = {
      ruleId: input.rule.tar_id,
      mode: input.rule.tar_mode,
      threshold: Number(input.rule.tar_threshold_amount.toFixed(2)),
      channel: input.rule.tar_channel,
      minRole: input.rule.tar_min_role,
      allowSelf: input.rule.tar_allow_self,
      twoPerson: input.rule.tar_two_person,
      blocksTill: input.rule.tar_blocks_till,
      approver: {
        role: input.verdict.role,
        grantId: input.verdict.grantId,
        implicit: input.verdict.implicit,
        secondBy: input.verdict.secondBy,
      },
      ...(input.payload ?? {}),
    };
    const row = await tx.tillApproval.create({
      data: {
        tapCompanyId: input.companyId,
        tapBranchId: input.branchId,
        tapTenantId: input.tenantId,
        tapAccYear: input.accYear,
        tapEventCode: input.event,
        tapSessionId: input.sessionId,
        tapCounterId: input.counterId,
        tapSrcDocType: input.srcDocType,
        tapSrcDocId: input.srcDocId,
        tapSrcRefno: input.srcRefno,
        tapAmount: input.amount,
        tapCountInSession: countInSession,
        tapRuleId: input.rule.tar_id,
        tapRuleSnapshot: snapshot,
        tapRequiredRole: input.rule.tar_min_role,
        tapTwoPerson: input.rule.tar_two_person && input.verdict.secondBy !== null,
        tapSelfAllowed: input.selfAllowed ?? input.rule.tar_allow_self,
        tapChannel: input.verdict.channel,
        tapRequestedBy: input.requestedBy,
        tapRequestedOn: input.requestedOn,
        tapReasonId: input.reasonId,
        tapStatus: input.status,
        tapDecidedBy: input.decidedBy,
        tapDecidedOn: input.decidedOn,
        tapDecidedDeviceId: input.decidedDeviceId,
        tapDecisionNote: input.decisionNote,
        tapSecondBy: input.verdict.secondBy,
        tapSecondOn: input.verdict.secondBy ? (input.secondOn ?? input.decidedOn) : null,
        tapDeviceId: input.decidedDeviceId,
      },
      select: { tapId: true },
    });
    return row.tapId;
  }
}
