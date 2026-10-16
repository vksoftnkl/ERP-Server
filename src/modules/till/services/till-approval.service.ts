import { Injectable } from '@nestjs/common';
import { Prisma, type TillApproval } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { verifySecret } from '../../../common/utils/secret-hash.utils';
import { UserType } from '../../settings/userAdministration/types/user-administration.enum';
import { TillContextService } from '../till-context.service';
import { throwTill } from '../till-errors';
import {
  approverRoleRank,
  TillErrorCode,
  TillEventCode,
  type TillApproverRole,
} from '../types/till-enum';
import type { TillApprovalNeed } from '../types/till-api.types';
import { TillEventService } from './till-event.service';

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
  /** Minutes a PENDING request lives (notes 124 §5); 0 = until decided. */
  tar_expire_minutes?: number;
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
  /** The grant's event; null = every event. */
  event: string | null;
}

/** A user's approval grants in one branch, read once (the inbox judges many items with them). */
export interface ApproverGrants {
  userId: string;
  login: string;
  grants: Grant[];
}

/**
 * Notes 124 §5 — one event of one document, as the gate judges it. The
 * document is what an approved request must name: `srcDocType` / `srcDocId`.
 */
export interface GateAsk {
  companyId: string;
  branchId: string;
  tenantId: string | null;
  /** The year the request row goes in: the document's. */
  accYear: string;
  /** ck_tar_event: EXPENSE, CASH_PAYMENT, FLOAT_MISMATCH … */
  event: string;
  /** The business date the rule is read on. */
  onDate: string;
  amount: Prisma.Decimal;
  /** Who is doing it: the request's author. */
  requesterId: string;
  deviceId: string | null;
  sessionId: string | null;
  counterId: string | null;
  srcDocType: string;
  srcDocId: string;
  srcRefno: string | null;
  /** An approved request the client brings (approvals/decide answered it). */
  approvalId: string | null;
  /** Where a refusal points. */
  field: string;
  /** Kept with a request filed under WARN (tap_rule_snapshot), e.g. the variance it is about. */
  payload?: Record<string, unknown>;
}

/**
 * NONE: the rule asks nothing. APPROVED: an approved request was brought and
 * fits. REFUSE: `till.approval_gate` REFUSE on a rule that blocks the till, and
 * none was brought — the caller throws (throwApprovalRequired). WARN: it goes
 * through, and settleGate files a PENDING request for the inbox.
 */
export type GateVerdict =
  | { state: 'NONE' }
  | { state: 'APPROVED'; need: TillApprovalNeed; rule: TillApprovalRuleRow; tapId: string }
  | { state: 'REFUSE'; need: TillApprovalNeed; rule: TillApprovalRuleRow }
  | { state: 'WARN'; need: TillApprovalNeed; rule: TillApprovalRuleRow };

/** A PENDING request to file (the gate under WARN, approvals/request). */
export interface NewApprovalRequest {
  companyId: string;
  branchId: string;
  tenantId: string | null;
  accYear: string;
  event: string;
  rule: TillApprovalRuleRow;
  amount: Prisma.Decimal;
  requesterId: string;
  deviceId: string | null;
  sessionId: string | null;
  counterId: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcRefno: string | null;
  reasonId: string | null;
  note: string | null;
  /** till.single_operator: every approval allows self (tap_self_allowed). */
  selfAllowed?: boolean;
  /** Kept in tap_rule_snapshot beside the rule. */
  payload?: Record<string, unknown>;
}

/**
 * TILL_APPROVER_SELF's sentence, by the event refused (notes 124 §8: a
 * cashier force-closing their own session was told it "does not decide its own
 * variance"). The detail carries `event`; FORCE_CLOSE has a code of its own,
 * TILL_FORCE_CLOSE_SELF (notes 127 §6), so the client words it apart.
 */
const SELF_REFUSALS: Readonly<Record<string, string>> = {
  FORCE_CLOSE:
    'A cashier cannot force-close their own session: close it the normal way, or a supervisor force-closes it',
  SESSION_REOPEN: 'A cashier cannot reopen their own session: a supervisor reopens it',
  DAY_REOPEN: 'Whoever closed the business day cannot reopen it: another approver does',
  DAY_CLOSE_EXCEPTION:
    'Whoever closes the business day cannot also approve its exception: name another approver',
  SAFE_VARIANCE: 'Whoever counted the safe does not decide its difference: the rule allows no self-approval',
};

function selfRefusalOf(event: string): string {
  return (
    SELF_REFUSALS[event] ??
    'The cashier of a session does not decide its own variance: the rule allows no self-approval'
  );
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
  tar_expire_minutes: 0,
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
  constructor(
    private readonly context: TillContextService,
    private readonly events: TillEventService,
  ) {}

  async ruleFor(
    client: Client,
    scope: { companyId: string; branchId: string; event: string; onDate: string },
  ): Promise<(TillApprovalRuleRow & { tar_id: string }) | null> {
    const [row] = await client.$queryRaw<(TillApprovalRuleRow & { tar_id: string })[]>`
      SELECT tar_id, tar_event_code, tar_mode, tar_threshold_amount, tar_channel, tar_min_role,
             tar_two_person, tar_allow_self, tar_blocks_till, tar_expire_minutes
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
    return rule ? needOf(rule, scope.amount) : null;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The gate (notes 124 §5 — notes 105 Part B)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * What the gate does with one event of a document — reads only, so /validate
   * can answer it too. The rule (`assess`); an `approvalId` brought must be an
   * APPROVED, unused request of this branch for this event and this document,
   * for at least this amount (422 TILL_APPROVAL_INVALID otherwise); with none,
   * `till.approval_gate` REFUSE on a rule that blocks the till refuses, and
   * anything else goes through (WARN). The user's rule (2026-10-15): the
   * counter is never blocked while a customer waits unless a company says so.
   */
  async assessGate(client: Client, ask: GateAsk): Promise<GateVerdict> {
    const rule = await this.ruleFor(client, ask);
    const need = rule ? needOf(rule, ask.amount) : null;
    if (!rule || !need) {
      return { state: 'NONE' };
    }
    const settings = await this.context.settings({
      companyId: ask.companyId,
      branchId: ask.branchId,
      deviceId: ask.deviceId,
      userId: ask.requesterId,
    });
    const refuse = settings.approvalGate === 'REFUSE' && rule.tar_blocks_till;
    if (ask.approvalId) {
      const tap = await this.approvedFor(client, ask, need);
      return {
        state: 'APPROVED',
        need: { ...need, enforced: refuse, approvalId: tap.tapId },
        rule,
        tapId: tap.tapId,
      };
    }
    return refuse
      ? { state: 'REFUSE', need: { ...need, enforced: true }, rule }
      : { state: 'WARN', need, rule };
  }

  /**
   * The gate's write, inside the document's own transaction: an approved
   * request is taken (marked used, so it approves nothing else); under WARN a
   * PENDING request is filed for the inbox — one per event and document.
   * Returns the request's id, or null.
   */
  async settleGate(
    tx: Prisma.TransactionClient,
    ask: GateAsk,
    verdict: GateVerdict,
  ): Promise<string | null> {
    if (verdict.state === 'APPROVED') {
      const [row] = await tx.$queryRaw<{ used: string | null }[]>`
        SELECT tap_rule_snapshot ->> 'usedOn' AS used FROM accounts.till_approval
         WHERE tap_id = ${verdict.tapId}::uuid AND tap_status = 'APPROVED' AND NOT tap_is_deleted
         FOR UPDATE`;
      if (!row || row.used) {
        throwTill(
          TillErrorCode.APPROVAL_INVALID,
          `Approval ${verdict.tapId} has already been used`,
          ask.field,
          { event: ask.event },
        );
      }
      await tx.$executeRaw`
        UPDATE accounts.till_approval
           SET tap_rule_snapshot = COALESCE(tap_rule_snapshot, '{}'::jsonb)
                 || jsonb_build_object('usedOn', now(), 'usedBy', ${ask.requesterId}::text,
                                       'usedDocType', ${ask.srcDocType}::text, 'usedDocId', ${ask.srcDocId}::text),
               tap_session_id = COALESCE(tap_session_id, ${ask.sessionId}::uuid),
               tap_modified_on = now()
         WHERE tap_id = ${verdict.tapId}::uuid`;
      return verdict.tapId;
    }
    if (verdict.state !== 'WARN') {
      return null;
    }
    const open = await tx.tillApproval.findFirst({
      where: {
        tapCompanyId: ask.companyId,
        tapBranchId: ask.branchId,
        tapEventCode: ask.event,
        tapSrcDocType: ask.srcDocType,
        tapSrcDocId: ask.srcDocId,
        tapStatus: 'PENDING',
        tapIsDeleted: false,
      },
      select: { tapId: true },
    });
    if (open) {
      return open.tapId;
    }
    return this.fileRequest(tx, {
      ...ask,
      rule: verdict.rule,
      reasonId: null,
      note: null,
      payload: { ...(ask.payload ?? {}), filedBy: 'gate', after: true },
    });
  }

  /** 428 TILL_APPROVAL_REQUIRED: what to ask approvals/request for, and of whom. */
  throwApprovalRequired(need: TillApprovalNeed, ask: GateAsk): never {
    throwTill(
      TillErrorCode.APPROVAL_REQUIRED,
      `${ask.event} of ${need.amount.toFixed(2)} needs an approval at ${need.minRole} or above: ` +
        'ask for one (/till/approvals/request) and bring its approvalId',
      ask.field,
      {
        event: ask.event,
        amount: need.amount,
        requiredRole: need.minRole,
        channel: need.channel,
        twoPerson: need.twoPerson,
        srcDocType: ask.srcDocType,
        srcDocId: ask.srcDocId,
      },
    );
  }

  /** A PENDING till_approval row and its APPROVAL_REQUESTED event. Returns `tap_id`. */
  async fileRequest(tx: Prisma.TransactionClient, input: NewApprovalRequest): Promise<string> {
    const now = new Date();
    const expire = input.rule.tar_expire_minutes ?? 0;
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
        tapAmount: input.amount.toDecimalPlaces(2),
        tapCountInSession: countInSession,
        tapRuleId: input.rule.tar_id,
        tapRuleSnapshot: {
          ...snapshotOf(input.rule),
          ...(input.payload ?? {}),
        } as Prisma.InputJsonValue,
        tapRequiredRole: input.rule.tar_min_role,
        tapTwoPerson: input.rule.tar_two_person,
        tapSelfAllowed: input.selfAllowed ?? input.rule.tar_allow_self,
        // ck_tap_channel has no EITHER: a request either can be decided remotely or not.
        tapChannel: input.rule.tar_channel === 'COUNTER' ? 'COUNTER' : 'REMOTE',
        tapRequestedBy: input.requesterId,
        tapRequestedOn: now,
        tapReasonId: input.reasonId,
        tapRequestNote: input.note,
        tapStatus: 'PENDING',
        tapExpiresOn: expire > 0 ? new Date(now.getTime() + expire * 60_000) : null,
        tapDeviceId: input.deviceId,
      },
      select: { tapId: true },
    });
    await this.events.log(tx, {
      companyId: input.companyId,
      branchId: input.branchId,
      accYear: input.accYear,
      code: TillEventCode.APPROVAL_REQUESTED,
      sessionId: input.sessionId,
      counterId: input.counterId,
      deviceId: input.deviceId,
      userId: input.requesterId,
      srcDocType: input.srcDocType,
      srcDocId: input.srcDocId,
      srcRefno: input.srcRefno,
      amount: input.amount,
      reasonId: input.reasonId,
      approvalId: row.tapId,
      payload: {
        event: input.event,
        requiredRole: input.rule.tar_min_role,
        channel: input.rule.tar_channel,
        ...(input.payload ?? {}),
      },
    });
    return row.tapId;
  }

  /** The approved request an action brings, checked against what it is for (422 otherwise). */
  private async approvedFor(
    client: Client,
    ask: GateAsk,
    need: TillApprovalNeed,
  ): Promise<TillApproval> {
    const refuse = (message: string, extra: Record<string, unknown> = {}): never =>
      throwTill(TillErrorCode.APPROVAL_INVALID, message, ask.field, {
        event: ask.event,
        ...extra,
      });
    const tap = await client.tillApproval.findFirst({
      where: {
        tapId: ask.approvalId!,
        tapCompanyId: ask.companyId,
        tapBranchId: ask.branchId,
        tapIsDeleted: false,
      },
    });
    if (!tap) {
      return refuse(`Approval ${ask.approvalId} is not one of this branch`);
    }
    if (tap.tapStatus !== 'APPROVED') {
      return refuse(
        tap.tapStatus === 'PENDING'
          ? `Approval ${tap.tapId} still waits for an approver`
          : `Approval ${tap.tapId} is ${tap.tapStatus}`,
        { status: tap.tapStatus },
      );
    }
    if (tap.tapEventCode !== ask.event) {
      return refuse(`Approval ${tap.tapId} is for ${tap.tapEventCode}, not ${ask.event}`);
    }
    if (tap.tapSrcDocType !== ask.srcDocType || tap.tapSrcDocId !== ask.srcDocId) {
      return refuse(
        `Approval ${tap.tapId} approves ${tap.tapSrcDocType ?? 'nothing'} ${tap.tapSrcRefno ?? tap.tapSrcDocId ?? ''}, not this one`.trim(),
      );
    }
    const amount = new Prisma.Decimal(need.amount);
    if (new Prisma.Decimal(tap.tapAmount).lessThan(amount)) {
      return refuse(
        `Approval ${tap.tapId} approves up to ${new Prisma.Decimal(tap.tapAmount).toFixed(2)}; this is ${amount.toFixed(2)}`,
        { amount: need.amount, maxAmount: Number(new Prisma.Decimal(tap.tapAmount).toFixed(2)) },
      );
    }
    const snapshot = (tap.tapRuleSnapshot ?? {}) as Record<string, unknown>;
    if (snapshot.usedOn) {
      return refuse(`Approval ${tap.tapId} has already been used`);
    }
    return tap;
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
   *      authority — TILL_APPROVER_PIN; an approver with no till PIN at all
   *      is TILL_APPROVER_NO_PIN (notes 122 §8).
   *
   * Reads only: a caller judges before it writes, so a wrong PIN can be
   * journalled (PIN_FAIL) outside the transaction it would have rolled back.
   */
  async assertApprover(client: Client, ask: ApproverAsk): Promise<ApproverVerdict> {
    const { rule, event } = ask;
    if (ask.approverId === ask.requesterId && !rule.tar_allow_self && !ask.selfExempt) {
      throwTill(
        event === 'FORCE_CLOSE' ? TillErrorCode.FORCE_CLOSE_SELF : TillErrorCode.APPROVER_SELF,
        selfRefusalOf(event),
        'userId',
        { event, requiredRole: rule.tar_min_role },
      );
    }
    const second = rule.tar_two_person ? this.assertSecond(ask) : null;

    const user = await client.userMaster.findUnique({
      where: { usrId: ask.approverId },
      select: { usrLoginName: true, usrPinHash: true },
    });
    const { login, grants: held } = await this.grantsOf(client, {
      userId: ask.approverId,
      companyId: ask.companyId,
      branchId: ask.branchId,
    });
    const grants = held.filter((g) => g.event === null || g.event === event);

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
      if (!user?.usrPinHash) {
        // Notes 122 §8: not a wrong PIN — there is none to type until an
        // administrator sets one (as the witness's / supervisor's NO_PIN).
        throwTill(
          TillErrorCode.APPROVER_NO_PIN,
          `${login} has no till PIN: an administrator sets one in User Administration (menu 58)`,
          'approverPin',
          { event, requiredRole: rule.tar_min_role, channel: 'COUNTER' },
        );
      }
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
        throwTill(TillErrorCode.APPROVER_PIN, 'The till PIN is wrong', 'approverPin', {
          event,
          requiredRole: rule.tar_min_role,
          channel: 'COUNTER',
        });
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
   * Every approval grant a user holds in a branch, active today, any event —
   * a SUPER ADMIN's implicit HO_FINANCE one first (decided 2026-10-12).
   */
  async grantsOf(
    client: Client,
    scope: { userId: string; companyId: string; branchId: string },
  ): Promise<ApproverGrants> {
    const user = await client.userMaster.findUnique({
      where: { usrId: scope.userId },
      select: { usrLoginName: true, usrType: true, usrIsActive: true },
    });
    const grants: Grant[] =
      user?.usrIsActive && user.usrType === UserType.SUPER_ADMIN
        ? [
            {
              id: null,
              role: 'HO_FINANCE',
              maxAmount: null,
              canRemote: true,
              implicit: true,
              event: null,
            },
          ]
        : [];
    const rows = await client.$queryRaw<
      {
        taa_id: string;
        taa_role: string;
        taa_max_amount: Prisma.Decimal | null;
        taa_can_remote: boolean;
        taa_event_code: string | null;
      }[]
    >`
      SELECT taa_id, taa_role, taa_max_amount, taa_can_remote, taa_event_code
        FROM accounts.till_approval_authority
       WHERE taa_user_id = ${scope.userId}::uuid
         AND taa_is_active AND NOT taa_is_deleted
         AND (taa_company_id IS NULL OR taa_company_id = ${scope.companyId}::uuid)
         AND (taa_branch_id  IS NULL OR taa_branch_id  = ${scope.branchId}::uuid)
         AND taa_valid_from <= current_date
         AND (taa_valid_to IS NULL OR taa_valid_to >= current_date)`;
    grants.push(
      ...rows.map((r) => ({
        id: r.taa_id,
        role: r.taa_role,
        maxAmount: r.taa_max_amount === null ? null : new Prisma.Decimal(r.taa_max_amount),
        canRemote: r.taa_can_remote,
        implicit: false,
        event: r.taa_event_code,
      })),
    );
    return { userId: scope.userId, login: user?.usrLoginName ?? scope.userId, grants };
  }

  /**
   * Could these grants decide it — assertApprover's steps 1–3 without the PIN
   * (the inbox's `canDecide`)? Null when yes, else the code it would refuse with.
   */
  standing(
    held: ApproverGrants,
    ask: {
      event: string;
      amount: Prisma.Decimal;
      minRole: string;
      requesterId: string | null;
      selfAllowed: boolean;
    },
  ): TillErrorCode | null {
    if (!ask.selfAllowed && ask.requesterId === held.userId) {
      return TillErrorCode.APPROVER_SELF;
    }
    const minRank = approverRoleRank(ask.minRole);
    const atLevel = held.grants.filter(
      (g) => (g.event === null || g.event === ask.event) && approverRoleRank(g.role) >= minRank,
    );
    if (atLevel.length === 0) {
      return TillErrorCode.APPROVER_NO_GRANT;
    }
    const amount = ask.amount.toDecimalPlaces(2);
    return atLevel.some((g) => g.maxAmount === null || g.maxAmount.gte(amount))
      ? null
      : TillErrorCode.APPROVER_LIMIT;
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
      ...snapshotOf(input.rule),
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

/** What an event's rule asks of an amount (NEVER / OVER_COUNT / OVER_PERCENT: nothing here). */
function needOf(rule: TillApprovalRuleRow & { tar_id: string }, amount: Prisma.Decimal) {
  const threshold = new Prisma.Decimal(rule.tar_threshold_amount);
  const needed =
    rule.tar_mode === 'ALWAYS' ||
    (rule.tar_mode === 'OVER_AMOUNT' && amount.greaterThan(threshold));
  if (!needed) {
    return null;
  }
  const need: TillApprovalNeed = {
    event: rule.tar_event_code,
    ruleId: rule.tar_id,
    mode: rule.tar_mode,
    threshold: Number(threshold.toFixed(2)),
    amount: Number(amount.toFixed(2)),
    minRole: rule.tar_min_role,
    channel: rule.tar_channel,
    twoPerson: rule.tar_two_person,
    blocksTill: rule.tar_blocks_till,
    enforced: false,
  };
  return need;
}

/** The rule as it was when the request fired (tap_rule_snapshot). */
function snapshotOf(rule: TillApprovalRuleRow): Record<string, Prisma.InputJsonValue | null> {
  return {
    ruleId: rule.tar_id,
    mode: rule.tar_mode,
    threshold: Number(new Prisma.Decimal(rule.tar_threshold_amount).toFixed(2)),
    channel: rule.tar_channel,
    minRole: rule.tar_min_role,
    allowSelf: rule.tar_allow_self,
    twoPerson: rule.tar_two_person,
    blocksTill: rule.tar_blocks_till,
    expireMinutes: rule.tar_expire_minutes ?? 0,
  };
}

/**
 * The rule a request was filed under, back from its snapshot — a decision is
 * judged by the bar that stood when it was asked, not one changed since.
 */
export function ruleOfRequest(tap: TillApproval): TillApprovalRuleRow {
  const s = (tap.tapRuleSnapshot ?? {}) as Record<string, unknown>;
  return {
    tar_id: tap.tapRuleId,
    tar_event_code: tap.tapEventCode,
    tar_mode: typeof s.mode === 'string' ? s.mode : 'ALWAYS',
    tar_threshold_amount: new Prisma.Decimal(typeof s.threshold === 'number' ? s.threshold : 0),
    tar_channel: typeof s.channel === 'string' ? s.channel : tap.tapChannel,
    tar_min_role: tap.tapRequiredRole,
    tar_two_person: tap.tapTwoPerson,
    tar_allow_self: tap.tapSelfAllowed,
    tar_blocks_till: s.blocksTill !== false,
    tar_expire_minutes: typeof s.expireMinutes === 'number' ? s.expireMinutes : 0,
  };
}
