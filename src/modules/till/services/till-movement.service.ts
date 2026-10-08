import { Injectable } from '@nestjs/common';
import { Prisma, type TillSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService, type TillCaller } from '../till-context.service';
import { isoDateOf } from '../till-dates';
import { throwTill, throwTillNotFound } from '../till-errors';
import { TillLedgerService } from './till-ledger.service';
import { TillPostingService, type PostingSession } from './till-posting.service';
import { TillSessionService } from './till-session.service';
import {
  CASH_TENDER_TYPE_ID,
  CASHIER_MOVEMENTS,
  SUPERVISOR_MOVEMENTS,
  TillCountKind,
  TillErrorCode,
  TillMovementKind,
  TillSessionStatus,
  VOIDABLE_MOVEMENTS,
} from '../types/till-enum';
import type { TillCountLineInput, TillMovementDetailPayload } from '../types/till-api.types';

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);
const num = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v.toFixed(2)) : 0);

/** A drawer that has started being counted takes no movement and loses none. */
const MOVABLE_STATUSES: readonly TillSessionStatus[] = [
  TillSessionStatus.OPEN,
  TillSessionStatus.SUSPENDED,
];

/** REV 2 §2.8: a movement is voided while its session is OPEN, SUSPENDED or COUNTING. */
const VOIDABLE_STATUSES: readonly TillSessionStatus[] = [
  TillSessionStatus.OPEN,
  TillSessionStatus.SUSPENDED,
  TillSessionStatus.COUNTING,
];

/** The reason category each kind's reason must be in (47 §1.4); null = no reason asked. */
const REASON_CATEGORY: Partial<Record<TillMovementKind, string>> = {
  [TillMovementKind.PICKUP]: 'PICKUP',
  [TillMovementKind.PAID_IN]: 'PAID_IN',
};

export interface CreateMovementInput {
  companyId: string;
  branchId: string;
  accYear: string;
  tssId: string;
  kind: TillMovementKind;
  amount?: number | null;
  /** Cash by denomination: what moved (PICKUP, TOP_UP), what came IN (EXCHANGE). */
  lines: TillCountLineInput[];
  /** EXCHANGE: what went OUT of the drawer. */
  outLines: TillCountLineInput[];
  reasonId?: string | null;
  ledgerId?: string | null;
  refNo?: string | null;
  refDate?: string | null;
  partyName?: string | null;
  bagNo?: string | null;
  sealNo?: string | null;
  witnessBy?: string | null;
  notes?: string | null;
}

/**
 * Every non-sale movement of money through a drawer (§5, build phase 2): the
 * documents behind the F11 till menu, each with its accounting voucher (D6).
 *
 *   DROP      the cashier drops a sealed bag into the safe     TDrp  Dr safe / Cr till cash
 *   PAID_IN   money in that is not a sale (scrap, staff refund) TPIn  Dr till cash / Cr ledger
 *   EXCHANGE  notes changed with the safe, counted both ways   —     nothing to book
 *   PICKUP    a SUPERVISOR takes cash, the cashier witnesses    TDrp  Dr safe / Cr till cash
 *   TOP_UP    a SUPERVISOR brings change                        TFlt  Dr till cash / Cr safe
 *
 * PAID_OUT is not here: 48 moved an expense to the expense voucher (ExpV) and
 * a supplier to a bill-wise Payment. Only a session still taking money (OPEN /
 * SUSPENDED) moves cash; once it is being counted the expectation is frozen.
 *
 * The approvals the shipped rules ask for (PICKUP / TOP_UP / MOVEMENT_VOID
 * ALWAYS, a supervisor) are met in phase 2 by WHO calls: the supervisor
 * movements and the void need Till Sessions (273) OVERRIDE, checked by the
 * controller. Phase 3's gate writes the till_approval row behind each.
 */
@Injectable()
export class TillMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly ledger: TillLedgerService,
    private readonly posting: TillPostingService,
    private readonly sessions: TillSessionService,
  ) {}

  async create(input: CreateMovementInput): Promise<TillMovementDetailPayload> {
    const caller = await this.context.caller();
    if (!CASHIER_MOVEMENTS.includes(input.kind) && !SUPERVISOR_MOVEMENTS.includes(input.kind)) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        `${input.kind} is not posted by hand (the open issues the float, the close hands over, the cash office remits)`,
        'kind',
      );
    }
    const supervisorKind = SUPERVISOR_MOVEMENTS.includes(input.kind);

    const tcmId = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, input);
      if (!supervisorKind) {
        this.assertOperator(session, caller);
      }

      // ── who handles it, who signs for it ─────────────────────────────
      let witnessBy: string | null = input.witnessBy ?? null;
      if (input.kind === TillMovementKind.PICKUP) {
        // "The supervisor takes the cash, the cashier signs for it" (§5.6).
        witnessBy = witnessBy ?? session.tssOperatorId;
        if (witnessBy === caller.userId) {
          throwTill(
            TillErrorCode.MOVEMENT_INVALID,
            'A pickup is two people — the supervisor taking it and the cashier signing for it. One person moves cash to the safe with a DROP.',
            'witnessBy',
          );
        }
      } else if (witnessBy === caller.userId) {
        witnessBy = null;
      }

      // ── the amount, from the denominations when they are given ────────
      if (input.kind === TillMovementKind.DROP && input.lines.length > 0) {
        throwTill(
          TillErrorCode.MOVEMENT_INVALID,
          'A drop is a sealed bag: declare its amount; the cash office counts it when it verifies the bag',
          'lines',
        );
      }
      if (input.kind !== TillMovementKind.EXCHANGE && input.outLines.length > 0) {
        throwTill(
          TillErrorCode.MOVEMENT_INVALID,
          'Only an exchange counts what went out',
          'outLines',
        );
      }
      this.assertCashLines(input.lines, 'lines');
      this.assertCashLines(input.outLines, 'outLines');
      const inLines = await this.sessions.priceLines(tx, input.companyId, input.lines);
      const outLines = await this.sessions.priceLines(tx, input.companyId, input.outLines);
      const inTotal = inLines.reduce((s, l) => s.plus(l.amount), ZERO);
      const outTotal = outLines.reduce((s, l) => s.plus(l.amount), ZERO);
      let amount: Prisma.Decimal;
      if (input.kind === TillMovementKind.EXCHANGE) {
        if (inLines.length === 0 || outLines.length === 0 || !inTotal.equals(outTotal)) {
          throwTill(
            TillErrorCode.MOVEMENT_INVALID,
            'An exchange counts both sides, and what comes in equals what goes out',
            'outLines',
          );
        }
        amount = inTotal;
      } else if (inLines.length > 0) {
        amount = inTotal;
        if (input.amount !== undefined && input.amount !== null && !amount.equals(input.amount)) {
          throwTill(
            TillErrorCode.MOVEMENT_INVALID,
            `The amount (${input.amount}) is not what the denominations add up to (${amount.toFixed(2)})`,
            'amount',
          );
        }
      } else {
        amount = new Prisma.Decimal(input.amount ?? 0);
      }
      if (!amount.greaterThan(0)) {
        throwTill(TillErrorCode.MOVEMENT_INVALID, 'A movement moves more than nothing', 'amount');
      }

      // ── the reason (ck_tcm_reason: PAID_IN / PICKUP must name one) ────
      const reason = await this.loadReason(tx, input, amount);

      // ── the other side: the safe, or the paid-in's ledger ────────────
      const counter = await tx.tillCounter.findUniqueOrThrow({
        where: { tcnId: session.tssCounterId },
      });
      const safe =
        input.kind === TillMovementKind.PAID_IN
          ? null
          : await this.ledger.safeFor(tx, {
              companyId: input.companyId,
              branchId: input.branchId,
              counterSafeId: counter.tcnSafeId,
            });
      if (input.kind !== TillMovementKind.PAID_IN && !safe) {
        throwTill(
          TillErrorCode.SAFE_MISSING,
          `A ${input.kind.toLowerCase().replace('_', ' ')} moves cash to or from a safe, and this branch has none (Till Masters, menu 275)`,
          'kind',
        );
      }
      let ledgerId: string | null = null;
      if (input.kind === TillMovementKind.PAID_IN) {
        ledgerId = input.ledgerId ?? reason?.trsLedgerId ?? null;
        if (!ledgerId) {
          throwTill(
            TillErrorCode.MOVEMENT_INVALID,
            'A paid-in names the ledger the money comes from (or a reason that has one)',
            'ledgerId',
          );
        }
        await this.assertLedger(tx, ledgerId, input.companyId);
      }

      // ── the counts, then the movement and its voucher ────────────────
      const tcmIdDrawn = await this.newId(tx);
      const deviceId = caller.deviceId ?? session.tssDeviceId;
      let countId: string | null = null;
      if (inLines.length > 0) {
        countId = await this.sessions.writeMovementCount(tx, session, {
          kind:
            input.kind === TillMovementKind.PICKUP
              ? TillCountKind.PICKUP
              : TillCountKind.FLOAT_ISSUE,
          lines: inLines,
          safeId: safe?.safeId ?? null,
          movementId: tcmIdDrawn,
          caller,
          deviceId,
          witnessBy,
        });
      }
      if (outLines.length > 0) {
        await this.sessions.writeMovementCount(tx, session, {
          kind: TillCountKind.PICKUP,
          lines: outLines,
          safeId: safe?.safeId ?? null,
          movementId: tcmIdDrawn,
          caller,
          deviceId,
          witnessBy,
        });
      }
      const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
      const posted = await this.posting.postMovement(tx, {
        session: this.postingSession(session),
        kind: input.kind,
        amount,
        safe,
        ledgerId,
        tillCash,
        caller,
        tcmId: tcmIdDrawn,
        doneBy: caller.userId,
        witnessBy,
        reasonId: reason?.trsId ?? null,
        refNo: input.refNo ?? null,
        refDate: input.refDate ?? null,
        partyName: input.partyName ?? null,
        bagNo: input.bagNo ?? null,
        sealNo: input.sealNo ?? null,
        countId,
        notes: input.notes ?? null,
        deviceId,
      });
      return posted.tcmId;
    });

    return this.get({
      companyId: input.companyId,
      branchId: input.branchId,
      accYear: input.accYear,
      tcmId,
    });
  }

  /**
   * REV 2 §2.14 — "Change from C02": change carried from one counter to
   * another, in ONE call, as the PAIR the books already know: a PICKUP on
   * the giving session (TDrp, its cashier witnessing) and a TOP_UP on the
   * receiving one (TFlt). There is no till-to-till movement — every rupee
   * passes the safe book, through each counter's own safe. A supervisor's
   * (Till Sessions OVERRIDE, checked by the controller); both sessions must
   * still take money; the pickup names a PICKUP reason, as every pickup does.
   */
  async change(input: {
    companyId: string;
    branchId: string;
    accYear: string;
    fromTssId: string;
    toTssId: string;
    lines: TillCountLineInput[];
    reasonId: string;
    notes?: string | null;
  }): Promise<{ from: TillMovementDetailPayload; to: TillMovementDetailPayload }> {
    const caller = await this.context.caller();
    if (input.fromTssId === input.toTssId) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        'Change goes from one counter to ANOTHER',
        'toTssId',
      );
    }
    if (input.lines.length === 0) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        'Count the change that moves, by denomination',
        'lines',
      );
    }
    this.assertCashLines(input.lines, 'lines');

    const ids = await this.prisma.$transaction(async (tx) => {
      // Locked in id order: two supervisors carrying change both ways cannot deadlock.
      const keys = [input.fromTssId, input.toTssId].sort();
      const locked = new Map<string, TillSession>();
      for (const tssId of keys) {
        locked.set(
          tssId,
          await this.lockSession(tx, {
            companyId: input.companyId,
            branchId: input.branchId,
            accYear: input.accYear,
            tssId,
          }),
        );
      }
      const from = locked.get(input.fromTssId)!;
      const to = locked.get(input.toTssId)!;
      if (from.tssOperatorId === caller.userId) {
        throwTill(
          TillErrorCode.MOVEMENT_INVALID,
          'The cashier giving the change witnesses it; the supervisor carrying it must be someone else',
          'fromTssId',
        );
      }

      const priced = await this.sessions.priceLines(tx, input.companyId, input.lines);
      const amount = priced.reduce((s, l) => s.plus(l.amount), ZERO);
      if (!amount.greaterThan(0)) {
        throwTill(TillErrorCode.MOVEMENT_INVALID, 'Change of nothing moves nothing', 'lines');
      }
      const reason = await this.loadReason(
        tx,
        { ...input, kind: TillMovementKind.PICKUP, tssId: input.fromTssId, outLines: [] },
        amount,
      );
      const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
      const safeOf = async (session: TillSession) => {
        const counter = await tx.tillCounter.findUniqueOrThrow({
          where: { tcnId: session.tssCounterId },
        });
        const safe = await this.ledger.safeFor(tx, {
          companyId: input.companyId,
          branchId: input.branchId,
          counterSafeId: counter.tcnSafeId,
        });
        if (!safe) {
          throwTill(
            TillErrorCode.SAFE_MISSING,
            'Change between counters passes the safe, and this branch has none (Till Masters, menu 275)',
            'fromTssId',
          );
        }
        return { safe, code: counter.tcnCode };
      };
      const giving = await safeOf(from);
      const taking = await safeOf(to);
      const deviceId = caller.deviceId ?? from.tssDeviceId;

      const pickupId = await this.newId(tx);
      const pickupCount = await this.sessions.writeMovementCount(tx, from, {
        kind: TillCountKind.PICKUP,
        lines: priced,
        safeId: giving.safe.safeId,
        movementId: pickupId,
        caller,
        deviceId,
        witnessBy: from.tssOperatorId,
      });
      await this.posting.postMovement(tx, {
        session: this.postingSession(from),
        kind: TillMovementKind.PICKUP,
        amount,
        safe: giving.safe,
        tillCash,
        caller,
        tcmId: pickupId,
        doneBy: caller.userId,
        witnessBy: from.tssOperatorId,
        reasonId: reason!.trsId,
        countId: pickupCount,
        notes: input.notes ?? `Change to ${taking.code} (${to.tssSessionNo})`,
        deviceId,
      });

      const topUpId = await this.newId(tx);
      const topUpCount = await this.sessions.writeMovementCount(tx, to, {
        kind: TillCountKind.FLOAT_ISSUE,
        lines: priced,
        safeId: taking.safe.safeId,
        movementId: topUpId,
        caller,
        deviceId,
        witnessBy: to.tssOperatorId === caller.userId ? null : to.tssOperatorId,
      });
      await this.posting.postMovement(tx, {
        session: this.postingSession(to),
        kind: TillMovementKind.TOP_UP,
        amount,
        safe: taking.safe,
        tillCash,
        caller,
        tcmId: topUpId,
        doneBy: caller.userId,
        witnessBy: to.tssOperatorId === caller.userId ? null : to.tssOperatorId,
        countId: topUpCount,
        notes: input.notes ?? `Change from ${giving.code} (${from.tssSessionNo})`,
        deviceId,
      });
      return { pickupId, topUpId };
    });

    const key = { companyId: input.companyId, branchId: input.branchId, accYear: input.accYear };
    return {
      from: await this.get({ ...key, tcmId: ids.pickupId }),
      to: await this.get({ ...key, tcmId: ids.topUpId }),
    };
  }

  /** One movement with its counts — what the slip prints (§9 TILL_MOVEMENT). */
  async get(key: {
    companyId: string;
    branchId: string;
    accYear: string;
    tcmId: string;
  }): Promise<TillMovementDetailPayload> {
    const m = await this.prisma.tillCashMovement.findFirst({
      where: {
        tcmId: key.tcmId,
        tcmAccYear: key.accYear,
        tcmCompanyId: key.companyId,
        tcmBranchId: key.branchId,
        tcmIsDeleted: false,
      },
      include: {
        reason: { select: { trsCode: true, trsName: true } },
        safe: { select: { tsfName: true } },
      },
    });
    if (!m) {
      throwTillNotFound('Till movement', 'tcmId', key.tcmId);
    }
    const counts = await this.prisma.tillCount.findMany({
      where: { tctMovementId: m.tcmId, tctAccYear: m.tcmAccYear, tctIsDeleted: false },
      include: { lines: { orderBy: { tclRowNo: 'asc' } } },
      orderBy: { tctCreatedOn: 'asc' },
    });
    const session = m.tcmSessionId
      ? await this.prisma.tillSession.findUnique({
          where: { tssId_tssAccYear: { tssId: m.tcmSessionId, tssAccYear: m.tcmAccYear } },
          select: { tssSessionNo: true, tssOperatorId: true },
        })
      : null;
    return {
      tcmId: m.tcmId,
      tcmAccYear: m.tcmAccYear,
      tcmKind: m.tcmKind as TillMovementKind,
      tcmDocNo: m.tcmDocNo,
      tcmDocDate: isoDateOf(m.tcmDocDate),
      tcmAmount: num(m.tcmAmount),
      tcmSafeId: m.tcmSafeId,
      safeName: m.safe?.tsfName ?? null,
      tcmVoucherId: m.tcmVoucherId,
      tcmStatus: m.tcmStatus as 'POSTED' | 'VOIDED',
      tcmCreatedOn: m.tcmCreatedOn.toISOString(),
      tcmSessionId: m.tcmSessionId,
      sessionNo: session?.tssSessionNo ?? null,
      sessionOperatorId: session?.tssOperatorId ?? null,
      tcmLedgerId: m.tcmLedgerId,
      tcmReasonId: m.tcmReasonId,
      reasonCode: m.reason?.trsCode ?? null,
      reasonName: m.reason?.trsName ?? null,
      tcmRefNo: m.tcmRefNo,
      tcmRefDate: m.tcmRefDate ? isoDateOf(m.tcmRefDate) : null,
      tcmPartyName: m.tcmPartyName,
      tcmBagNo: m.tcmBagNo,
      tcmSealNo: m.tcmSealNo,
      tcmDoneBy: m.tcmDoneBy,
      tcmWitnessBy: m.tcmWitnessBy,
      tcmVoidedOn: m.tcmVoidedOn?.toISOString() ?? null,
      tcmVoidedBy: m.tcmVoidedBy,
      tcmVoidReasonId: m.tcmVoidReasonId,
      tcmNotes: m.tcmNotes,
      counts: counts.map((c) => ({
        tctId: c.tctId,
        tctKind: c.tctKind as TillCountKind,
        tctTotalCounted: num(c.tctTotalCounted),
        lines: c.lines.map((l) => ({
          tenderTypeId: l.tclTenderTypeId,
          denominationId: l.tclDenominationId,
          faceValue: num(l.tclFaceValue),
          qty: Number(l.tclQty),
          amount: num(l.tclAmount),
        })),
      })),
    };
  }

  /**
   * MOVEMENT_VOID — keyed wrong, or twice: the voucher mirrored, the row
   * VOIDED with its reason (category MOVEMENT_VOID). Only while the drawer
   * still takes money; a counted drawer is corrected by its variance.
   */
  async void(input: {
    companyId: string;
    branchId: string;
    accYear: string;
    tcmId: string;
    reasonId: string;
    notes?: string | null;
  }): Promise<TillMovementDetailPayload> {
    const caller = await this.context.caller();
    await this.prisma.$transaction(async (tx) => {
      const movement = await tx.tillCashMovement.findFirst({
        where: {
          tcmId: input.tcmId,
          tcmAccYear: input.accYear,
          tcmCompanyId: input.companyId,
          tcmBranchId: input.branchId,
          tcmIsDeleted: false,
        },
      });
      if (!movement) {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_FOUND,
          `Till movement ${input.tcmId} was not found`,
          'tcmId',
        );
      }
      if (!movement.tcmSessionId) {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_VOIDABLE,
          'A cash-office movement is not voided here',
          'tcmId',
        );
      }
      const session = await this.lockSession(
        tx,
        {
          companyId: input.companyId,
          branchId: input.branchId,
          accYear: movement.tcmAccYear,
          tssId: movement.tcmSessionId,
        },
        VOIDABLE_STATUSES,
      );
      // REV 2 §2.8: COUNTING is still live — until a count is FINAL, whose
      // variances were frozen against the movement as it stood.
      if (session.tssCloseCountId) {
        throwTill(
          TillErrorCode.MOVEMENT_SESSION_CLOSED,
          `Session ${session.tssSessionNo} has a final count: correct it with a new movement in the current session, or reopen`,
          'tcmId',
        );
      }
      // Re-read under the session's lock: a void racing another void finds it VOIDED.
      const fresh = await tx.tillCashMovement.findUniqueOrThrow({
        where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
      });
      if (fresh.tcmStatus !== 'POSTED') {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_VOIDABLE,
          `Movement ${fresh.tcmDocNo} is already ${fresh.tcmStatus}`,
          'tcmId',
        );
      }
      if (!VOIDABLE_MOVEMENTS.includes(fresh.tcmKind as TillMovementKind)) {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_VOIDABLE,
          `A ${fresh.tcmKind} is the session's own (its open or its close) and is not voided`,
          'tcmId',
        );
      }
      const reason = await tx.tillReason.findFirst({
        where: {
          trsId: input.reasonId,
          trsIsDeleted: false,
          trsIsActive: true,
          trsCategory: 'MOVEMENT_VOID',
          OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
        },
      });
      if (!reason) {
        throwTill(
          TillErrorCode.REASON_INVALID,
          'A void names an active MOVEMENT_VOID reason',
          'reasonId',
        );
      }
      if (reason.trsNeedsNote && !input.notes?.trim()) {
        throwTill(TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
      }
      await this.posting.voidMovement(tx, {
        movement: fresh,
        session: this.postingSession(session),
        reasonId: reason.trsId,
        reasonText: input.notes?.trim()
          ? `${reason.trsName} — ${input.notes.trim()}`
          : reason.trsName,
        caller,
      });
    });
    return this.get({
      companyId: input.companyId,
      branchId: input.branchId,
      accYear: input.accYear,
      tcmId: input.tcmId,
    });
  }

  /** The session's operator, for the read rule (own movement 272 VIEW, others' 273 VIEW). */
  async operatorOf(key: {
    companyId: string;
    branchId: string;
    accYear: string;
    tcmId: string;
  }): Promise<string | null> {
    const m = await this.prisma.tillCashMovement.findFirst({
      where: {
        tcmId: key.tcmId,
        tcmAccYear: key.accYear,
        tcmCompanyId: key.companyId,
        tcmBranchId: key.branchId,
      },
      select: { tcmSessionId: true, tcmAccYear: true },
    });
    if (!m) {
      throwTill(
        TillErrorCode.MOVEMENT_NOT_FOUND,
        `Till movement ${key.tcmId} was not found`,
        'tcmId',
      );
    }
    if (!m.tcmSessionId) {
      return null;
    }
    const s = await this.prisma.tillSession.findUnique({
      where: { tssId_tssAccYear: { tssId: m.tcmSessionId, tssAccYear: m.tcmAccYear } },
      select: { tssOperatorId: true },
    });
    return s?.tssOperatorId ?? null;
  }

  // ═════════════════════════════════════════════════════════════════════════

  private async lockSession(
    tx: Tx,
    key: { companyId: string; branchId: string; accYear: string; tssId: string },
    statuses: readonly TillSessionStatus[] = MOVABLE_STATUSES,
  ): Promise<TillSession> {
    const locked = await tx.$queryRaw<{ tss_id: string }[]>`
      SELECT tss_id FROM accounts.till_session
       WHERE tss_id = ${key.tssId}::uuid AND tss_acc_year = ${key.accYear}::char(9)
         AND tss_company_id = ${key.companyId}::uuid AND tss_branch_id = ${key.branchId}::uuid
         AND tss_is_deleted = false
       FOR UPDATE`;
    if (locked.length === 0) {
      throwTillNotFound('Till session', 'tssId', key.tssId);
    }
    const session = await tx.tillSession.findUniqueOrThrow({
      where: { tssId_tssAccYear: { tssId: key.tssId, tssAccYear: key.accYear } },
    });
    if (!statuses.includes(session.tssStatus as TillSessionStatus)) {
      throwTill(
        statuses === VOIDABLE_STATUSES
          ? TillErrorCode.MOVEMENT_SESSION_CLOSED
          : TillErrorCode.SESSION_NOT_OPEN,
        `Session ${session.tssSessionNo} is ${session.tssStatus}: its drawer is being counted and moves no cash`,
        'tssId',
        { status: session.tssStatus },
      );
    }
    return session;
  }

  /** A cashier's movement: the session's own cashier, at its own counter. */
  private assertOperator(session: TillSession, caller: TillCaller): void {
    if (session.tssOperatorId !== caller.userId) {
      throwTill(
        TillErrorCode.SESSION_NOT_YOURS,
        `Session ${session.tssSessionNo} belongs to another cashier`,
        'tssId',
      );
    }
    if (caller.deviceId !== session.tssDeviceId) {
      throwTill(
        TillErrorCode.SESSION_WRONG_DEVICE,
        `Session ${session.tssSessionNo} moves cash only from the device it was opened on`,
        'tssId',
      );
    }
  }

  private assertCashLines(lines: TillCountLineInput[], field: string): void {
    lines.forEach((line, i) => {
      if (line.tenderTypeId !== CASH_TENDER_TYPE_ID) {
        throwTill(
          TillErrorCode.MOVEMENT_INVALID,
          'A drawer movement is cash',
          `${field}.${i}.tenderTypeId`,
        );
      }
    });
  }

  private async loadReason(tx: Tx, input: CreateMovementInput, amount: Prisma.Decimal) {
    const category = REASON_CATEGORY[input.kind] ?? null;
    if (!input.reasonId) {
      if (category) {
        throwTill(
          TillErrorCode.REASON_INVALID,
          `A ${input.kind.toLowerCase().replace('_', ' ')} names a ${category} reason`,
          'reasonId',
        );
      }
      return null;
    }
    const reason = await tx.tillReason.findFirst({
      where: {
        trsId: input.reasonId,
        trsIsDeleted: false,
        trsIsActive: true,
        OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
      },
    });
    if (!reason || (category && reason.trsCategory !== category)) {
      throwTill(
        TillErrorCode.REASON_INVALID,
        category ? `The reason must be an active ${category} reason` : 'Unknown or inactive reason',
        'reasonId',
      );
    }
    if (reason.trsNeedsNote && !input.notes?.trim()) {
      throwTill(TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
    }
    if (reason.trsNeedsRef && !input.refNo?.trim()) {
      throwTill(
        TillErrorCode.REASON_INVALID,
        `“${reason.trsName}” needs a reference number`,
        'refNo',
      );
    }
    const cap = new Prisma.Decimal(reason.trsMaxAmount);
    if (cap.greaterThan(0) && amount.greaterThan(cap)) {
      throwTill(
        TillErrorCode.REASON_INVALID,
        `“${reason.trsName}” is capped at ${cap.toFixed(2)}`,
        'amount',
      );
    }
    return reason;
  }

  private async assertLedger(tx: Tx, ledgerId: string, companyId: string): Promise<void> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: {
        ledId: ledgerId,
        ledIsDeleted: false,
        OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
      },
      select: { ledId: true },
    });
    if (!ledger) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        'ledgerId must be a ledger of this company',
        'ledgerId',
      );
    }
  }

  private postingSession(session: TillSession): PostingSession {
    return {
      tssId: session.tssId,
      tssAccYear: session.tssAccYear,
      tssCompanyId: session.tssCompanyId,
      tssBranchId: session.tssBranchId,
      tssTenantId: session.tssTenantId,
      tssDayId: session.tssDayId,
      tssCounterId: session.tssCounterId,
      tssDeviceId: session.tssDeviceId,
      sessionNo: session.tssSessionNo,
      businessDate: isoDateOf(session.tssBusinessDate),
    };
  }

  private async newId(tx: Tx): Promise<string> {
    const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`;
    return row.id;
  }
}
