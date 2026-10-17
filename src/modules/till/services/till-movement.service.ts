/**
 * till-movement.service.ts — the hand-posted movements of cash through a drawer
 * (TillMovementService, §5 / build phase 2) and, since notes 113 / 114, the receipt of a
 * cashier's hand-over or drop into the safe. Routes (till.controller.ts): movements/create ·
 * supervisors · get · change · awaiting-receipt · receive · void, and sessions/approve-cash.
 * It reads and locks accounts.till_session; every row it makes — till_cash_movement and its
 * voucher, till_count(_line), till_variance, till_approval, till_event — goes through the
 * single writers: TillPostingService (postMovement / voidMovement / postReceive /
 * postVariance), TillSessionService (priceLines / writeMovementCount), TillApprovalService
 * (ruleOrDefault / assertApprover / record) and TillEventService. A REMIT is
 * TillSafeService's (notes 118; the controller sends its void there); FLOAT_ISSUE and
 * CLOSE_HANDOVER are the session's own (till-session.service.ts).
 *
 * Flows:
 * - create(): the kind must be hand-posted (CASHIER_MOVEMENTS / SUPERVISOR_MOVEMENTS) → a
 *   PICKUP / TOP_UP proves its supervisor first (proveSupervisor → verifyPin, outside the
 *   transaction so a PIN_FAIL stays journalled) → lockSession (OPEN / SUSPENDED) →
 *   assertAtCounter / assertOperator → the amount from the denominations (assertCashLines,
 *   priceLines; an EXCHANGE's IN and OUT sides must balance, a DROP is declared) →
 *   loadReason → the other side: dropSafeFor (DROP, notes 110 §3) / safeFor (PICKUP, TOP_UP,
 *   EXCHANGE) / assertLedger (PAID_IN) → the awaiting ledger for a DROP under
 *   till.handover_receipt REQUIRED (notes 113) → writeMovementCount (IN; OUT too for an
 *   EXCHANGE) → posting.postMovement (the row, its doc no, TFlt / TDrp / TPIn) → get().
 * - change(): REV 2 §2.14 — both cashiers' PINs (checkWitnessPin, notes 108) → both
 *   sessions locked in id order → a PICKUP on the giver and a TOP_UP on the taker, each
 *   counted and posted through its own counter's safe.
 * - supervisors() / get() / operatorOf(): reads for the screen and the controller's rights.
 * - awaitingReceipt() → receive(): notes 113 — every bag judged (assertAwaiting, never the
 *   caller's own) and the receiver's PIN before the transaction; then per bag, locked in
 *   session / bag order: a blind DROP_VERIFY count, posting.postReceive (TRcv), and a
 *   difference as the session's RECEIVE-stage till_variance — within tolerance postVariance
 *   at once, beyond it PENDING with APPROVAL_REQUESTED for sessions/decide-variance.
 * - approveCash(): notes 114 — a CLOSED session's awaiting bags as one total: awaitingOf →
 *   the self rule and the PIN → a gap beyond tolerance decided in the step when `treatment`
 *   is given (approval.assertApprover, the cashier the requester) → one transaction: the
 *   bags received (postReceive; a gap on the hand-over first, then the drops newest first),
 *   ONE RECEIVE variance, approval.record + postVariance when decided, VARIANCE_DECIDED /
 *   APPROVAL_REQUESTED, tss_variance_status → the voucher numbers and sessions.get().
 * - void(): REV 2 §2.8 — lockSession (OPEN / SUSPENDED / COUNTING with no final count), the
 *   row re-read under the lock, VOIDABLE_MOVEMENTS only, never a RECEIVED bag, a
 *   MOVEMENT_VOID reason → posting.voidMovement (the voucher mirrored, the row VOIDED).
 */
import { Injectable } from '@nestjs/common';
import { Prisma, type TillSession } from '@prisma/client';
import { loadRights } from '../../../common/posting/rights';
import { verifySecret } from '../../../common/utils/secret-hash.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService, type TillCaller } from '../till-context.service';
import { accYearOf, businessDateNow, isoDateOf } from '../till-dates';
import { throwTill, throwTillBadRequest, throwTillNotFound } from '../till-errors';
import { TillApprovalService } from './till-approval.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService, type SafeRef } from './till-ledger.service';
import { TillPostingService, type PostingSession } from './till-posting.service';
import { TillSessionService } from './till-session.service';
import {
  APPROVABLE_TREATMENTS,
  CASH_TENDER_TYPE_ID,
  CASHIER_MOVEMENTS,
  SUPERVISOR_MOVEMENTS,
  TILL_CASH_AWAITING_ROLE,
  TILL_MENU,
  TillCountKind,
  TillErrorCode,
  TillEventCode,
  TillHandoverReceipt,
  TillMovementKind,
  TillReceiptStatus,
  TillRemitMode,
  TillRemitStatus,
  TillSessionStatus,
  TillSessionVarianceStatus,
  TillVarianceStage,
  TillVarianceTreatment,
  VARIANCE_STATUS_OF_TREATMENT,
  VOIDABLE_MOVEMENTS,
} from '../types/till-enum';
import type {
  TillAwaitingReceiptPayload,
  TillCashApprovalMovementPayload,
  TillCashApprovalPayload,
  TillCountLineInput,
  TillMovementDetailPayload,
  TillReceivedPayload,
  TillSupervisorPayload,
  SelfCashApproval,
} from '../types/till-api.types';

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);
/** A Decimal as a 2-dp number for the payloads; 0 for null. */
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

/** Notes 113 — one bag to receive: the hand-over / drop, and its blind count. */
export interface ReceiveBagInput {
  tcmId: string;
  accYear: string;
  lines: TillCountLineInput[];
  notes?: string | null;
}

/** Notes 114 — sessions/approve-cash. */
export interface ApproveCashInput {
  companyId: string;
  branchId: string;
  accYear: string;
  tssId: string;
  approverPin?: string | null;
  /** Left out = exactly what was handed over. */
  receivedAmount?: number | null;
  treatment?: TillVarianceTreatment | null;
  reasonId?: string | null;
  notes?: string | null;
}

/** movements/create (one kind per call); which fields are read, and refused, depends on the kind. */
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
  /** DROP / PAID_IN / EXCHANGE: a second person, named only. Not read on PICKUP / TOP_UP. */
  witnessBy?: string | null;
  /** PICKUP / TOP_UP: the supervisor signing at the counter (notes 110). */
  supervisorId?: string | null;
  /** PICKUP / TOP_UP: that supervisor's till PIN (notes 110). */
  supervisorPin?: string | null;
  notes?: string | null;
}

/**
 * Every non-sale movement of money through a drawer (§5, build phase 2): the
 * documents behind the F11 till menu, each with its accounting voucher (D6).
 *
 *   DROP      the cashier drops a sealed bag into the drop safe TDrp  Dr safe / Cr till cash
 *   PAID_IN   money in that is not a sale (scrap, staff refund) TPIn  Dr till cash / Cr ledger
 *   EXCHANGE  notes changed with the safe, counted both ways   —     nothing to book
 *   PICKUP    the cashier hands cash to a SUPERVISOR            TDrp  Dr safe / Cr till cash
 *   TOP_UP    a SUPERVISOR hands change to the cashier          TFlt  Dr till cash / Cr safe
 *
 * PAID_OUT is not here: 48 moved an expense to the expense voucher (ExpV) and
 * a supplier to a bill-wise Payment. Only a session still taking money (OPEN /
 * SUSPENDED) moves cash; once it is being counted the expectation is frozen.
 *
 * Notes 110: every kind on /create is entered AT THE COUNTER by the session's
 * cashier, on its device — nothing is recorded behind the cashier's back. A
 * pickup / top-up is two signatures, not "do + approve": the cashier calling,
 * and the supervisor standing there, who picks their name and types their till
 * PIN on the same screen (`proveSupervisor`). The supervisor must hold Till
 * Sessions (273) OVERRIDE themselves. /change (counter to counter, a
 * supervisor's call whose cashiers witness by PIN, notes 108) and the void
 * (273 OVERRIDE) are unchanged; the approval rules (276) stay for exceptions,
 * and phase 3's gate writes the till_approval row behind each.
 *
 * Notes 113: under till.handover_receipt REQUIRED a DROP (and the close's
 * hand-over) posts to Till cash awaiting receipt; `receive` is a supervisor
 * counting each bag into its safe, blind, with their PIN. Notes 114: the
 * screen calls `approveCash` instead — one Approve on the closed session.
 */
@Injectable()
export class TillMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly ledger: TillLedgerService,
    private readonly posting: TillPostingService,
    private readonly sessions: TillSessionService,
    private readonly events: TillEventService,
    private readonly approval: TillApprovalService,
  ) {}

  /**
   * movements/create — one DROP / PAID_IN / EXCHANGE (the cashier alone) or PICKUP / TOP_UP
   * (the cashier plus a supervisor's PIN, notes 110), by the session's cashier on its device
   * while it still takes money. Refuses: a kind not posted by hand (TILL_MOVEMENT_INVALID on
   * `kind`); lines on a DROP, outLines off an EXCHANGE, an EXCHANGE whose sides differ, an
   * amount that is not what the denominations add up to, or nothing moved (all
   * TILL_MOVEMENT_INVALID); a drawer not OPEN / SUSPENDED (TILL_SESSION_NOT_OPEN); another
   * cashier or device (TILL_SESSION_NOT_YOURS / _WRONG_DEVICE; a pickup / top-up from the
   * office TILL_MOVEMENT_AT_COUNTER); a counter with no drop safe (TILL_NO_DROP_SAFE) or a
   * branch with none (TILL_SAFE_MISSING); a paid-in with no ledger. Steps, in one
   * transaction after the supervisor is proven: lock → who signs (the witness is the proven
   * supervisor, or the named one on the cashier kinds; never the caller) → the amount →
   * loadReason → the safe / ledger → the awaiting ledger (DROP under REQUIRED) → the counts
   * (tct_movement_id = the id drawn up front) → posting.postMovement. Answers get().
   */
  async create(input: CreateMovementInput): Promise<TillMovementDetailPayload> {
    const caller = await this.context.caller();
    if (!CASHIER_MOVEMENTS.includes(input.kind) && !SUPERVISOR_MOVEMENTS.includes(input.kind)) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        `${input.kind} is not posted by hand (the open issues the float, the close hands over, the cash office remits)`,
        'kind',
      );
    }
    const signedKind = SUPERVISOR_MOVEMENTS.includes(input.kind);
    // Notes 110: before the transaction, so a wrong PIN is journalled, not rolled back.
    const supervisor = signedKind ? await this.proveSupervisor(input, caller) : null;

    const tcmId = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, input);
      if (signedKind) {
        this.assertAtCounter(session, caller);
      } else {
        this.assertOperator(session, caller);
      }

      // ── who enters it, who signs for it ──────────────────────────────
      // The caller is the session's cashier (asserted above). A pickup /
      // top-up's second signature is the supervisor proven before the
      // transaction: the session's cashier is fixed at its open, so the lock
      // cannot have made them the same person.
      let witnessBy: string | null = signedKind
        ? (supervisor?.userId ?? null)
        : (input.witnessBy ?? null);
      if (witnessBy === caller.userId) {
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
      const safeScope = {
        companyId: input.companyId,
        branchId: input.branchId,
        counterSafeId: counter.tcnSafeId,
      };
      let safe: SafeRef | null = null;
      if (input.kind === TillMovementKind.DROP) {
        // Notes 110 §3: the bag goes into the box AT this counter, never the branch default.
        safe = await this.ledger.dropSafeFor(tx, safeScope);
        if (!safe) {
          throwTill(
            TillErrorCode.NO_DROP_SAFE,
            `Counter ${counter.tcnCode} has no drop safe: give the bag to a supervisor as a Pickup, or set a drop safe on the counter (Till Masters, menu 275)`,
            'kind',
          );
        }
      } else if (input.kind !== TillMovementKind.PAID_IN) {
        safe = await this.ledger.safeFor(tx, safeScope);
      }
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

      // Notes 113: under till.handover_receipt REQUIRED a drop waits in Till
      // cash awaiting receipt until a supervisor receives the bag.
      let awaitingLedgerId: string | null = null;
      if (input.kind === TillMovementKind.DROP) {
        const settings = await this.context.settings({
          companyId: input.companyId,
          branchId: input.branchId,
          deviceId: session.tssDeviceId,
          userId: session.tssOperatorId,
        });
        if (settings.handoverReceipt === TillHandoverReceipt.REQUIRED) {
          awaitingLedgerId = await this.ledger.roleLedger(
            tx,
            TILL_CASH_AWAITING_ROLE,
            input.companyId,
            input.branchId,
          );
        }
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
        witnessVerifiedOn: supervisor?.verifiedOn ?? null,
        awaitingLedgerId,
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
    /** Notes 108: the giving cashier's till PIN (they witness the pickup). */
    fromWitnessPin?: string | null;
    /** Notes 108: the receiving cashier's till PIN, unless the caller is that cashier. */
    toWitnessPin?: string | null;
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

    // Notes 108: both cashiers prove they were there, before the transaction
    // (a wrong PIN is journalled, not rolled back). The receiving one has
    // nothing to prove when the caller is that cashier, as a top-up on /create.
    const scope = { companyId: input.companyId, branchId: input.branchId, accYear: input.accYear };
    const fromPeek = await this.peekSession({ ...scope, tssId: input.fromTssId });
    const toPeek = await this.peekSession({ ...scope, tssId: input.toTssId });
    if (fromPeek.tssOperatorId === caller.userId) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        'The cashier giving the change witnesses it; the supervisor carrying it must be someone else',
        'fromTssId',
      );
    }
    const fromVerifiedOn = await this.checkWitnessPin(fromPeek, {
      witnessId: fromPeek.tssOperatorId,
      pin: input.fromWitnessPin,
      kind: TillMovementKind.PICKUP,
      pinField: 'fromWitnessPin',
      whoField: 'fromTssId',
      action: 'change',
      caller,
    });
    const toVerifiedOn =
      toPeek.tssOperatorId === caller.userId
        ? null
        : await this.checkWitnessPin(toPeek, {
            witnessId: toPeek.tssOperatorId,
            pin: input.toWitnessPin,
            kind: TillMovementKind.TOP_UP,
            pinField: 'toWitnessPin',
            whoField: 'toTssId',
            action: 'change',
            caller,
          });

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
        witnessVerifiedOn: fromVerifiedOn,
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
        witnessVerifiedOn: toVerifiedOn,
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
      throwTillNotFound(TillErrorCode.MOVEMENT_NOT_FOUND, 'Till movement', 'tcmId', key.tcmId);
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
      tcmWitnessVerifiedOn: m.tcmWitnessVerifiedOn?.toISOString() ?? null,
      tcmVoidedOn: m.tcmVoidedOn?.toISOString() ?? null,
      tcmVoidedBy: m.tcmVoidedBy,
      tcmVoidReasonId: m.tcmVoidReasonId,
      tcmNotes: m.tcmNotes,
      tcmReceiptStatus: (m.tcmReceiptStatus as TillReceiptStatus | null) ?? null,
      tcmReceivedAmount: m.tcmReceivedAmount === null ? null : num(m.tcmReceivedAmount),
      tcmReceivedOn: m.tcmReceivedOn?.toISOString() ?? null,
      tcmReceivedBy: m.tcmReceivedBy,
      tcmReceiveVoucherId: m.tcmReceiveVoucherId,
      tcmRemitMode: (m.tcmRemitMode as TillRemitMode | null) ?? null,
      tcmRemitStatus: (m.tcmRemitStatus as TillRemitStatus | null) ?? null,
      tcmCitAgency: m.tcmCitAgency,
      tcmBankDate: m.tcmBankDate ? isoDateOf(m.tcmBankDate) : null,
      tcmBankRef: m.tcmBankRef,
      tcmBankAmount: m.tcmBankAmount === null ? null : num(m.tcmBankAmount),
      tcmConfirmedBy: m.tcmConfirmedBy,
      tcmConfirmedOn: m.tcmConfirmedOn?.toISOString() ?? null,
      tcmConfirmVoucherId: m.tcmConfirmVoucherId,
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
      // Notes 113: the void mirrors the drop's TDrp only; a received bag's TRcv
      // and its difference would be left behind.
      if (fresh.tcmReceiptStatus === TillReceiptStatus.RECEIVED) {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_VOIDABLE,
          `${fresh.tcmDocNo} has been received into the safe and is not voided`,
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

  /**
   * Notes 110 §2 — who can sign a pickup / top-up on this session: the users
   * `proveSupervisor` would accept, less the PIN. `hasPin` lets the screen say
   * "set a till PIN" before the cashier counts. The session's status does not
   * matter (a read).
   */
  async supervisors(key: {
    companyId: string;
    branchId: string;
    accYear: string;
    tssId: string;
  }): Promise<TillSupervisorPayload[]> {
    const session = await this.prisma.tillSession.findFirst({
      where: {
        tssId: key.tssId,
        tssAccYear: key.accYear,
        tssCompanyId: key.companyId,
        tssBranchId: key.branchId,
        tssIsDeleted: false,
      },
      select: { tssOperatorId: true },
    });
    if (!session) {
      throwTillNotFound(TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
    }
    const users = await this.prisma.userMaster.findMany({
      where: {
        usrId: { not: session.tssOperatorId },
        ...this.signerScope,
        // What loadRights reads in proveSupervisor (uq_user_menus_user_menu: one row).
        userMenus: {
          some: { umMenuId: TILL_MENU.SESSIONS, umCanOverride: true, umIsDeleted: false },
        },
      },
      select: {
        usrId: true,
        usrLoginName: true,
        usrFullName: true,
        usrDisplayName: true,
        usrPinHash: true,
      },
      orderBy: { usrLoginName: 'asc' },
    });
    return users.map((u) => ({
      userId: u.usrId,
      loginName: u.usrLoginName,
      fullName: u.usrFullName?.trim() || u.usrDisplayName?.trim() || null,
      hasPin: u.usrPinHash !== null && u.usrPinHash !== '',
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Receive into the safe (notes 113)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The branch's hand-overs and drops no supervisor has received, oldest
   * first — optionally one business day's. No amount: the receive is blind,
   * as the cashier's count is (the receive's answer shows it).
   */
  async awaitingReceipt(scope: {
    companyId: string;
    branchId: string;
    dayId?: string | null;
    accYear?: string | null;
  }): Promise<TillAwaitingReceiptPayload[]> {
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      companyId: scope.companyId,
      branchId: scope.branchId,
    });
    const rows = await this.prisma.tillCashMovement.findMany({
      where: {
        tcmCompanyId: scope.companyId,
        tcmBranchId: scope.branchId,
        tcmIsDeleted: false,
        tcmStatus: 'POSTED',
        tcmReceiptStatus: TillReceiptStatus.AWAITING,
        ...(scope.dayId ? { tcmDayId: scope.dayId, tcmAccYear: scope.accYear ?? undefined } : {}),
      },
      include: { safe: { select: { tsfName: true } } },
      orderBy: { tcmCreatedOn: 'asc' },
    });
    const sessionIds = [
      ...new Set(rows.map((r) => r.tcmSessionId).filter((id): id is string => !!id)),
    ];
    const sessions = await this.prisma.tillSession.findMany({
      where: { tssId: { in: sessionIds } },
      include: { counter: { select: { tcnCode: true, tcnName: true } } },
    });
    const sessionOf = new Map(sessions.map((x) => [`${x.tssId}|${x.tssAccYear}`, x]));
    const users = await this.prisma.userMaster.findMany({
      where: { usrId: { in: [...new Set(sessions.map((x) => x.tssOperatorId))] } },
      select: { usrId: true, usrLoginName: true, usrDisplayName: true },
    });
    const nameOf = new Map(users.map((u) => [u.usrId, u.usrDisplayName?.trim() || u.usrLoginName]));
    const now = Date.now();
    return rows.flatMap((m): TillAwaitingReceiptPayload[] => {
      const session = sessionOf.get(`${m.tcmSessionId}|${m.tcmAccYear}`);
      if (!session) {
        return [];
      }
      return [
        {
          tcmId: m.tcmId,
          tcmAccYear: m.tcmAccYear,
          tcmKind: m.tcmKind as TillMovementKind,
          tcmDocNo: m.tcmDocNo,
          tcmDocDate: isoDateOf(m.tcmDocDate),
          handedOverOn: m.tcmCreatedOn.toISOString(),
          ageMinutes: Math.max(0, Math.floor((now - m.tcmCreatedOn.getTime()) / 60_000)),
          bagNo: m.tcmBagNo,
          sealNo: m.tcmSealNo,
          safeId: m.tcmSafeId,
          safeName: m.safe?.tsfName ?? null,
          tssId: session.tssId,
          sessionNo: session.tssSessionNo,
          sessionStatus: session.tssStatus as TillSessionStatus,
          counterCode: session.counter.tcnCode,
          counterName: session.counter.tcnName,
          cashierId: session.tssOperatorId,
          cashierName: nameOf.get(session.tssOperatorId) ?? null,
          handedOverBy: m.tcmDoneBy,
          canReceive: settings.singleOperator || caller.userId !== session.tssOperatorId,
        },
      ];
    });
  }

  /**
   * Notes 113 — a supervisor receives bags into the safe, one blind count
   * each (DROP_VERIFY), proving themselves with their till PIN once for the
   * sitting. Per bag: TRcv Dr the safe / Cr Till cash awaiting receipt for what
   * was counted, the row RECEIVED, CASH_RECEIVED journalled. A difference from
   * what was handed over is the bag's session's RECEIVE-stage variance (cash,
   * open_amount = handed over, counted = received): within till.cash_tolerance
   * it posts at once (WITHIN_TOLERANCE, to Cash short & excess); beyond it it
   * is PENDING, the session's tss_variance_status PENDING, until an approver
   * decides it on sessions/decide-variance with the bag's tcmId. The session's
   * own status never changes.
   *
   * The receiver is anyone but the bag's session's cashier (notes 116: a
   * supervisor who closed for the cashier may receive it), unless
   * till.single_operator. All bags in one transaction: one refused, none
   * received.
   */
  async receive(input: {
    companyId: string;
    branchId: string;
    receiverPin?: string | null;
    bags: ReceiveBagInput[];
  }): Promise<TillReceivedPayload[]> {
    const caller = await this.context.caller();
    if (input.bags.length === 0) {
      throwTillBadRequest(TillErrorCode.BAGS_REQUIRED, 'Name at least one bag to receive', 'bags');
    }
    const seen = new Set<string>();
    input.bags.forEach((bag, i) => {
      if (seen.has(bag.tcmId)) {
        throwTillBadRequest(
          TillErrorCode.BAG_REPEATED,
          'A bag is received once per call',
          `bags.${i}.tcmId`,
        );
      }
      seen.add(bag.tcmId);
      this.assertCashLines(bag.lines, `bags.${i}.lines`);
    });
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
    });

    // 1 · before the transaction: every bag waits, none is the caller's own,
    // and the PIN — so a wrong one is journalled, not rolled back.
    const peeks: { bag: ReceiveBagInput; session: TillSession; index: number }[] = [];
    for (const [index, bag] of input.bags.entries()) {
      const m = await this.prisma.tillCashMovement.findFirst({
        where: {
          tcmId: bag.tcmId,
          tcmAccYear: bag.accYear,
          tcmCompanyId: input.companyId,
          tcmBranchId: input.branchId,
          tcmIsDeleted: false,
        },
      });
      if (!m) {
        throwTill(
          TillErrorCode.MOVEMENT_NOT_FOUND,
          `Till movement ${bag.tcmId} was not found`,
          `bags.${index}.tcmId`,
        );
      }
      this.assertAwaiting(m, `bags.${index}.tcmId`);
      const session = await this.prisma.tillSession.findUniqueOrThrow({
        where: { tssId_tssAccYear: { tssId: m.tcmSessionId!, tssAccYear: m.tcmAccYear } },
      });
      if (!settings.singleOperator && caller.userId === session.tssOperatorId) {
        throwTill(
          TillErrorCode.RECEIVER_SELF,
          `${m.tcmDocNo} is from session ${session.tssSessionNo}, and you were its cashier: another supervisor receives it`,
          `bags.${index}.tcmId`,
          { tcmId: m.tcmId },
        );
      }
      peeks.push({ bag, session, index });
    }
    const receiver = await this.prisma.userMaster.findUnique({
      where: { usrId: caller.userId },
      select: { usrLoginName: true, usrPinHash: true },
    });
    await this.verifyPin(
      peeks[0].session,
      receiver?.usrLoginName ?? caller.actorName,
      receiver?.usrPinHash ?? null,
      {
        pin: input.receiverPin,
        field: 'receiverPin',
        codes: {
          noPin: TillErrorCode.RECEIVER_NO_PIN,
          required: TillErrorCode.RECEIVER_PIN_REQUIRED,
          wrong: TillErrorCode.RECEIVER_PIN,
        },
        noPinMessage: `${caller.actorName} receives cash into the safe and has no till PIN: an administrator sets one in User Administration (menu 58)`,
        requiredMessage: 'Receiving cash into the safe is signed with your till PIN',
        payload: { action: 'receive', tcmIds: input.bags.map((b) => b.tcmId).join(',') },
        detail: {},
        caller,
      },
    );
    const today = await businessDateNow(this.prisma, settings.dayCutoff);
    const on = { date: today, accYear: accYearOf(today) };

    // 2 · one transaction; sessions then bags locked in id order, as close
    // locks its session before writing its hand-over.
    const ordered = [...peeks].sort((a, b) =>
      a.session.tssId === b.session.tssId
        ? a.bag.tcmId.localeCompare(b.bag.tcmId)
        : a.session.tssId.localeCompare(b.session.tssId),
    );
    const results = await this.prisma.$transaction(async (tx) => {
      const out = new Map<string, TillReceivedPayload>();
      const awaitingLedgerId = await this.ledger.roleLedger(
        tx,
        TILL_CASH_AWAITING_ROLE,
        input.companyId,
        input.branchId,
      );
      const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
      for (const { bag, index } of ordered) {
        const field = `bags.${index}`;
        const session = await this.lockSession(
          tx,
          {
            companyId: input.companyId,
            branchId: input.branchId,
            accYear: bag.accYear,
            tssId: peeks[index].session.tssId,
          },
          Object.values(TillSessionStatus),
        );
        await tx.$queryRaw`
          SELECT tcm_id FROM accounts.till_cash_movement
           WHERE tcm_id = ${bag.tcmId}::uuid AND tcm_acc_year = ${bag.accYear}::char(9)
           FOR UPDATE`;
        const m = await tx.tillCashMovement.findUniqueOrThrow({
          where: { tcmId_tcmAccYear: { tcmId: bag.tcmId, tcmAccYear: bag.accYear } },
        });
        this.assertAwaiting(m, `${field}.tcmId`);
        const safe = m.tcmSafeId
          ? await tx.tillSafe.findUnique({
              where: { tsfId: m.tcmSafeId },
              select: { tsfId: true, tsfLedgerId: true, tsfName: true },
            })
          : null;
        if (!safe) {
          throwTill(
            TillErrorCode.SAFE_MISSING,
            `${m.tcmDocNo} names no safe to receive it into`,
            `${field}.tcmId`,
          );
        }

        const priced = await this.sessions.priceLines(tx, input.companyId, bag.lines);
        const received = priced.reduce((sum, l) => sum.plus(l.amount), ZERO);
        const handedOver = new Prisma.Decimal(m.tcmAmount);
        const countId = await this.sessions.writeMovementCount(tx, session, {
          kind: TillCountKind.DROP_VERIFY,
          lines: priced,
          safeId: safe.tsfId,
          movementId: m.tcmId,
          caller,
          deviceId: caller.deviceId,
          isBlind: true,
          expected: handedOver,
          notes: bag.notes ?? null,
        });
        const postingSession = this.postingSession(session);
        const voucherId = await this.posting.postReceive(tx, {
          movement: m,
          session: postingSession,
          safe: { safeId: safe.tsfId, ledgerId: safe.tsfLedgerId, name: safe.tsfName },
          awaitingLedgerId,
          received,
          countId,
          on,
          caller,
          notes: bag.notes ?? null,
        });

        // ── a difference: the session's RECEIVE-stage variance ─────────
        const difference = received.minus(handedOver);
        let tvrId: string | null = null;
        let outcome: TillReceivedPayload['outcome'] = 'RECEIVED';
        if (!difference.isZero()) {
          const within = difference.abs().lessThanOrEqualTo(settings.cashTolerance);
          outcome = within ? 'WITHIN_TOLERANCE' : 'SENT_FOR_APPROVAL';
          const now = new Date();
          const variance = await tx.tillVariance.create({
            data: {
              tvrCompanyId: session.tssCompanyId,
              tvrBranchId: session.tssBranchId,
              tvrTenantId: session.tssTenantId,
              tvrAccYear: session.tssAccYear,
              tvrSessionId: session.tssId,
              tvrStage: TillVarianceStage.RECEIVE,
              tvrMovementId: m.tcmId,
              tvrTenderTypeId: CASH_TENDER_TYPE_ID,
              tvrTenderId: tillCash.tenderId,
              tvrOpenAmount: handedOver,
              tvrExpected: handedOver,
              tvrCounted: received,
              tvrTolerance: settings.cashTolerance,
              tvrTreatment: within
                ? TillVarianceTreatment.WITHIN_TOLERANCE
                : TillVarianceTreatment.PENDING,
              tvrDecidedBy: within ? caller.userId : null,
              tvrDecidedOn: within ? now : null,
              tvrStatus: 'OPEN',
              tvrNotes: bag.notes ?? null,
              tvrCreatedBy: caller.actorName,
            },
            select: { tvrId: true },
          });
          tvrId = variance.tvrId;
          if (within) {
            await this.posting.postVariance(tx, {
              session: postingSession,
              tvrId,
              tenderLedgerId: awaitingLedgerId,
              tenderLabel: `Cash received (${m.tcmDocNo})`,
              variance: difference,
              treatment: TillVarianceTreatment.WITHIN_TOLERANCE,
              caller,
              on,
            });
          } else {
            await this.events.log(tx, {
              companyId: session.tssCompanyId,
              branchId: session.tssBranchId,
              accYear: session.tssAccYear,
              code: TillEventCode.APPROVAL_REQUESTED,
              sessionId: session.tssId,
              dayId: session.tssDayId,
              counterId: session.tssCounterId,
              deviceId: caller.deviceId ?? session.tssDeviceId,
              userId: caller.userId,
              srcDocType: 'TILL_MOVEMENT',
              srcDocId: m.tcmId,
              srcRefno: m.tcmDocNo,
              amount: difference.abs(),
              payload: {
                event: 'CASH_VARIANCE',
                stage: TillVarianceStage.RECEIVE,
                tcmId: m.tcmId,
                variance: [
                  {
                    tenderTypeId: CASH_TENDER_TYPE_ID,
                    tenderId: tillCash.tenderId,
                    variance: difference.toFixed(2),
                  },
                ],
              },
            });
          }
          const status = session.tssVarianceStatus as TillSessionVarianceStatus;
          const next = !within
            ? TillSessionVarianceStatus.PENDING
            : status === TillSessionVarianceStatus.NONE
              ? TillSessionVarianceStatus.WITHIN_TOLERANCE
              : status;
          if (next !== status) {
            await tx.tillSession.update({
              where: {
                tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear },
              },
              data: {
                tssVarianceStatus: next,
                tssModifiedOn: now,
                tssModifiedBy: caller.actorName,
              },
            });
          }
        }

        out.set(m.tcmId, {
          tcmId: m.tcmId,
          tcmAccYear: m.tcmAccYear,
          tcmKind: m.tcmKind as TillMovementKind,
          tcmDocNo: m.tcmDocNo,
          tssId: session.tssId,
          sessionNo: session.tssSessionNo,
          handedOver: num(handedOver),
          received: num(received),
          difference: num(difference),
          outcome,
          tvrId,
          receiveVoucherId: voucherId,
          receivedOn: on.date,
        });
      }
      return out;
    });
    // In the order the caller named them.
    return input.bags.map((b) => results.get(b.tcmId)!);
  }

  /**
   * Notes 114 — a supervisor approves a CLOSED session's cash, from Till
   * Sessions (273): every hand-over / drop of it still awaiting receipt, in one
   * step, for one total (`receivedAmount`; left out = exactly what was handed
   * over). No count: the supervisor sees the amount. Per movement, as
   * `receive`: a TRcv Dr its safe / Cr Till cash awaiting receipt, the row
   * RECEIVED, CASH_RECEIVED journalled. A gap sits on the hand-over first
   * (then the drops, newest first, a shortage taking none below 0) and is ONE
   * RECEIVE-stage variance naming the hand-over, else the latest drop:
   *
   *   within till.cash_tolerance  posted at once (WITHIN_TOLERANCE);
   *   beyond, with a treatment    decided here when the caller's Till Approval
   *                               Authority covers it (assertApprover, the
   *                               cashier the requester) — its 403 otherwise,
   *                               nothing written (DECIDED);
   *   beyond, without one         PENDING for decide-variance with its tcmId,
   *                               by an approver other than this caller
   *                               (SENT_FOR_APPROVAL).
   *
   * The caller is anyone but the session's cashier, unless
   * till.single_operator — notes 116: the supervisor who closed the session
   * for the cashier (and so handed its cash over) may approve it, as may
   * whoever made a drop — and signs with their till PIN, which the owner of a
   * one-person shop approving their own session may leave out. Judged before
   * the transaction, so a wrong PIN is journalled.
   */
  async approveCash(input: ApproveCashInput): Promise<TillCashApprovalPayload> {
    const caller = await this.context.caller();
    const key = {
      companyId: input.companyId,
      branchId: input.branchId,
      accYear: input.accYear,
      tssId: input.tssId,
    };
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
    });

    // 1 · the session, closed, and what of it waits.
    const peek = await this.prisma.tillSession.findFirst({
      where: {
        tssId: key.tssId,
        tssAccYear: key.accYear,
        tssCompanyId: key.companyId,
        tssBranchId: key.branchId,
        tssIsDeleted: false,
      },
    });
    if (!peek) {
      throwTillNotFound(TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
    }
    if ((peek.tssStatus as TillSessionStatus) !== TillSessionStatus.CLOSED) {
      throwTill(
        TillErrorCode.SESSION_NOT_OPEN,
        `Session ${peek.tssSessionNo} is ${peek.tssStatus}: its cash is approved once it is closed`,
        'tssId',
        { status: peek.tssStatus },
      );
    }
    const waiting = await this.awaitingOf(this.prisma, peek);
    if (waiting.length === 0) {
      return this.refuseNothingAwaiting(this.prisma, peek);
    }

    // 2 · who: not the session's cashier — unless till.single_operator, or
    // (notes 127 §3) the company's CASH_VARIANCE rule allows self
    // (tar_allow_self) — and their PIN.
    const today = await businessDateNow(this.prisma, settings.dayCutoff);
    const event = 'CASH_VARIANCE';
    const rule = await this.approval.ruleOrDefault(this.prisma, {
      companyId: key.companyId,
      branchId: key.branchId,
      event,
      onDate: today,
    });
    const own = caller.userId === peek.tssOperatorId;
    if (own && !settings.singleOperator && !rule.tar_allow_self) {
      throwTill(
        TillErrorCode.RECEIVER_SELF,
        `Session ${peek.tssSessionNo} is yours (you were its cashier): another supervisor approves its cash`,
        'tssId',
        { tssId: peek.tssId },
      );
    }
    const ownerAlone = settings.singleOperator && own;
    /** Journalled on each CASH_RECEIVED and answered, so the Cockpit and the Z show it. */
    const selfApproval: SelfCashApproval | null = !own
      ? null
      : ownerAlone
        ? 'SINGLE_OPERATOR'
        : 'RULE';
    // The single-operator owner may leave the PIN out; a cashier approving
    // their own cash under the rule always signs.
    if (!ownerAlone || input.approverPin?.trim()) {
      const me = await this.prisma.userMaster.findUnique({
        where: { usrId: caller.userId },
        select: { usrLoginName: true, usrPinHash: true },
      });
      await this.verifyPin(peek, me?.usrLoginName ?? caller.actorName, me?.usrPinHash ?? null, {
        pin: input.approverPin,
        field: 'approverPin',
        codes: {
          noPin: TillErrorCode.RECEIVER_NO_PIN,
          required: TillErrorCode.RECEIVER_PIN_REQUIRED,
          wrong: TillErrorCode.RECEIVER_PIN,
        },
        noPinMessage: `${caller.actorName} approves cash into the safe and has no till PIN: an administrator sets one in User Administration (menu 58)`,
        requiredMessage: 'Approving a session’s cash is signed with your till PIN',
        payload: { action: 'approve-cash', tssId: peek.tssId },
        detail: {},
        caller,
      });
    }

    // 3 · the amounts, and a gap beyond tolerance decided here when asked.
    const handedOver = waiting.reduce((sum, m) => sum.plus(m.tcmAmount), ZERO);
    const received =
      input.receivedAmount === null || input.receivedAmount === undefined
        ? handedOver
        : new Prisma.Decimal(input.receivedAmount).toDecimalPlaces(2);
    const difference = received.minus(handedOver);
    const within = difference.abs().lessThanOrEqualTo(settings.cashTolerance);
    const on = { date: today, accYear: accYearOf(today) };
    let decision: {
      treatment: (typeof APPROVABLE_TREATMENTS)[number];
      rule: Awaited<ReturnType<TillApprovalService['ruleOrDefault']>>;
      verdict: Awaited<ReturnType<TillApprovalService['assertApprover']>>;
      reasonId: string;
      recoveryLedgerId: string | null;
    } | null = null;
    if (!within && input.treatment) {
      const treatment = input.treatment as (typeof APPROVABLE_TREATMENTS)[number];
      const verdict = await this.approval.assertApprover(this.prisma, {
        companyId: key.companyId,
        branchId: key.branchId,
        event,
        amount: difference.abs(),
        rule,
        approverId: caller.userId,
        requesterId: peek.tssOperatorId,
        pin: input.approverPin ?? null,
      });
      const reason = await this.sessions.varianceReason(this.prisma, {
        companyId: key.companyId,
        reasonId: input.reasonId ?? null,
        event,
      });
      let recoveryLedgerId: string | null = null;
      if (treatment === TillVarianceTreatment.RECOVER) {
        const staff = await this.sessions.staffLedgerOf(this.prisma, peek.tssOperatorId);
        if (!staff.ledgerId) {
          throwTill(
            TillErrorCode.LEDGER_UNMAPPED,
            `RECOVER posts to the cashier’s staff advance ledger, and ${staff.login} has none (an employee with a loan ledger, notes 95)`,
            'treatment',
            { treatment, operatorId: peek.tssOperatorId },
          );
        }
        recoveryLedgerId = staff.ledgerId;
      }
      decision = { treatment, rule, verdict, reasonId: reason.trsId, recoveryLedgerId };
    }

    // 4 · one transaction: the session, then its bags, locked.
    const done = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, key, [TillSessionStatus.CLOSED]);
      await tx.$queryRaw`
        SELECT tcm_id FROM accounts.till_cash_movement
         WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_acc_year = ${session.tssAccYear}::char(9)
           AND tcm_is_deleted = false AND tcm_receipt_status = 'AWAITING'
         ORDER BY tcm_id
           FOR UPDATE`;
      const bags = await this.awaitingOf(tx, session);
      if (bags.length === 0) {
        return this.refuseNothingAwaiting(tx, session);
      }
      if (bags.length !== waiting.length || bags.some((m, i) => m.tcmId !== waiting[i].tcmId)) {
        throwTill(
          TillErrorCode.RECEIPT_NOT_AWAITING,
          `Session ${session.tssSessionNo}'s cash changed while it was being approved: reload it`,
          'tssId',
        );
      }

      // the gap: on the hand-over first, then the drops, newest first
      const anchor =
        bags.find((m) => (m.tcmKind as TillMovementKind) === TillMovementKind.CLOSE_HANDOVER) ??
        bags[bags.length - 1];
      const share = new Map(bags.map((m) => [m.tcmId, new Prisma.Decimal(m.tcmAmount)]));
      if (difference.isPositive()) {
        share.set(anchor.tcmId, share.get(anchor.tcmId)!.plus(difference));
      } else {
        let left = difference.abs();
        for (const m of [anchor, ...bags.filter((b) => b !== anchor).reverse()]) {
          const has = share.get(m.tcmId)!;
          const take = has.lessThan(left) ? has : left;
          share.set(m.tcmId, has.minus(take));
          left = left.minus(take);
        }
      }

      const awaitingLedgerId = await this.ledger.roleLedger(
        tx,
        TILL_CASH_AWAITING_ROLE,
        input.companyId,
        input.branchId,
      );
      const postingSession = this.postingSession(session);
      const movements: {
        m: (typeof bags)[number];
        received: Prisma.Decimal;
        voucherId: string | null;
      }[] = [];
      for (const m of bags) {
        const safe = m.tcmSafeId
          ? await tx.tillSafe.findUnique({
              where: { tsfId: m.tcmSafeId },
              select: { tsfId: true, tsfLedgerId: true, tsfName: true },
            })
          : null;
        if (!safe) {
          throwTill(
            TillErrorCode.SAFE_MISSING,
            `${m.tcmDocNo} names no safe to receive it into`,
            'tssId',
          );
        }
        const part = share.get(m.tcmId)!;
        const voucherId = await this.posting.postReceive(tx, {
          movement: m,
          session: postingSession,
          safe: { safeId: safe.tsfId, ledgerId: safe.tsfLedgerId, name: safe.tsfName },
          awaitingLedgerId,
          received: part,
          countId: null,
          on,
          caller,
          notes: input.notes ?? null,
          selfApproval,
        });
        movements.push({ m, received: part, voucherId });
      }

      // ── a difference: the session's RECEIVE-stage variance ───────────
      let outcome: TillCashApprovalPayload['outcome'] = 'APPROVED';
      let tvrId: string | null = null;
      let tapId: string | null = null;
      let varianceVoucherId: string | null = null;
      if (!difference.isZero()) {
        const now = new Date();
        const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
        const treatment = within
          ? TillVarianceTreatment.WITHIN_TOLERANCE
          : (decision?.treatment ?? TillVarianceTreatment.PENDING);
        outcome = within ? 'WITHIN_TOLERANCE' : decision ? 'DECIDED' : 'SENT_FOR_APPROVAL';
        tvrId = await this.newId(tx);
        if (decision) {
          tapId = await this.approval.record(tx, {
            companyId: session.tssCompanyId,
            branchId: session.tssBranchId,
            tenantId: session.tssTenantId,
            accYear: session.tssAccYear,
            event,
            sessionId: session.tssId,
            counterId: session.tssCounterId,
            srcDocType: 'TILL_MOVEMENT',
            srcDocId: anchor.tcmId,
            srcRefno: anchor.tcmDocNo,
            amount: difference.abs(),
            rule: decision.rule,
            verdict: decision.verdict,
            // notes 129 §1: tap_self_allowed says the session's own cashier decided it
            ...(selfApproval ? { selfAllowed: true } : {}),
            requestedBy: session.tssOperatorId,
            requestedOn: anchor.tcmCreatedOn,
            reasonId: decision.reasonId,
            status: 'APPROVED',
            decidedBy: caller.userId,
            decidedOn: now,
            decidedDeviceId: caller.deviceId,
            decisionNote:
              input.notes?.trim() ||
              `Cash approved: ${received.toFixed(2)} received of ${handedOver.toFixed(2)} handed over`,
            payload: {
              decision: 'APPROVE',
              treatment: decision.treatment,
              stage: TillVarianceStage.RECEIVE,
              via: 'approve-cash',
              tcmId: anchor.tcmId,
              variances: [
                { tvrId, tenderTypeId: CASH_TENDER_TYPE_ID, variance: difference.toFixed(2) },
              ],
            },
          });
        }
        await tx.tillVariance.create({
          data: {
            tvrId,
            tvrCompanyId: session.tssCompanyId,
            tvrBranchId: session.tssBranchId,
            tvrTenantId: session.tssTenantId,
            tvrAccYear: session.tssAccYear,
            tvrSessionId: session.tssId,
            tvrStage: TillVarianceStage.RECEIVE,
            tvrMovementId: anchor.tcmId,
            tvrTenderTypeId: CASH_TENDER_TYPE_ID,
            tvrTenderId: tillCash.tenderId,
            tvrOpenAmount: handedOver,
            tvrExpected: handedOver,
            tvrCounted: received,
            tvrTolerance: settings.cashTolerance,
            tvrTreatment: treatment,
            tvrReasonId: decision?.reasonId ?? null,
            tvrRecoveryLedgerId: decision?.recoveryLedgerId ?? null,
            tvrApprovalId: tapId,
            tvrDecidedBy: within || decision ? caller.userId : null,
            tvrDecidedOn: within || decision ? now : null,
            tvrStatus: 'OPEN',
            tvrNotes: input.notes ?? null,
            tvrCreatedBy: caller.actorName,
          },
          select: { tvrId: true },
        });
        if (within || decision) {
          varianceVoucherId = await this.posting.postVariance(tx, {
            session: postingSession,
            tvrId,
            tenderLedgerId: awaitingLedgerId,
            tenderLabel: `Cash received (${session.tssSessionNo})`,
            variance: difference,
            treatment: treatment as Exclude<
              TillVarianceTreatment,
              TillVarianceTreatment.PENDING | TillVarianceTreatment.RETENDERED
            >,
            recoveryLedgerId: decision?.recoveryLedgerId ?? null,
            caller,
            on,
          });
        }
        await this.events.log(tx, {
          companyId: session.tssCompanyId,
          branchId: session.tssBranchId,
          accYear: session.tssAccYear,
          code: decision ? TillEventCode.VARIANCE_DECIDED : TillEventCode.APPROVAL_REQUESTED,
          sessionId: session.tssId,
          dayId: session.tssDayId,
          counterId: session.tssCounterId,
          deviceId: caller.deviceId ?? session.tssDeviceId,
          userId: caller.userId,
          srcDocType: 'TILL_MOVEMENT',
          srcDocId: anchor.tcmId,
          srcRefno: anchor.tcmDocNo,
          amount: difference.abs(),
          reasonId: decision?.reasonId ?? null,
          approvalId: tapId,
          payload: decision
            ? {
                stage: TillVarianceStage.RECEIVE,
                via: 'approve-cash',
                decision: 'APPROVE',
                treatment: decision.treatment,
                event,
                amount: difference.abs().toFixed(2),
                requiredRole: decision.rule.tar_min_role,
                approverRole: decision.verdict.role,
                channel: decision.verdict.channel,
                implicitGrant: decision.verdict.implicit,
                grantId: decision.verdict.grantId,
                reasonId: decision.reasonId,
                recoveryLedgerId: decision.recoveryLedgerId,
                tcmId: anchor.tcmId,
                variances: [tvrId],
              }
            : {
                event: 'CASH_VARIANCE',
                stage: TillVarianceStage.RECEIVE,
                via: 'approve-cash',
                tcmId: anchor.tcmId,
                variance: [
                  {
                    tenderTypeId: CASH_TENDER_TYPE_ID,
                    tenderId: tillCash.tenderId,
                    variance: difference.toFixed(2),
                  },
                ],
              },
        });
        const status = session.tssVarianceStatus as TillSessionVarianceStatus;
        const next = decision
          ? (await this.sessions.hasAnyPending(tx, session))
            ? TillSessionVarianceStatus.PENDING
            : VARIANCE_STATUS_OF_TREATMENT[decision.treatment]
          : !within
            ? TillSessionVarianceStatus.PENDING
            : status === TillSessionVarianceStatus.NONE
              ? TillSessionVarianceStatus.WITHIN_TOLERANCE
              : status;
        if (next !== status) {
          await tx.tillSession.update({
            where: {
              tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear },
            },
            data: { tssVarianceStatus: next, tssModifiedOn: now, tssModifiedBy: caller.actorName },
          });
        }
      }
      return { session, anchor, movements, outcome, tvrId, tapId, varianceVoucherId };
    });

    const numbers = await this.voucherNos([
      ...done.movements.map((x) => x.voucherId),
      done.varianceVoucherId,
    ]);
    return {
      tssId: done.session.tssId,
      tssAccYear: done.session.tssAccYear,
      sessionNo: done.session.tssSessionNo,
      handedOver: num(handedOver),
      received: num(received),
      difference: num(difference),
      outcome: done.outcome,
      tvrId: done.tvrId,
      tcmId: done.tvrId ? done.anchor.tcmId : null,
      treatment: done.outcome === 'DECIDED' ? decision!.treatment : null,
      tapId: done.tapId,
      varianceVoucherId: done.varianceVoucherId,
      varianceVoucherNo: done.varianceVoucherId
        ? (numbers.get(done.varianceVoucherId) ?? null)
        : null,
      receivedOn: on.date,
      selfApproval,
      movements: done.movements.map(
        ({ m, received: r, voucherId }): TillCashApprovalMovementPayload => ({
          tcmId: m.tcmId,
          tcmAccYear: m.tcmAccYear,
          tcmKind: m.tcmKind as TillMovementKind,
          tcmDocNo: m.tcmDocNo,
          handedOver: num(m.tcmAmount),
          received: num(r),
          receiveVoucherId: voucherId,
          receiveVoucherNo: voucherId ? (numbers.get(voucherId) ?? null) : null,
        }),
      ),
      session: await this.sessions.get(key),
    };
  }

  /** The session's live hand-over / drops still awaiting receipt, oldest first. */
  private awaitingOf(client: Tx | PrismaService, session: TillSession) {
    return client.tillCashMovement.findMany({
      where: {
        tcmSessionId: session.tssId,
        tcmAccYear: session.tssAccYear,
        tcmIsDeleted: false,
        tcmStatus: 'POSTED',
        tcmReceiptStatus: TillReceiptStatus.AWAITING,
      },
      orderBy: [{ tcmCreatedOn: 'asc' }, { tcmId: 'asc' }],
    });
  }

  /**
   * approve-cash with nothing awaiting: 409 TILL_CASH_ALREADY_APPROVED when it
   * was all received, else TILL_RECEIPT_NOT_AWAITING (nothing ever waited).
   */
  private async refuseNothingAwaiting(
    client: Tx | PrismaService,
    session: TillSession,
  ): Promise<never> {
    const last = await client.tillCashMovement.findFirst({
      where: {
        tcmSessionId: session.tssId,
        tcmAccYear: session.tssAccYear,
        tcmIsDeleted: false,
        tcmStatus: 'POSTED',
        tcmReceiptStatus: TillReceiptStatus.RECEIVED,
      },
      orderBy: { tcmReceivedOn: 'desc' },
      select: { tcmReceivedBy: true, tcmReceivedOn: true },
    });
    if (last) {
      throwTill(
        TillErrorCode.CASH_ALREADY_APPROVED,
        `Session ${session.tssSessionNo}'s cash has already been approved`,
        'tssId',
        {
          receivedBy: last.tcmReceivedBy ?? '',
          receivedOn: last.tcmReceivedOn?.toISOString() ?? '',
        },
      );
    }
    throwTill(
      TillErrorCode.RECEIPT_NOT_AWAITING,
      `Session ${session.tssSessionNo} handed nothing over that waits for a receipt`,
      'tssId',
    );
  }

  /** avh_voucher_no of each voucher named. */
  private async voucherNos(ids: (string | null)[]): Promise<Map<string, string>> {
    const wanted = ids.filter((id): id is string => !!id);
    if (wanted.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<{ id: string; no: string | null }[]>`
      SELECT avh_voucher_id::text AS id, avh_voucher_no::text AS no
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ANY(${wanted}::uuid[])`;
    return new Map(rows.filter((r) => r.no !== null).map((r) => [r.id, r.no!]));
  }

  /** 409 TILL_RECEIPT_NOT_AWAITING unless the row is a live bag waiting for its receipt. */
  private assertAwaiting(
    m: {
      tcmDocNo: string;
      tcmStatus: string;
      tcmReceiptStatus: string | null;
      tcmSessionId: string | null;
    },
    field: string,
  ): void {
    if (
      m.tcmStatus !== 'POSTED' ||
      m.tcmReceiptStatus !== TillReceiptStatus.AWAITING ||
      !m.tcmSessionId
    ) {
      throwTill(
        TillErrorCode.RECEIPT_NOT_AWAITING,
        m.tcmStatus !== 'POSTED'
          ? `${m.tcmDocNo} is ${m.tcmStatus}`
          : m.tcmReceiptStatus === TillReceiptStatus.RECEIVED
            ? `${m.tcmDocNo} has already been received`
            : `${m.tcmDocNo} went straight into the safe: there is nothing to receive`,
        field,
        { receiptStatus: m.tcmReceiptStatus, status: m.tcmStatus },
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Notes 110 — the second signature on a PICKUP / TOP_UP, checked before the
   * movement's transaction so a wrong PIN is journalled, not rolled back. The
   * caller is the session's cashier at its counter (TILL_MOVEMENT_AT_COUNTER
   * otherwise: no pickup is entered from the office); the supervisor is an
   * active user, not that cashier, holding Till Sessions (273) OVERRIDE
   * themselves, who types their till PIN.
   */
  private async proveSupervisor(
    input: CreateMovementInput,
    caller: TillCaller,
  ): Promise<{ userId: string; verifiedOn: Date }> {
    const session = await this.peekSession(input);
    this.assertAtCounter(session, caller);

    const what = input.kind === TillMovementKind.PICKUP ? 'pickup' : 'top-up';
    const supervisorId = input.supervisorId ?? null;
    if (!supervisorId) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        `A ${what} is signed by the supervisor standing at the counter: pick their name`,
        'supervisorId',
      );
    }
    const user = await this.prisma.userMaster.findFirst({
      where: {
        usrId: supervisorId,
        ...this.signerScope,
      },
      select: { usrLoginName: true, usrPinHash: true },
    });
    if (!user) {
      const named = await this.prisma.userMaster.findUnique({
        where: { usrId: supervisorId },
        select: { usrLoginName: true },
      });
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        `The supervisor ${named?.usrLoginName ?? supervisorId} is not an active user`,
        'supervisorId',
      );
    }
    if (supervisorId === session.tssOperatorId) {
      throwTill(
        TillErrorCode.SUPERVISOR_SELF,
        `A ${what} is two people: the cashier at the counter and a supervisor signing with their own till PIN`,
        'supervisorId',
      );
    }
    if (!(await loadRights(this.prisma, supervisorId, TILL_MENU.SESSIONS)).override) {
      throwTill(
        TillErrorCode.SUPERVISOR_RIGHT,
        `${user.usrLoginName} has no Till Sessions override right`,
        'supervisorId',
        { supervisorId },
      );
    }
    const verifiedOn = await this.verifyPin(session, user.usrLoginName, user.usrPinHash, {
      pin: input.supervisorPin,
      field: 'supervisorPin',
      codes: {
        noPin: TillErrorCode.SUPERVISOR_NO_PIN,
        required: TillErrorCode.SUPERVISOR_PIN_REQUIRED,
        wrong: TillErrorCode.SUPERVISOR_PIN,
      },
      noPinMessage: `${user.usrLoginName} signs this ${what} and has no till PIN: an administrator sets one in User Administration (menu 58)`,
      requiredMessage: `A ${what} is signed by the supervisor: ${user.usrLoginName} types their till PIN`,
      payload: { action: 'movement', kind: input.kind, supervisorId },
      detail: { supervisorId },
      caller,
    });
    return { userId: supervisorId, verifiedOn };
  }

  /**
   * The users a pickup / top-up may name as its supervisor (notes 110), shared
   * by the check and the list, before the right: active and not deleted. Not
   * narrowed to a company or branch: user_menus is not scoped, and a user's
   * home usr_company_id does not bind where they work (a SUPER ADMIN of one
   * company supervises counters of another), so 273 OVERRIDE is judged here
   * as it is for every other till right.
   */
  private readonly signerScope: Prisma.UserMasterWhereInput = {
    usrIsActive: true,
    usrIsDeleted: false,
  };

  /**
   * The witness's till PIN on /change (usr_pin_hash, notes 95), checked as
   * decide-variance checks approverPin: no PIN on the user →
   * TILL_WITNESS_NO_PIN, none typed → TILL_WITNESS_PIN_REQUIRED, wrong →
   * TILL_WITNESS_PIN, journalled PIN_FAIL on the session. Reads only, and
   * called BEFORE the movement's transaction so the PIN_FAIL row is not rolled
   * back with it. Returns when the PIN was checked.
   */
  private async checkWitnessPin(
    session: TillSession,
    ask: {
      witnessId: string;
      pin: string | null | undefined;
      kind: TillMovementKind;
      /** The body field the PIN came in. */
      pinField: string;
      /** The body field that named the witness (refused when not an active user). */
      whoField: string;
      action: 'change';
      caller: TillCaller;
    },
  ): Promise<Date> {
    const { witnessId } = ask;
    const user = await this.prisma.userMaster.findUnique({
      where: { usrId: witnessId },
      select: { usrLoginName: true, usrPinHash: true, usrIsActive: true, usrIsDeleted: true },
    });
    if (!user || !user.usrIsActive || user.usrIsDeleted) {
      throwTill(
        TillErrorCode.MOVEMENT_INVALID,
        `The witness ${user?.usrLoginName ?? witnessId} is not an active user`,
        ask.whoField,
      );
    }
    const what = ask.kind === TillMovementKind.PICKUP ? 'pickup' : 'top-up';
    return this.verifyPin(session, user.usrLoginName, user.usrPinHash, {
      pin: ask.pin,
      field: ask.pinField,
      codes: {
        noPin: TillErrorCode.WITNESS_NO_PIN,
        required: TillErrorCode.WITNESS_PIN_REQUIRED,
        wrong: TillErrorCode.WITNESS_PIN,
      },
      noPinMessage: `${user.usrLoginName} witnesses this ${what} and has no till PIN: an administrator sets one in User Administration (menu 58)`,
      requiredMessage: `A ${what} is witnessed: ${user.usrLoginName} types their till PIN`,
      payload: { action: ask.action, kind: ask.kind, witnessBy: witnessId },
      detail: { witnessBy: witnessId },
      caller: ask.caller,
    });
  }

  /**
   * The PIN half of a signature (usr_pin_hash, notes 95): none set → `noPin`
   * (422), none typed → `required` (403), wrong → `wrong` (403) after a PIN_FAIL
   * row on the session (tev_user_id = the caller). There is no lockout:
   * decide-variance has none either. Returns when the PIN was checked.
   */
  private async verifyPin(
    session: TillSession,
    login: string,
    pinHash: string | null,
    ask: {
      pin: string | null | undefined;
      field: string;
      codes: { noPin: TillErrorCode; required: TillErrorCode; wrong: TillErrorCode };
      noPinMessage: string;
      requiredMessage: string;
      /** The PIN_FAIL event's payload. */
      payload: Record<string, string>;
      /** Carried on every refusal, beside field / message / code. */
      detail: Record<string, string>;
      caller: TillCaller;
    },
  ): Promise<Date> {
    if (!pinHash) {
      throwTill(ask.codes.noPin, ask.noPinMessage, ask.field, ask.detail);
    }
    const pin = ask.pin?.trim() || null;
    if (pin === null) {
      throwTill(ask.codes.required, ask.requiredMessage, ask.field, ask.detail);
    }
    if (!(await verifySecret(pin, pinHash))) {
      await this.events.log(this.prisma, {
        companyId: session.tssCompanyId,
        branchId: session.tssBranchId,
        accYear: session.tssAccYear,
        code: TillEventCode.PIN_FAIL,
        sessionId: session.tssId,
        dayId: session.tssDayId,
        counterId: session.tssCounterId,
        deviceId: ask.caller.deviceId ?? session.tssDeviceId,
        userId: ask.caller.userId,
        srcRefno: session.tssSessionNo,
        payload: ask.payload,
      });
      throwTill(ask.codes.wrong, `${login}'s till PIN is wrong`, ask.field, ask.detail);
    }
    return new Date();
  }

  /** The session read unlocked and judged as lockSession judges it — for checks made before the transaction. */
  private async peekSession(key: {
    companyId: string;
    branchId: string;
    accYear: string;
    tssId: string;
  }): Promise<TillSession> {
    const session = await this.prisma.tillSession.findFirst({
      where: {
        tssId: key.tssId,
        tssAccYear: key.accYear,
        tssCompanyId: key.companyId,
        tssBranchId: key.branchId,
        tssIsDeleted: false,
      },
    });
    if (!session) {
      throwTillNotFound(TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
    }
    this.assertMovable(session, MOVABLE_STATUSES);
    return session;
  }

  /**
   * The session row under FOR UPDATE for the rest of the transaction — this branch's, this
   * year's, not deleted (404 TILL_SESSION_NOT_FOUND) — and in one of `statuses`
   * (assertMovable; MOVABLE_STATUSES unless the caller says otherwise).
   */
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
      throwTillNotFound(TillErrorCode.SESSION_NOT_FOUND, 'Till session', 'tssId', key.tssId);
    }
    const session = await tx.tillSession.findUniqueOrThrow({
      where: { tssId_tssAccYear: { tssId: key.tssId, tssAccYear: key.accYear } },
    });
    this.assertMovable(session, statuses);
    return session;
  }

  /**
   * The status gate: 409 TILL_SESSION_NOT_OPEN when the session is not in `statuses`, worded
   * as "its drawer is being counted"; TILL_MOVEMENT_SESSION_CLOSED when the gate is a void's
   * (VOIDABLE_STATUSES).
   */
  private assertMovable(session: TillSession, statuses: readonly TillSessionStatus[]): void {
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

  /**
   * Notes 110 — a pickup / top-up is entered at the counter by the session's
   * cashier, on its device, with the supervisor there: never from the office,
   * so a supervisor can never post one behind the cashier's back.
   */
  private assertAtCounter(session: TillSession, caller: TillCaller): void {
    if (session.tssOperatorId !== caller.userId) {
      throwTill(
        TillErrorCode.MOVEMENT_AT_COUNTER,
        'A pickup / top-up is entered at the counter by the session’s cashier, with the supervisor there',
        'kind',
      );
    }
    this.assertOperator(session, caller);
  }

  /**
   * Every denomination line is CASH — a drawer moves no card money — else
   * TILL_MOVEMENT_INVALID on `<field>.N.tenderTypeId`.
   */
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

  /**
   * The movement's reason (accounts.till_reason, 47 §1.4): a PICKUP / PAID_IN must name one of
   * its category (REASON_CATEGORY), the other kinds may name any. The reason is active, not
   * deleted, shared (no company) or this company's, of the category asked; trs_needs_note
   * wants `notes`, trs_needs_ref wants `refNo`, and a trs_max_amount > 0 caps the amount.
   * Every refusal is TILL_REASON_INVALID on the field at fault. Null when none was asked.
   */
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

  /** A PAID_IN's ledger: not deleted, shared or this company's — else TILL_MOVEMENT_INVALID. */
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

  /** The till_session row cut down to what TillPostingService stamps on a voucher and a row. */
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

  /** A uuidv7 from the database, drawn before the row so its voucher can name it (§5). */
  private async newId(tx: Tx): Promise<string> {
    const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`;
    return row.id;
  }
}
