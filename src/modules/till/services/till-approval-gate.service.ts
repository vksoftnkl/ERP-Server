import { Injectable } from '@nestjs/common';
import { Prisma, type TillApproval } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { verifySecret } from '../../../common/utils/secret-hash.utils';
import { TillContextService, type TillCaller } from '../till-context.service';
import { accYearOf, assertTillPartitions, businessDateNow } from '../till-dates';
import { throwTill, throwTillBadRequest, throwTillNotFound, tillErrorCodeOf } from '../till-errors';
import { TILL_MENU, TillErrorCode, TillEventCode } from '../types/till-enum';
import type {
  TillApprovalInboxItem,
  TillApprovalInboxPayload,
  TillApprovalPayload,
  TillApprovalStatus,
} from '../types/till-api.types';
import {
  ruleOfRequest,
  TillApprovalService,
  type ApproverGrants,
  type ApproverVerdict,
  type TillApprovalRuleRow,
} from './till-approval.service';
import { TillEventService } from './till-event.service';

type Tx = Prisma.TransactionClient;

const num = (d: Prisma.Decimal | number | string | null | undefined): number =>
  d === null || d === undefined ? 0 : Number(new Prisma.Decimal(d).toFixed(2));

/** POST /till/approvals/request. */
export interface RequestApprovalInput {
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  event: string;
  amount: number;
  sessionId?: string | null;
  accYear?: string | null;
  srcDocType?: string | null;
  srcDocId?: string | null;
  srcRefno?: string | null;
  reasonId?: string | null;
  note?: string | null;
  /** Decided here, at the counter: the approver standing there types their PIN. */
  approverId?: string | null;
  approverPin?: string | null;
  secondId?: string | null;
  secondPin?: string | null;
}

export interface ApprovalKey {
  companyId: string;
  branchId: string;
  accYear: string;
  tapId: string;
}

/** POST /till/approvals/decide. */
export interface DecideApprovalInput extends ApprovalKey {
  decision: 'APPROVE' | 'REJECT';
  approverPin?: string | null;
  secondId?: string | null;
  secondPin?: string | null;
  note: string;
}

/**
 * Notes 124 §5 — the approval gate (notes 105 Part B, TILL_DESIGN §S7): a
 * request is a till_approval row, PENDING until an approver decides it.
 *
 *   request  the caller asks (an event, an amount, the document); decided at
 *            once when the approver standing at the counter types a PIN here
 *   decide   the caller is the approver: assertApprover against the rule as it
 *            stood when the request was made (its snapshot); a two-person rule
 *            takes a second signature by PIN
 *   cancel   whoever asked, or a Till Sessions (273) OVERRIDE holder
 *   pending  the inbox: the requests, and every other decision waiting in the
 *            branch — sessions out of tolerance (also CLOSED ones with a drawer
 *            gap left undecided, notes 124 §1), received bags' differences,
 *            safe gaps — each with the route that decides it
 *
 * A PENDING request past `tap_expires_on` (`tar_expire_minutes` > 0) is swept
 * to EXPIRED when anything reads it. What an approved request unlocks is the
 * document's business: it brings `approvalId`, and TillApprovalService.
 * assessGate / settleGate check and take it (expense post, payment post,
 * session open).
 */
@Injectable()
export class TillApprovalGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly approval: TillApprovalService,
    private readonly events: TillEventService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  request
  // ═════════════════════════════════════════════════════════════════════════

  async request(input: RequestApprovalInput): Promise<TillApprovalPayload> {
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const onDate = await businessDateNow(this.prisma, settings.dayCutoff);
    const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
    if (amount.isNegative()) {
      throwTillBadRequest(TillErrorCode.AMOUNT_NEGATIVE, 'amount is 0 or more', 'amount');
    }
    if (!!input.srcDocType !== !!input.srcDocId) {
      throwTillBadRequest(
        TillErrorCode.SOURCE_DOC_PAIR,
        'srcDocType and srcDocId go together',
        'srcDocId',
      );
    }

    // The session it is about (its year, its counter), else the caller's counter.
    const session = input.sessionId
      ? await this.prisma.tillSession.findFirst({
          where: {
            tssId: input.sessionId,
            tssCompanyId: input.companyId,
            tssBranchId: input.branchId,
            tssIsDeleted: false,
            ...(input.accYear ? { tssAccYear: input.accYear } : {}),
          },
        })
      : null;
    if (input.sessionId && !session) {
      throwTillNotFound(
        TillErrorCode.SESSION_NOT_FOUND,
        'Till session',
        'sessionId',
        input.sessionId,
      );
    }
    const counterId =
      session?.tssCounterId ??
      (caller.deviceId
        ? ((
            await this.prisma.tillCounter.findFirst({
              where: {
                tcnCompanyId: input.companyId,
                tcnBranchId: input.branchId,
                tcnDeviceId: caller.deviceId,
                tcnIsActive: true,
                tcnIsDeleted: false,
              },
              select: { tcnId: true },
            })
          )?.tcnId ?? null)
        : null);
    const accYear = session?.tssAccYear ?? input.accYear ?? accYearOf(onDate);
    const srcDocType = input.srcDocType ?? (session ? 'TILL_SESSION' : null);
    const srcDocId = input.srcDocId ?? session?.tssId ?? null;
    const srcRefno = input.srcRefno ?? session?.tssSessionNo ?? null;

    const rule = await this.approval.ruleOrDefault(this.prisma, {
      companyId: input.companyId,
      branchId: input.branchId,
      event: input.event,
      onDate,
    });
    const need = await this.approval.assess(this.prisma, {
      companyId: input.companyId,
      branchId: input.branchId,
      event: input.event,
      onDate,
      amount,
    });
    // No rule row at all is the built-in one (ALWAYS, SUPERVISOR); a rule that
    // asks nothing for this amount has nothing to approve.
    if (rule.tar_id !== null && !need) {
      throwTill(
        TillErrorCode.APPROVAL_INVALID,
        `The ${input.event} rule asks no approval for ${amount.toFixed(2)} (${rule.tar_mode}${
          rule.tar_mode === 'OVER_AMOUNT' ? ` ${num(rule.tar_threshold_amount).toFixed(2)}` : ''
        }): go ahead`,
        'event',
        { event: input.event, needed: false },
      );
    }
    if (input.reasonId) {
      const reason = await this.prisma.tillReason.findFirst({
        where: {
          trsId: input.reasonId,
          trsIsDeleted: false,
          trsIsActive: true,
          OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
        },
        select: { trsId: true },
      });
      if (!reason) {
        throwTill(TillErrorCode.REASON_INVALID, 'The reason is not an active till reason', 'reasonId');
      }
    }

    // Decided at the counter in the same call: judged before anything is written.
    const approverId = input.approverId?.trim() || null;
    const inline = approverId
      ? await this.judge({
          scope: input,
          accYear,
          caller,
          event: input.event,
          amount,
          // Someone else's PIN typed on this device: the counter channel.
          rule: approverId === caller.userId ? rule : { ...rule, tar_channel: 'COUNTER' },
          selfAllowed: rule.tar_allow_self || settings.singleOperator,
          approverId,
          requesterId: caller.userId,
          pin: input.approverPin ?? null,
          secondId: input.secondId ?? null,
          secondPin: input.secondPin ?? null,
          approve: true,
          action: 'approval-request',
        })
      : null;

    const tapId = await this.prisma.$transaction(async (tx) => {
      await assertTillPartitions(tx, accYear, 'accYear');
      const open = srcDocId
        ? await tx.tillApproval.findFirst({
            where: {
              tapCompanyId: input.companyId,
              tapBranchId: input.branchId,
              tapEventCode: input.event,
              tapSrcDocType: srcDocType,
              tapSrcDocId: srcDocId,
              tapRequestedBy: caller.userId,
              tapStatus: 'PENDING',
              tapIsDeleted: false,
            },
          })
        : null;
      const id =
        open?.tapId ??
        (await this.approval.fileRequest(tx, {
          companyId: input.companyId,
          branchId: input.branchId,
          tenantId: input.tenantId ?? session?.tssTenantId ?? null,
          accYear,
          event: input.event,
          rule,
          amount,
          requesterId: caller.userId,
          deviceId: caller.deviceId,
          sessionId: session?.tssId ?? null,
          counterId,
          srcDocType,
          srcDocId,
          srcRefno,
          reasonId: input.reasonId ?? null,
          note: input.note?.trim() || null,
          selfAllowed: rule.tar_allow_self || settings.singleOperator,
          payload: { filedBy: 'request' },
        }));
      if (inline) {
        const row = await this.lockRow(tx, { ...input, accYear: open?.tapAccYear ?? accYear, tapId: id });
        await this.decideIn(tx, row, {
          decision: 'APPROVE',
          note: input.note?.trim() || 'Approved at the counter',
          caller: { ...caller, userId: approverId! },
          verdict: inline.verdict,
          secondOn: inline.secondOn,
        });
      }
      return id;
    });
    return this.get({ companyId: input.companyId, branchId: input.branchId, accYear, tapId });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  decide · cancel · get
  // ═════════════════════════════════════════════════════════════════════════

  async decide(input: DecideApprovalInput): Promise<TillApprovalPayload> {
    const caller = await this.context.caller();
    if (!input.note?.trim()) {
      throwTillBadRequest(TillErrorCode.NOTE_REQUIRED, 'A decision note is required', 'note');
    }
    const tap = await this.pendingRow(input);
    const approve = input.decision === 'APPROVE';
    const rule = ruleOfRequest(tap);
    // A refusal needs no second signature; an approval under a two-person rule does.
    const judged = await this.judge({
      scope: input,
      accYear: tap.tapAccYear,
      caller,
      event: tap.tapEventCode,
      amount: new Prisma.Decimal(tap.tapAmount),
      rule: approve ? rule : { ...rule, tar_two_person: false },
      selfAllowed: tap.tapSelfAllowed,
      approverId: caller.userId,
      requesterId: tap.tapRequestedBy,
      pin: input.approverPin ?? null,
      secondId: input.secondId ?? null,
      secondPin: input.secondPin ?? null,
      approve,
      action: 'approval-decide',
    });
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockRow(tx, input);
      if (row.tapStatus !== 'PENDING') {
        this.throwNotPending(row);
      }
      await this.decideIn(tx, row, {
        decision: input.decision,
        note: input.note.trim(),
        caller,
        verdict: judged.verdict,
        secondOn: judged.secondOn,
      });
    });
    return this.get(input);
  }

  async cancel(input: ApprovalKey & { note?: string | null }): Promise<TillApprovalPayload> {
    const caller = await this.context.caller();
    const tap = await this.pendingRow(input);
    if (tap.tapRequestedBy !== caller.userId) {
      const rights = await this.context.rights(TILL_MENU.SESSIONS);
      if (!rights.override) {
        throwTill(
          TillErrorCode.APPROVAL_NOT_YOURS,
          'Only whoever asked for an approval cancels it (or a Till Sessions OVERRIDE holder)',
          'tapId',
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockRow(tx, input);
      if (row.tapStatus !== 'PENDING') {
        this.throwNotPending(row);
      }
      const note = `Cancelled by ${caller.actorName}${input.note?.trim() ? `: ${input.note.trim()}` : ''}`;
      await tx.tillApproval.update({
        where: { tapId_tapAccYear: { tapId: row.tapId, tapAccYear: row.tapAccYear } },
        data: {
          tapStatus: 'CANCELLED',
          tapDecisionNote: note.slice(0, 500),
          tapModifiedOn: new Date(),
        },
      });
      await this.logDecision(tx, row, caller, { status: 'CANCELLED', note });
    });
    return this.get(input);
  }

  async get(key: ApprovalKey): Promise<TillApprovalPayload> {
    const tap = await this.prisma.tillApproval.findFirst({
      where: {
        tapId: key.tapId,
        tapAccYear: key.accYear,
        tapCompanyId: key.companyId,
        tapBranchId: key.branchId,
        tapIsDeleted: false,
      },
    });
    if (!tap) {
      throwTillNotFound(TillErrorCode.APPROVAL_NOT_FOUND, 'Approval request', 'tapId', key.tapId);
    }
    const [session, counter, reason] = await Promise.all([
      tap.tapSessionId
        ? this.prisma.tillSession.findUnique({
            where: { tssId_tssAccYear: { tssId: tap.tapSessionId, tssAccYear: tap.tapAccYear } },
            select: { tssSessionNo: true },
          })
        : null,
      tap.tapCounterId
        ? this.prisma.tillCounter.findUnique({
            where: { tcnId: tap.tapCounterId },
            select: { tcnName: true },
          })
        : null,
      tap.tapReasonId
        ? this.prisma.tillReason.findUnique({
            where: { trsId: tap.tapReasonId },
            select: { trsName: true },
          })
        : null,
    ]);
    const names = await this.namesOf([tap.tapRequestedBy, tap.tapDecidedBy, tap.tapSecondBy]);
    const snapshot = (tap.tapRuleSnapshot ?? {}) as Record<string, unknown>;
    const status = tap.tapStatus as TillApprovalStatus;
    return {
      tapId: tap.tapId,
      tapAccYear: tap.tapAccYear,
      companyId: tap.tapCompanyId,
      branchId: tap.tapBranchId,
      event: tap.tapEventCode,
      status,
      amount: num(tap.tapAmount),
      requiredRole: tap.tapRequiredRole,
      channel:
        status === 'PENDING' && typeof snapshot.channel === 'string'
          ? snapshot.channel
          : tap.tapChannel,
      twoPerson: tap.tapTwoPerson,
      selfAllowed: tap.tapSelfAllowed,
      sessionId: tap.tapSessionId,
      sessionNo: session?.tssSessionNo ?? null,
      counterId: tap.tapCounterId,
      counterName: counter?.tcnName ?? null,
      srcDocType: tap.tapSrcDocType,
      srcDocId: tap.tapSrcDocId,
      srcRefno: tap.tapSrcRefno,
      reasonId: tap.tapReasonId,
      reasonName: reason?.trsName ?? null,
      requestedBy: tap.tapRequestedBy,
      requestedByName: names.get(tap.tapRequestedBy) ?? null,
      requestedOn: tap.tapRequestedOn.toISOString(),
      requestNote: tap.tapRequestNote,
      decidedBy: tap.tapDecidedBy,
      decidedByName: tap.tapDecidedBy ? (names.get(tap.tapDecidedBy) ?? null) : null,
      decidedOn: tap.tapDecidedOn ? tap.tapDecidedOn.toISOString() : null,
      decisionNote: tap.tapDecisionNote,
      secondBy: tap.tapSecondBy,
      secondByName: tap.tapSecondBy ? (names.get(tap.tapSecondBy) ?? null) : null,
      secondOn: tap.tapSecondOn ? tap.tapSecondOn.toISOString() : null,
      expiresOn: tap.tapExpiresOn ? tap.tapExpiresOn.toISOString() : null,
      usedOn: typeof snapshot.usedOn === 'string' ? snapshot.usedOn : null,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  pending — the inbox
  // ═════════════════════════════════════════════════════════════════════════

  async pending(scope: { companyId: string; branchId: string }): Promise<TillApprovalInboxPayload> {
    const caller = await this.context.caller();
    const expired = await this.sweep(scope, caller);
    const figures = (await this.context.rights(TILL_MENU.SESSIONS)).override;
    const held = await this.approval.grantsOf(this.prisma, {
      userId: caller.userId,
      companyId: scope.companyId,
      branchId: scope.branchId,
    });
    const settings = await this.context.settings({
      companyId: scope.companyId,
      branchId: scope.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const today = await businessDateNow(this.prisma, settings.dayCutoff);
    const rules = new Map<string, TillApprovalRuleRow>();
    const ruleOf = async (event: string, onDate: string) => {
      const k = `${event}|${onDate}`;
      if (!rules.has(k)) {
        rules.set(
          k,
          await this.approval.ruleOrDefault(this.prisma, { ...scope, event, onDate }),
        );
      }
      return rules.get(k)!;
    };
    const judge = (
      event: string,
      amount: Prisma.Decimal,
      minRole: string,
      requesterIds: (string | null)[],
      selfAllowed: boolean,
    ) => {
      let code: TillErrorCode | null = null;
      for (const requesterId of requesterIds.length ? requesterIds : [null]) {
        code = this.approval.standing(held, { event, amount, minRole, requesterId, selfAllowed });
        if (code) {
          break;
        }
      }
      return { canDecide: code === null, cannotBecause: code };
    };
    const items: TillApprovalInboxItem[] = [];
    const blank = {
      tapId: null,
      tssId: null,
      tcmId: null,
      tvrId: null,
      safeId: null,
      sessionNo: null,
      counterName: null,
      safeName: null,
      expiresOn: null,
      srcDocType: null,
      srcDocId: null,
      srcRefno: null,
      note: null,
      afterClose: false,
    };

    // ── the requests
    const requests = await this.prisma.$queryRaw<
      {
        tap_id: string;
        tap_acc_year: string;
        event: string;
        amount: Prisma.Decimal;
        required_role: string;
        channel: string | null;
        two_person: boolean;
        self_allowed: boolean;
        requested_by: string;
        requested_on: Date;
        expires_on: Date | null;
        src_doc_type: string | null;
        src_doc_id: string | null;
        src_refno: string | null;
        note: string | null;
        tss_id: string | null;
        session_no: string | null;
        counter_name: string | null;
      }[]
    >`
      SELECT a.tap_id::text, a.tap_acc_year, a.tap_event_code AS event, a.tap_amount AS amount,
             a.tap_required_role AS required_role,
             COALESCE(a.tap_rule_snapshot ->> 'channel', a.tap_channel) AS channel,
             a.tap_two_person AS two_person, a.tap_self_allowed AS self_allowed,
             a.tap_requested_by::text AS requested_by, a.tap_requested_on AS requested_on,
             a.tap_expires_on AS expires_on, a.tap_src_doc_type AS src_doc_type,
             a.tap_src_doc_id::text AS src_doc_id, a.tap_src_refno AS src_refno,
             a.tap_request_note AS note, a.tap_session_id::text AS tss_id,
             s.tss_session_no AS session_no, c.tcn_name AS counter_name
        FROM accounts.till_approval a
        LEFT JOIN accounts.till_session s
               ON s.tss_id = a.tap_session_id AND s.tss_acc_year = a.tap_acc_year
        LEFT JOIN accounts.till_counter c ON c.tcn_id = a.tap_counter_id
       WHERE a.tap_company_id = ${scope.companyId}::uuid AND a.tap_branch_id = ${scope.branchId}::uuid
         AND a.tap_status = 'PENDING' AND a.tap_is_deleted = false
       ORDER BY a.tap_requested_on`;
    for (const r of requests) {
      const amount = new Prisma.Decimal(r.amount);
      items.push({
        ...blank,
        kind: 'REQUEST',
        action: 'approvals/decide',
        event: r.event,
        accYear: r.tap_acc_year,
        tapId: r.tap_id,
        tssId: r.tss_id,
        sessionNo: r.session_no,
        counterName: r.counter_name,
        amount: num(amount),
        requiredRole: r.required_role,
        channel: r.channel ?? 'EITHER',
        twoPerson: r.two_person,
        requestedBy: r.requested_by,
        requestedByName: null,
        requestedOn: r.requested_on.toISOString(),
        expiresOn: r.expires_on ? r.expires_on.toISOString() : null,
        srcDocType: r.src_doc_type,
        srcDocId: r.src_doc_id,
        srcRefno: r.src_refno,
        note: r.note,
        ...judge(r.event, amount, r.required_role, [r.requested_by], r.self_allowed),
      });
    }

    // ── sessions out of tolerance; CLOSED ones with a drawer gap left undecided
    const sessions = await this.prisma.$queryRaw<
      {
        tss_id: string;
        tss_acc_year: string;
        session_no: string;
        status: string;
        operator_id: string;
        business_date: string;
        asked_on: Date | null;
        counter_name: string | null;
        has_cash: boolean;
        amount: Prisma.Decimal;
      }[]
    >`
      SELECT s.tss_id::text, s.tss_acc_year, s.tss_session_no AS session_no, s.tss_status AS status,
             s.tss_operator_id::text AS operator_id,
             to_char(s.tss_business_date, 'YYYY-MM-DD') AS business_date,
             COALESCE(s.tss_counted_on, s.tss_closed_on) AS asked_on, c.tcn_name AS counter_name,
             bool_or(v.tvr_tender_type_id = 1) AS has_cash,
             sum(abs(v.tvr_counted - v.tvr_expected)) AS amount
        FROM accounts.till_session s
        JOIN accounts.till_variance v
          ON v.tvr_session_id = s.tss_id AND v.tvr_acc_year = s.tss_acc_year
        LEFT JOIN accounts.till_counter c ON c.tcn_id = s.tss_counter_id
       WHERE s.tss_company_id = ${scope.companyId}::uuid AND s.tss_branch_id = ${scope.branchId}::uuid
         AND s.tss_is_deleted = false
         AND v.tvr_is_deleted = false AND v.tvr_stage = 'CLOSE'
         AND v.tvr_status = 'OPEN' AND v.tvr_treatment = 'PENDING'
         AND (s.tss_status = 'PENDING_APPROVAL'
              OR (s.tss_status = 'CLOSED' AND v.tvr_slip_count IS NULL))
       GROUP BY s.tss_id, s.tss_acc_year, s.tss_session_no, s.tss_status, s.tss_operator_id,
                s.tss_business_date, s.tss_counted_on, s.tss_closed_on, c.tcn_name
       ORDER BY COALESCE(s.tss_counted_on, s.tss_closed_on) NULLS LAST`;
    for (const r of sessions) {
      const event = r.has_cash ? 'CASH_VARIANCE' : 'NONCASH_VARIANCE';
      const rule = await ruleOf(event, r.business_date);
      const amount = new Prisma.Decimal(r.amount);
      items.push({
        ...blank,
        kind: 'SESSION_VARIANCE',
        action: 'sessions/decide-variance',
        event,
        accYear: r.tss_acc_year,
        tssId: r.tss_id,
        sessionNo: r.session_no,
        counterName: r.counter_name,
        amount: figures ? num(amount) : null,
        requiredRole: rule.tar_min_role,
        channel: rule.tar_channel,
        twoPerson: rule.tar_two_person,
        requestedBy: r.operator_id,
        requestedByName: null,
        requestedOn: r.asked_on ? r.asked_on.toISOString() : null,
        afterClose: r.status === 'CLOSED',
        ...judge(event, amount, rule.tar_min_role, [r.operator_id], rule.tar_allow_self),
      });
    }

    // ── received bags' differences (notes 113)
    const received = await this.prisma.$queryRaw<
      {
        tvr_id: string;
        tvr_acc_year: string;
        amount: Prisma.Decimal;
        tcm_id: string;
        tss_id: string;
        session_no: string;
        operator_id: string;
        counter_name: string | null;
        doc_no: string | null;
        received_by: string | null;
        received_on: Date | null;
      }[]
    >`
      SELECT v.tvr_id::text, v.tvr_acc_year, abs(v.tvr_counted - v.tvr_expected) AS amount,
             m.tcm_id::text, s.tss_id::text, s.tss_session_no AS session_no,
             s.tss_operator_id::text AS operator_id, c.tcn_name AS counter_name,
             m.tcm_doc_no AS doc_no, m.tcm_received_by::text AS received_by,
             m.tcm_received_on AS received_on
        FROM accounts.till_variance v
        JOIN accounts.till_session s
          ON s.tss_id = v.tvr_session_id AND s.tss_acc_year = v.tvr_acc_year
        JOIN accounts.till_cash_movement m
          ON m.tcm_id = v.tvr_movement_id AND m.tcm_acc_year = v.tvr_acc_year
        LEFT JOIN accounts.till_counter c ON c.tcn_id = s.tss_counter_id
       WHERE v.tvr_company_id = ${scope.companyId}::uuid AND v.tvr_branch_id = ${scope.branchId}::uuid
         AND v.tvr_stage = 'RECEIVE' AND v.tvr_status = 'OPEN' AND v.tvr_treatment = 'PENDING'
         AND v.tvr_is_deleted = false
       ORDER BY m.tcm_received_on NULLS LAST`;
    if (received.length > 0) {
      const rule = await ruleOf('CASH_VARIANCE', today);
      for (const r of received) {
        const amount = new Prisma.Decimal(r.amount);
        items.push({
          ...blank,
          kind: 'RECEIVE_VARIANCE',
          action: 'sessions/decide-variance',
          event: 'CASH_VARIANCE',
          accYear: r.tvr_acc_year,
          tssId: r.tss_id,
          tcmId: r.tcm_id,
          tvrId: r.tvr_id,
          sessionNo: r.session_no,
          counterName: r.counter_name,
          amount: figures ? num(amount) : null,
          requiredRole: rule.tar_min_role,
          channel: rule.tar_channel,
          twoPerson: rule.tar_two_person,
          requestedBy: r.received_by,
          requestedByName: null,
          requestedOn: r.received_on ? r.received_on.toISOString() : null,
          srcDocType: 'TILL_MOVEMENT',
          srcDocId: r.tcm_id,
          srcRefno: r.doc_no,
          // Neither whoever received the bag nor the cashier whose bag it is.
          ...judge(
            'CASH_VARIANCE',
            amount,
            rule.tar_min_role,
            [r.received_by, r.operator_id],
            rule.tar_allow_self,
          ),
        });
      }
    }

    // ── safe gaps (notes 118): a count's, a remittance's
    const safeGaps = await this.prisma.$queryRaw<
      {
        tvr_id: string;
        tvr_acc_year: string;
        stage: string;
        amount: Prisma.Decimal;
        safe_id: string | null;
        safe_name: string | null;
        by: string | null;
        on: Date | null;
        doc_no: string | null;
      }[]
    >`
      SELECT v.tvr_id::text, v.tvr_acc_year, v.tvr_stage AS stage,
             abs(v.tvr_counted - v.tvr_expected) AS amount, v.tvr_safe_id::text AS safe_id,
             sf.tsf_name AS safe_name,
             COALESCE(ct.tct_counted_by, m.tcm_confirmed_by)::text AS by,
             COALESCE(ct.tct_counted_on, m.tcm_confirmed_on, v.tvr_created_on) AS on,
             m.tcm_doc_no AS doc_no
        FROM accounts.till_variance v
        LEFT JOIN accounts.till_safe sf ON sf.tsf_id = v.tvr_safe_id
        LEFT JOIN accounts.till_count ct
               ON v.tvr_stage = 'SAFE' AND ct.tct_id = v.tvr_count_id AND ct.tct_acc_year = v.tvr_acc_year
        LEFT JOIN accounts.till_cash_movement m
               ON v.tvr_stage = 'REMIT' AND m.tcm_id = v.tvr_movement_id AND m.tcm_acc_year = v.tvr_acc_year
       WHERE v.tvr_company_id = ${scope.companyId}::uuid AND v.tvr_branch_id = ${scope.branchId}::uuid
         AND v.tvr_stage IN ('SAFE', 'REMIT') AND v.tvr_status = 'OPEN'
         AND v.tvr_treatment = 'PENDING' AND v.tvr_is_deleted = false
       ORDER BY 8 NULLS LAST`;
    if (safeGaps.length > 0) {
      const rule = await ruleOf('SAFE_VARIANCE', today);
      for (const r of safeGaps) {
        const amount = new Prisma.Decimal(r.amount);
        items.push({
          ...blank,
          kind: 'SAFE_VARIANCE',
          action: 'safes/decide-variance',
          event: 'SAFE_VARIANCE',
          accYear: r.tvr_acc_year,
          tvrId: r.tvr_id,
          safeId: r.safe_id,
          safeName: r.safe_name,
          amount: figures ? num(amount) : null,
          requiredRole: rule.tar_min_role,
          channel: rule.tar_channel,
          twoPerson: rule.tar_two_person,
          requestedBy: r.by,
          requestedByName: null,
          requestedOn: r.on ? r.on.toISOString() : null,
          srcDocType: r.stage === 'REMIT' ? 'TILL_MOVEMENT' : 'TILL_COUNT',
          srcRefno: r.doc_no,
          // Notes 118: a safe gap judges nobody else's cash — no self rule.
          ...judge('SAFE_VARIANCE', amount, rule.tar_min_role, [], true),
        });
      }
    }

    const names = await this.namesOf(items.map((i) => i.requestedBy));
    for (const item of items) {
      item.requestedByName = item.requestedBy ? (names.get(item.requestedBy) ?? null) : null;
    }
    return { items, expired };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  internals
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The approver's verdict (assertApprover: self, grant, ceiling, channel —
   * a wrong PIN journalled PIN_FAIL outside any transaction) and, for a
   * two-person rule being approved, the second signature by PIN.
   */
  private async judge(ask: {
    scope: { companyId: string; branchId: string };
    accYear: string;
    caller: TillCaller;
    event: string;
    amount: Prisma.Decimal;
    rule: TillApprovalRuleRow;
    selfAllowed: boolean;
    approverId: string;
    requesterId: string;
    pin: string | null;
    secondId: string | null;
    secondPin: string | null;
    approve: boolean;
    action: string;
  }): Promise<{ verdict: ApproverVerdict; secondOn: Date | null }> {
    const secondId = ask.secondId?.trim() || null;
    const secondOn =
      ask.approve && ask.rule.tar_two_person && secondId
        ? await this.provePerson({ ...ask, userId: secondId })
        : null;
    try {
      const verdict = await this.approval.assertApprover(this.prisma, {
        companyId: ask.scope.companyId,
        branchId: ask.scope.branchId,
        event: ask.event,
        amount: ask.amount,
        rule: { ...ask.rule, tar_allow_self: ask.selfAllowed },
        approverId: ask.approverId,
        requesterId: ask.requesterId,
        pin: ask.pin,
        second: ask.rule.tar_two_person ? (secondId ? { userId: secondId } : null) : undefined,
      });
      return { verdict, secondOn };
    } catch (error: unknown) {
      if (ask.pin?.trim() && tillErrorCodeOf(error) === TillErrorCode.APPROVER_PIN) {
        await this.events.log(this.prisma, {
          companyId: ask.scope.companyId,
          branchId: ask.scope.branchId,
          accYear: ask.accYear,
          code: TillEventCode.PIN_FAIL,
          deviceId: ask.caller.deviceId,
          userId: ask.caller.userId,
          payload: { action: ask.action, event: ask.event, approverId: ask.approverId },
        });
      }
      throw error;
    }
  }

  /** A second signature: an active user other than the caller, by their till PIN (as notes 118's). */
  private async provePerson(ask: {
    userId: string;
    secondPin: string | null;
    caller: TillCaller;
    approverId: string;
    scope: { companyId: string; branchId: string };
    accYear: string;
    action: string;
  }): Promise<Date> {
    if (ask.userId === ask.caller.userId || ask.userId === ask.approverId) {
      throwTill(
        TillErrorCode.APPROVER_SECOND,
        'The second signature is another person than the one deciding',
        'secondId',
      );
    }
    const user = await this.prisma.userMaster.findFirst({
      where: { usrId: ask.userId, usrIsActive: true, usrIsDeleted: false },
      select: { usrLoginName: true, usrPinHash: true },
    });
    if (!user) {
      throwTill(TillErrorCode.APPROVER_SECOND, 'The second signature is not an active user', 'secondId');
    }
    if (!user.usrPinHash) {
      throwTill(
        TillErrorCode.WITNESS_NO_PIN,
        `${user.usrLoginName} has no till PIN: an administrator sets one in User Administration (menu 58)`,
        'secondPin',
      );
    }
    const pin = ask.secondPin?.trim() || null;
    if (pin === null) {
      throwTill(
        TillErrorCode.WITNESS_PIN_REQUIRED,
        `${user.usrLoginName} signs with their till PIN`,
        'secondPin',
      );
    }
    if (!(await verifySecret(pin, user.usrPinHash))) {
      await this.events.log(this.prisma, {
        companyId: ask.scope.companyId,
        branchId: ask.scope.branchId,
        accYear: ask.accYear,
        code: TillEventCode.PIN_FAIL,
        deviceId: ask.caller.deviceId,
        userId: ask.caller.userId,
        payload: { action: ask.action, secondId: ask.userId },
      });
      throwTill(TillErrorCode.WITNESS_PIN, `${user.usrLoginName}'s till PIN is wrong`, 'secondPin');
    }
    return new Date();
  }

  /** The decision written: status, who, how, the second signature; APPROVAL_DECIDED. */
  private async decideIn(
    tx: Tx,
    row: TillApproval,
    d: {
      decision: 'APPROVE' | 'REJECT';
      note: string;
      caller: TillCaller;
      verdict: ApproverVerdict;
      secondOn: Date | null;
    },
  ): Promise<void> {
    const now = new Date();
    const status = d.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const second = d.decision === 'APPROVE' ? d.verdict.secondBy : null;
    await tx.tillApproval.update({
      where: { tapId_tapAccYear: { tapId: row.tapId, tapAccYear: row.tapAccYear } },
      data: {
        tapStatus: status,
        tapDecidedBy: d.caller.userId,
        tapDecidedOn: now,
        tapDecidedDeviceId: d.caller.deviceId,
        tapDecisionNote: d.note.slice(0, 500),
        tapChannel: d.verdict.channel,
        tapSecondBy: second,
        tapSecondOn: second ? (d.secondOn ?? now) : null,
        tapRuleSnapshot: {
          ...((row.tapRuleSnapshot ?? {}) as Record<string, unknown>),
          approver: {
            role: d.verdict.role,
            grantId: d.verdict.grantId,
            implicit: d.verdict.implicit,
            secondBy: second,
          },
        } as Prisma.InputJsonValue,
        tapModifiedOn: now,
      },
    });
    // An opening float difference posts at once (notes 98 b); its approval,
    // given after, is recorded on the variance.
    const snapshot = (row.tapRuleSnapshot ?? {}) as Record<string, unknown>;
    if (status === 'APPROVED' && typeof snapshot.tvrId === 'string') {
      await tx.tillVariance.updateMany({
        where: { tvrId: snapshot.tvrId, tvrAccYear: row.tapAccYear, tvrApprovalId: null },
        data: { tvrApprovalId: row.tapId, tvrModifiedOn: now, tvrModifiedBy: d.caller.actorName },
      });
    }
    await this.logDecision(tx, row, d.caller, {
      status,
      note: d.note,
      approverRole: d.verdict.role,
      channel: d.verdict.channel,
      implicitGrant: d.verdict.implicit,
      grantId: d.verdict.grantId,
      secondBy: second,
    });
  }

  private async logDecision(
    tx: Tx,
    row: TillApproval,
    caller: TillCaller,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.events.log(tx, {
      companyId: row.tapCompanyId,
      branchId: row.tapBranchId,
      accYear: row.tapAccYear,
      code: TillEventCode.APPROVAL_DECIDED,
      sessionId: row.tapSessionId,
      counterId: row.tapCounterId,
      deviceId: caller.deviceId,
      userId: caller.userId,
      srcDocType: row.tapSrcDocType,
      srcDocId: row.tapSrcDocId,
      srcRefno: row.tapSrcRefno,
      amount: row.tapAmount,
      reasonId: row.tapReasonId,
      approvalId: row.tapId,
      payload: { event: row.tapEventCode, ...payload } as Prisma.InputJsonValue,
    });
  }

  /** The request, PENDING and not past its expiry (swept to EXPIRED here, 409 then). */
  private async pendingRow(key: ApprovalKey): Promise<TillApproval> {
    const tap = await this.prisma.tillApproval.findFirst({
      where: {
        tapId: key.tapId,
        tapAccYear: key.accYear,
        tapCompanyId: key.companyId,
        tapBranchId: key.branchId,
        tapIsDeleted: false,
      },
    });
    if (!tap) {
      throwTillNotFound(TillErrorCode.APPROVAL_NOT_FOUND, 'Approval request', 'tapId', key.tapId);
    }
    if (tap.tapStatus === 'PENDING' && tap.tapExpiresOn && tap.tapExpiresOn < new Date()) {
      await this.sweep(key, await this.context.caller());
      throwTill(
        TillErrorCode.APPROVAL_EXPIRED,
        `The approval request ran out at ${tap.tapExpiresOn.toISOString()} before anyone decided it: ask again`,
        'tapId',
        { status: 'EXPIRED' },
      );
    }
    if (tap.tapStatus !== 'PENDING') {
      this.throwNotPending(tap);
    }
    return tap;
  }

  private throwNotPending(tap: TillApproval): never {
    throwTill(
      TillErrorCode.APPROVAL_NOT_PENDING,
      `The approval request is ${tap.tapStatus}: only a PENDING one is decided or cancelled`,
      'tapId',
      { status: tap.tapStatus },
    );
  }

  private async lockRow(tx: Tx, key: ApprovalKey): Promise<TillApproval> {
    await tx.$queryRaw`
      SELECT tap_id FROM accounts.till_approval
       WHERE tap_id = ${key.tapId}::uuid AND tap_acc_year = ${key.accYear}::char(9)
       FOR UPDATE`;
    return tx.tillApproval.findUniqueOrThrow({
      where: { tapId_tapAccYear: { tapId: key.tapId, tapAccYear: key.accYear } },
    });
  }

  /** PENDING requests of the branch past their expiry → EXPIRED, one APPROVAL_EXPIRED each. */
  private async sweep(
    scope: { companyId: string; branchId: string },
    caller: TillCaller,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          tap_id: string;
          tap_acc_year: string;
          event: string;
          session_id: string | null;
          counter_id: string | null;
          amount: Prisma.Decimal;
        }[]
      >`
        UPDATE accounts.till_approval
           SET tap_status = 'EXPIRED', tap_modified_on = now()
         WHERE tap_company_id = ${scope.companyId}::uuid AND tap_branch_id = ${scope.branchId}::uuid
           AND tap_status = 'PENDING' AND tap_is_deleted = false
           AND tap_expires_on IS NOT NULL AND tap_expires_on < now()
        RETURNING tap_id::text, tap_acc_year, tap_event_code AS event,
                  tap_session_id::text AS session_id, tap_counter_id::text AS counter_id,
                  tap_amount AS amount`;
      for (const r of rows) {
        await this.events.log(tx, {
          companyId: scope.companyId,
          branchId: scope.branchId,
          accYear: r.tap_acc_year,
          code: TillEventCode.APPROVAL_EXPIRED,
          sessionId: r.session_id,
          counterId: r.counter_id,
          deviceId: caller.deviceId,
          userId: caller.userId,
          amount: r.amount,
          approvalId: r.tap_id,
          payload: { event: r.event },
        });
      }
      return rows.length;
    });
  }

  private async namesOf(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) {
      return new Map();
    }
    const users = await this.prisma.userMaster.findMany({
      where: { usrId: { in: wanted } },
      select: { usrId: true, usrLoginName: true, usrDisplayName: true },
    });
    return new Map(users.map((u) => [u.usrId, u.usrDisplayName?.trim() || u.usrLoginName]));
  }
}

export type { ApproverGrants };
