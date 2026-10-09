import { Injectable } from '@nestjs/common';
import { Prisma, type TillCounter, type TillReason, type TillSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillContextService, type TillCaller } from '../till-context.service';
import {
  accYearOf,
  businessDateAt,
  businessDateNow,
  dateParam,
  isoDateOf,
  sessionNumber,
} from '../till-dates';
import { throwTill, throwTillBadRequest, throwTillNotFound } from '../till-errors';
import type { TillSettings } from '../till.settings';
import { TillDayService } from './till-day.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService, type TenderExpectation } from './till-ledger.service';
import { TillPostingService, type PostingSession } from './till-posting.service';
import {
  CASH_TENDER_TYPE_ID,
  HOLDING_SESSION_STATUSES,
  LIVE_SESSION_STATUSES,
  TenderCloseMode,
  TILL_MENU,
  TillCountKind,
  TillCountOutcome,
  TillCounterClaim,
  TillDayStatus,
  TillDrawerMode,
  TillErrorCode,
  TillEventCode,
  TillFloatMode,
  TillMovementKind,
  TillSessionStatus,
  TillSessionVarianceStatus,
  TillVarianceTreatment,
} from '../types/till-enum';
import type {
  TillCarriedFromPayload,
  TillCountLineInput,
  TillCountResultPayload,
  TillOpenCheckCounterPayload,
  TillOpenCheckPayload,
  TillOpenCheckSessionPayload,
  TillMovementPayload,
  TillSessionPayload,
  TillSessionTenderPayload,
  TillVariancePayload,
} from '../types/till-api.types';

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);
/** Billing: the drawer still takes money (the till strip shows its gauge). */
const MOVABLE: readonly TillSessionStatus[] = [TillSessionStatus.OPEN, TillSessionStatus.SUSPENDED];
const dec = (v: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal =>
  v === null || v === undefined ? ZERO : new Prisma.Decimal(v);
const num = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v.toFixed(2)) : 0);

export interface SessionKey {
  companyId: string;
  branchId: string;
  accYear: string;
  tssId: string;
}

/** What a money-moving post learns from the till (§7.4): the session to stamp. */
export interface LiveSessionRef {
  tssId: string;
  tssAccYear: string;
  tssCounterId: string;
  tssDeviceId: string;
  tssOperatorId: string;
  businessDate: string;
}

interface CountedTender {
  key: string;
  tenderTypeId: number;
  tenderId: string | null;
  amount: Prisma.Decimal;
  slips: number;
}

/**
 * The cashier's session (§5.2): one cashier × one counter × one stretch of
 * time, the accountability unit for one drawer (D1). Phase 1:
 *
 *   open → OPEN ⇄ SUSPENDED → (end billing) COUNTING → count 1..N (blind)
 *        → within tolerance: close → CLOSED (hand-over TDrp, TVar, Z no)
 *        → still out after the last recount: PENDING_APPROVAL, and the close
 *          answers 428 TILL_APPROVAL_REQUIRED until phase 3's gate exists.
 *
 * ONE writer per row (D11): this service is the only writer of till_session,
 * till_count and till_count_line; TillPostingService of till_cash_movement and
 * the TVar status of till_variance.
 */
@Injectable()
export class TillSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly days: TillDayService,
    private readonly ledger: TillLedgerService,
    private readonly posting: TillPostingService,
    private readonly events: TillEventService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Open
  // ═════════════════════════════════════════════════════════════════════════

  async open(input: {
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    counterId?: string | null;
    floatMode?: TillFloatMode | null;
    floatIssued?: number | null;
    prevSessionId?: string | null;
    lines: TillCountLineInput[];
    /** Counted ≠ issued: the FLOAT_MISMATCH reason (notes 98 §2). */
    reasonId?: string | null;
    notes?: string | null;
  }): Promise<TillSessionPayload> {
    const caller = await this.context.caller();
    const deviceId = this.requireDevice(caller);
    await this.knownDevice(this.prisma, deviceId);
    const settings = await this.context.settings({
      companyId: input.companyId,
      branchId: input.branchId,
      deviceId,
      userId: caller.userId,
    });

    const opened = await this.prisma.$transaction(async (tx) => {
      const { counter, claim } = await this.claimCounter(tx, {
        companyId: input.companyId,
        branchId: input.branchId,
        counterId: input.counterId ?? null,
        deviceId,
      });
      await this.assertCounterFree(tx, counter.tcnId);
      await this.assertDeviceFree(tx, deviceId);
      await this.assertOperatorFree(tx, input.companyId, caller.userId);

      const day = await this.days.ensureOpenDay(
        tx,
        { companyId: input.companyId, branchId: input.branchId, tenantId: input.tenantId ?? null },
        settings,
        caller,
        'SESSION',
      );

      // ── the float ────────────────────────────────────────────────────
      const floatMode =
        (counter.tcnDrawerMode as TillDrawerMode) === TillDrawerMode.NONE
          ? TillFloatMode.NONE
          : (input.floatMode ?? settings.floatMode);
      let floatIssued = ZERO;
      let prevSessionId: string | null = null;
      if (floatMode === TillFloatMode.ISSUED) {
        floatIssued = dec(input.floatIssued ?? counter.tcnDefaultFloat);
        if (floatIssued.isNegative()) {
          throwTill(
            TillErrorCode.FLOAT_INVALID,
            'The float issued cannot be negative',
            'floatIssued',
          );
        }
      } else if (floatMode === TillFloatMode.CARRIED) {
        const prev = await this.carriedFrom(tx, counter.tcnId, input.prevSessionId ?? null);
        prevSessionId = prev.tssId;
        floatIssued = prev.tssFloatLeft;
      } else if (input.floatIssued && input.floatIssued !== 0) {
        throwTill(TillErrorCode.FLOAT_INVALID, 'A NONE float issues nothing', 'floatIssued');
      }

      const safe = floatIssued.isZero()
        ? null
        : await this.ledger.safeFor(tx, {
            companyId: input.companyId,
            branchId: input.branchId,
            counterSafeId: counter.tcnSafeId,
          });
      if (floatMode === TillFloatMode.ISSUED && !floatIssued.isZero() && !safe) {
        throwTill(
          TillErrorCode.SAFE_MISSING,
          'An ISSUED float comes out of a safe, and this branch has none (Till Masters, menu 275)',
          'floatIssued',
        );
      }

      // ── the opening count (cash only) ────────────────────────────────
      if (floatMode === TillFloatMode.NONE && input.lines.length > 0) {
        throwTill(
          TillErrorCode.COUNT_INVALID,
          'A session with no float has nothing to count at open',
          'lines',
        );
      }
      input.lines.forEach((line, i) => {
        if (line.tenderTypeId !== CASH_TENDER_TYPE_ID) {
          throwTill(
            TillErrorCode.COUNT_INVALID,
            'The opening count is cash only',
            `lines.${i}.tenderTypeId`,
          );
        }
      });
      const priced = await this.priceLines(tx, input.companyId, input.lines);
      const floatCounted = priced.reduce((s, l) => s.plus(l.amount), ZERO);
      const floatVariance = floatCounted.minus(floatIssued);
      const floatReason = floatVariance.isZero()
        ? null
        : await this.floatMismatchReason(tx, {
            companyId: input.companyId,
            reasonId: input.reasonId ?? null,
            notes: input.notes ?? null,
          });

      // ── the row ──────────────────────────────────────────────────────
      const daySeq = await this.nextDaySeq(tx, counter.tcnId, day.businessDate);
      const session = await tx.tillSession
        .create({
          data: {
            tssCompanyId: input.companyId,
            tssBranchId: input.branchId,
            tssTenantId: input.tenantId ?? null,
            tssAccYear: day.tbdAccYear,
            tssDayId: day.tbdId,
            tssBusinessDate: dateParam(day.businessDate),
            tssCounterId: counter.tcnId,
            tssDeviceId: deviceId,
            tssOperatorId: caller.userId,
            tssSessionNo: sessionNumber(counter.tcnCode, day.businessDate, daySeq),
            tssDaySeq: daySeq,
            tssStatus: TillSessionStatus.OPEN,
            tssFloatMode: floatMode,
            tssPrevSessionId: prevSessionId,
            tssFloatIssued: floatIssued,
            tssFloatCounted: floatCounted,
            tssNotes: input.notes ?? null,
            tssCreatedBy: caller.actorName,
          },
        })
        .catch((error: unknown) => this.rethrowCounterTaken(error, counter.tcnCode));
      const postingSession = this.postingSession(session, day.businessDate);
      await this.events.log(tx, {
        companyId: input.companyId,
        branchId: input.branchId,
        accYear: session.tssAccYear,
        code: TillEventCode.SESSION_OPEN,
        sessionId: session.tssId,
        dayId: day.tbdId,
        counterId: counter.tcnId,
        deviceId,
        userId: caller.userId,
        srcRefno: session.tssSessionNo,
        amount: floatCounted,
        payload: {
          claim,
          floatMode,
          floatIssued: floatIssued.toFixed(2),
          floatCounted: floatCounted.toFixed(2),
          prevSessionId,
        },
      });

      if (floatMode !== TillFloatMode.NONE) {
        const count = await this.writeCount(tx, session, {
          kind: TillCountKind.OPEN,
          attemptNo: 1,
          isFinal: true,
          isBlind: false,
          lines: priced,
          expected: floatIssued,
          caller,
          deviceId,
        });
        await tx.tillSession.update({
          where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
          data: { tssOpenCountId: count.tctId },
        });
        if (floatMode === TillFloatMode.ISSUED && !floatIssued.isZero() && safe) {
          const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
          await this.posting.postMovement(tx, {
            session: postingSession,
            kind: TillMovementKind.FLOAT_ISSUE,
            amount: floatIssued,
            safe,
            tillCash,
            caller,
            countId: count.tctId,
          });
        }
        // Counted ≠ issued: the OPEN-stage variance (47 §6). Until the
        // FLOAT_MISMATCH approval (phase 3) it is posted here with the default
        // treatment — TVar Dr / Cr Cash Short & Excess against till cash — so
        // the till ledger holds what was counted and a close nets to the float
        // left (notes 98 §1, option b). The approver re-treats it later.
        if (floatReason) {
          const tillCash = await this.ledger.tillCashTender(tx, input.companyId, input.branchId);
          const variance = await tx.tillVariance.create({
            data: {
              tvrCompanyId: input.companyId,
              tvrBranchId: input.branchId,
              tvrTenantId: input.tenantId ?? null,
              tvrAccYear: session.tssAccYear,
              tvrSessionId: session.tssId,
              tvrStage: 'OPEN',
              tvrTenderTypeId: CASH_TENDER_TYPE_ID,
              tvrTenderId: tillCash.tenderId,
              tvrOpenAmount: floatIssued,
              tvrExpected: floatIssued,
              tvrCounted: floatCounted,
              tvrTolerance: ZERO,
              tvrTreatment: TillVarianceTreatment.EXPENSE,
              tvrReasonId: floatReason.trsId,
              tvrDecidedBy: caller.userId,
              tvrDecidedOn: new Date(),
              tvrNotes: input.notes ?? null,
              tvrStatus: 'OPEN',
              tvrCreatedBy: caller.actorName,
            },
          });
          const voucherId = await this.posting.postVariance(tx, {
            session: postingSession,
            tvrId: variance.tvrId,
            tenderLedgerId: tillCash.ledgerId,
            tenderLabel: 'Cash at open',
            variance: floatVariance,
            treatment: TillVarianceTreatment.EXPENSE,
            caller,
          });
          await this.logSessionEvent(tx, session, caller, TillEventCode.VARIANCE_DECIDED, {
            tvrId: variance.tvrId,
            stage: 'OPEN',
            treatment: TillVarianceTreatment.EXPENSE,
            byDefault: true,
            variance: floatVariance.toFixed(2),
            reasonId: floatReason.trsId,
            voucherId,
          });
        }
      }

      return session;
    });

    return this.get(
      {
        companyId: input.companyId,
        branchId: input.branchId,
        accYear: opened.tssAccYear,
        tssId: opened.tssId,
      },
      { asOperator: true },
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Reads
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The live session for this device, else for this user, in this branch —
   * what the client resumes at login (§8 S1). Null when there is none.
   */
  async current(scope: {
    companyId: string;
    branchId: string;
  }): Promise<TillSessionPayload | null> {
    const caller = await this.context.caller();
    const live = await this.prisma.tillSession.findFirst({
      where: {
        tssCompanyId: scope.companyId,
        tssBranchId: scope.branchId,
        tssIsDeleted: false,
        tssStatus: { in: [...LIVE_SESSION_STATUSES, TillSessionStatus.PENDING_APPROVAL] },
        OR: [
          ...(caller.deviceId ? [{ tssDeviceId: caller.deviceId }] : []),
          { tssOperatorId: caller.userId },
        ],
      },
      orderBy: { tssOpenedOn: 'desc' },
      select: { tssId: true, tssAccYear: true, tssOperatorId: true },
    });
    if (!live) {
      return null;
    }
    return this.get(
      { ...scope, accYear: live.tssAccYear, tssId: live.tssId },
      { asOperator: live.tssOperatorId === caller.userId },
    );
  }

  /**
   * Everything S1 needs before an open, in one read (plan-till-counter-claim §4):
   * whether this device needs a session at all, the business day, the counter it
   * is linked to or the free ones it may pick, and any session already holding
   * this device or this user. Advice only: `open` checks it all again.
   */
  async openCheck(scope: {
    companyId: string;
    branchId: string;
    deviceId?: string | null;
    userId?: string | null;
    counterId?: string | null;
  }): Promise<TillOpenCheckPayload> {
    const caller = await this.context.caller();
    const deviceId = this.requireDevice(caller);
    if (scope.deviceId && scope.deviceId !== deviceId) {
      throwTillBadRequest('deviceId is not the device this login came from', 'deviceId');
    }
    if (scope.userId && scope.userId !== caller.userId) {
      throwTillBadRequest('userId is not the user of this login', 'userId');
    }
    await this.knownDevice(this.prisma, deviceId);
    const settings = await this.context.settings({
      companyId: scope.companyId,
      branchId: scope.branchId,
      deviceId,
      userId: caller.userId,
    });

    const businessDate = await businessDateNow(this.prisma, settings.dayCutoff);
    const accYear = accYearOf(businessDate);
    const day = await this.prisma.tillBusinessDay.findFirst({
      where: {
        tbdCompanyId: scope.companyId,
        tbdBranchId: scope.branchId,
        tbdAccYear: accYear,
        tbdBusinessDate: dateParam(businessDate),
        tbdIsDeleted: false,
      },
      select: { tbdId: true, tbdStatus: true },
    });
    const [deviceSession] = await this.holdingSessions(this.prisma, { tssDeviceId: deviceId });
    const [userSessionElsewhere] = await this.holdingSessions(this.prisma, {
      tssCompanyId: scope.companyId,
      tssOperatorId: caller.userId,
      tssDeviceId: { not: deviceId },
    });
    const linked = await this.linkedCounter(this.prisma, { ...scope, deviceId });

    const payload: TillOpenCheckPayload = {
      // A counter that needs no session is as good as a back-office PC: no S1.
      requireSession: settings.requireSession && (!linked || linked.tcnRequiresSession),
      businessDay: {
        dayId: day?.tbdId ?? null,
        accYear,
        date: businessDate,
        status: (day?.tbdStatus as TillDayStatus | undefined) ?? null,
        autoOpen: settings.dayAutoOpen,
      },
      linkedCounter: null,
      freeCounters: [],
      busyCounters: [],
      deviceSession: deviceSession ?? null,
      userSessionElsewhere: userSessionElsewhere ?? null,
      carriedFrom: null,
    };
    if (!payload.requireSession) {
      return payload;
    }
    if (linked) {
      const [live] = await this.holdingSessions(this.prisma, { tssCounterId: linked.tcnId });
      const row = await this.counterRow(this.prisma, linked);
      payload.linkedCounter = {
        ...row,
        liveSessionId: live?.sessionId ?? null,
        inactive: !linked.tcnIsActive,
      };
      payload.carriedFrom = row.carriedFrom;
      return payload;
    }
    const board = await this.counterBoard(this.prisma, scope);
    payload.freeCounters = await Promise.all(
      board.free.map((c) => this.counterRow(this.prisma, c)),
    );
    payload.busyCounters = board.busy.map(({ counter, session }) => ({
      counterId: counter.tcnId,
      code: counter.tcnCode,
      name: counter.tcnName,
      session,
    }));
    payload.carriedFrom =
      payload.freeCounters.find((c) => c.counterId === scope.counterId)?.carriedFrom ?? null;
    return payload;
  }

  /**
   * One session. The figures a blind close hides (§5.4) come back NULL unless
   * the count is OPEN, the session is CLOSED, or the caller holds OVERRIDE on
   * Till Sessions (273).
   */
  async get(key: SessionKey, opts: { asOperator?: boolean } = {}): Promise<TillSessionPayload> {
    const session = await this.prisma.tillSession.findFirst({
      where: {
        tssId: key.tssId,
        tssAccYear: key.accYear,
        tssCompanyId: key.companyId,
        tssBranchId: key.branchId,
        tssIsDeleted: false,
      },
      include: { counter: { select: { tcnCode: true, tcnName: true } } },
    });
    if (!session) {
      throwTillNotFound('Till session', 'tssId', key.tssId);
    }
    const settings = await this.context.settings({
      companyId: key.companyId,
      branchId: key.branchId,
      deviceId: session.tssDeviceId,
      userId: session.tssOperatorId,
    });
    const visible = await this.expectedVisible(session, settings, opts.asOperator === true);
    return this.toPayload(session, visible);
  }

  /** The expected figures, always shown: Till Sessions (273) OVERRIDE is checked by the controller. */
  async getWithExpected(key: SessionKey): Promise<TillSessionPayload> {
    const session = await this.prisma.tillSession.findFirst({
      where: {
        tssId: key.tssId,
        tssAccYear: key.accYear,
        tssCompanyId: key.companyId,
        tssBranchId: key.branchId,
        tssIsDeleted: false,
      },
      include: { counter: { select: { tcnCode: true, tcnName: true } } },
    });
    if (!session) {
      throwTillNotFound('Till session', 'tssId', key.tssId);
    }
    return this.toPayload(session, true);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  During
  // ═════════════════════════════════════════════════════════════════════════

  async suspend(key: SessionKey, reasonId?: string | null): Promise<TillSessionPayload> {
    const caller = await this.context.caller();
    await this.prisma.$transaction(async (tx) => {
      const session = await this.lockOwn(tx, key, caller, [TillSessionStatus.OPEN]);
      await tx.tillSession.update({
        where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
        data: {
          tssStatus: TillSessionStatus.SUSPENDED,
          tssSuspendedOn: new Date(),
          tssSuspendCount: { increment: 1 },
          tssModifiedOn: new Date(),
          tssModifiedBy: caller.actorName,
        },
      });
      await this.logSessionEvent(tx, session, caller, TillEventCode.SESSION_SUSPEND, { reasonId });
    });
    return this.get(key, { asOperator: true });
  }

  async resume(key: SessionKey): Promise<TillSessionPayload> {
    const caller = await this.context.caller();
    await this.prisma.$transaction(async (tx) => {
      const session = await this.lockOwn(tx, key, caller, [TillSessionStatus.SUSPENDED]);
      const suspendedFor = session.tssSuspendedOn
        ? Math.round((Date.now() - session.tssSuspendedOn.getTime()) / 60000)
        : null;
      await tx.tillSession.update({
        where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
        data: {
          tssStatus: TillSessionStatus.OPEN,
          tssSuspendedOn: null,
          tssModifiedOn: new Date(),
          tssModifiedBy: caller.actorName,
        },
      });
      await this.logSessionEvent(tx, session, caller, TillEventCode.SESSION_RESUME, {
        suspendedMinutes: suspendedFor,
      });
    });
    return this.get(key, { asOperator: true });
  }

  /**
   * Stop taking money (S4 step 1). Held bills on the session either go to the
   * branch pool — session and counter cleared, any counter resumes them — or,
   * under till.close_with_holds = BLOCK, refuse the end with how many there are.
   */
  async endBilling(
    key: SessionKey,
    sync: { outboxCount?: number | null; lastClientSeq?: number | null } = {},
  ): Promise<TillSessionPayload> {
    const caller = await this.context.caller();
    await this.assertDeviceSynced(key, sync, caller);
    await this.prisma.$transaction(async (tx) => {
      const session = await this.lockOwn(tx, key, caller, [
        TillSessionStatus.OPEN,
        TillSessionStatus.SUSPENDED,
      ]);
      const settings = await this.context.settings({
        companyId: key.companyId,
        branchId: key.branchId,
        deviceId: session.tssDeviceId,
        userId: session.tssOperatorId,
      });

      const holds = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n
          FROM public.txn_hold
         WHERE txh_session_id = ${session.tssId}::uuid
           AND txh_is_deleted = false
           AND txh_kind = 'HOLD'
           AND txh_status IN ('HELD','LOCKED')`;
      const held = holds[0]?.n ?? 0;
      if (held > 0 && settings.closeWithHolds === 'BLOCK') {
        throwTill(
          TillErrorCode.HOLDS_OPEN,
          `${held} held bill(s) are on this session; resume or cancel them first (till.close_with_holds = BLOCK)`,
          'tssId',
          { holds: held },
        );
      }
      let released = 0;
      if (held > 0) {
        released = await tx.$executeRaw`
          UPDATE public.txn_hold
             SET txh_session_id  = NULL,
                 txh_counter_id  = NULL,
                 txh_modified_on = now(),
                 txh_modified_by = ${caller.actorName}
           WHERE txh_session_id = ${session.tssId}::uuid
             AND txh_is_deleted = false
             AND txh_kind = 'HOLD'
             AND txh_status IN ('HELD','LOCKED')`;
      }

      await tx.tillSession.update({
        where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
        data: {
          tssStatus: TillSessionStatus.COUNTING,
          tssSuspendedOn: null,
          tssBillingEndedOn: new Date(),
          tssCountMode: settings.blindClose ? 'BLIND' : 'OPEN',
          tssCountPlace: settings.countPlace,
          tssModifiedOn: new Date(),
          tssModifiedBy: caller.actorName,
        },
      });
      await this.logSessionEvent(tx, session, caller, TillEventCode.SESSION_END_BILLING, {
        holdsReleased: released,
        countMode: settings.blindClose ? 'BLIND' : 'OPEN',
      });
    });
    return this.get(key, { asOperator: true });
  }

  /**
   * REV 2 §2.6 — the count waits for the device's unsent bills. Expected cash
   * is the store server's; a till that billed while cut off still holds bills
   * in its outbox, and counting now shows a false excess (and later a false
   * shortage). The device reports its outbox and its last journal sequence;
   * anything still out refuses COUNTING with TILL_DEVICE_UNSYNCED, and the
   * attempt is logged as SYNC_PENDING_AT_CLOSE — written OUTSIDE the refused
   * transaction, so the record survives the refusal. A client that sends
   * nothing (today's) is not checked.
   */
  private async assertDeviceSynced(
    key: SessionKey,
    sync: { outboxCount?: number | null; lastClientSeq?: number | null },
    caller: TillCaller,
  ): Promise<void> {
    const outbox = sync.outboxCount ?? 0;
    if (outbox <= 0 && (sync.lastClientSeq === undefined || sync.lastClientSeq === null)) {
      return;
    }
    const session = await this.prisma.tillSession.findFirst({
      where: {
        tssId: key.tssId,
        tssAccYear: key.accYear,
        tssCompanyId: key.companyId,
        tssBranchId: key.branchId,
      },
    });
    if (!session) {
      throwTillNotFound('Till session', 'tssId', key.tssId);
    }
    let serverSeq: number | null = null;
    if (sync.lastClientSeq !== undefined && sync.lastClientSeq !== null) {
      const [row] = await this.prisma.$queryRaw<{ s: bigint | null }[]>`
        SELECT max(tev_client_seq) AS s FROM accounts.till_event
         WHERE tev_device_id = ${session.tssDeviceId}::uuid AND tev_client_seq IS NOT NULL`;
      serverSeq = row?.s === null || row?.s === undefined ? 0 : Number(row.s);
    }
    const eventsBehind = serverSeq !== null && serverSeq < (sync.lastClientSeq ?? 0);
    if (outbox <= 0 && !eventsBehind) {
      return;
    }
    await this.events.log(this.prisma, {
      companyId: session.tssCompanyId,
      branchId: session.tssBranchId,
      accYear: session.tssAccYear,
      code: TillEventCode.SYNC_PENDING_AT_CLOSE,
      sessionId: session.tssId,
      dayId: session.tssDayId,
      counterId: session.tssCounterId,
      deviceId: caller.deviceId ?? session.tssDeviceId,
      userId: caller.userId,
      srcRefno: session.tssSessionNo,
      payload: { outboxCount: outbox, lastClientSeq: sync.lastClientSeq ?? null, serverSeq },
    });
    throwTill(
      TillErrorCode.DEVICE_UNSYNCED,
      outbox > 0
        ? `This device still holds ${outbox} unsent document(s): let it sync, then end billing`
        : `The server has the device's journal up to ${serverSeq}, the device is at ${sync.lastClientSeq}: let it sync, then end billing`,
      'outboxCount',
      { outboxCount: outbox, lastClientSeq: sync.lastClientSeq ?? null, serverSeq },
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Count
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * One count attempt (S4 steps 2–3). Every attempt is its own row and stays
   * (D5). The cashier is told only ACCEPTED / RECOUNT_REQUIRED /
   * SENT_FOR_APPROVAL — never the figure in blind mode.
   *
   *  * every drawer tender within its tolerance → ACCEPTED: this attempt is
   *    final and the variances are written (WITHIN_TOLERANCE); /close posts them;
   *  * out, with a recount left (till.max_recounts) → RECOUNT_REQUIRED;
   *  * out on the last attempt → SENT_FOR_APPROVAL: final, the out-of-tolerance
   *    variances PENDING, the session PENDING_APPROVAL.
   *
   * Only the drawer decides (notes 99 §1). A SLIPS line (a card / UPI batch
   * total) out of tolerance never sends the cashier back: the gap is not in
   * the drawer, so a recount of the cash cannot find it. Its variance is
   * written PENDING with the final count (`slipCheckRequired`) for the
   * supervisor's slip check, a re-tender, then the NONCASH_VARIANCE decision
   * (non-cash plan §4.2). Until phase 3's gate that decision is reported, not
   * enforced: the session still closes, /close posts nothing for it, and the
   * card money's truth arrives with the statement (Not received / write-off).
   *
   * The expectation is frozen into the variance rows the moment the count is
   * final, so what the cashier was judged against is what the Z shows.
   */
  async count(
    key: SessionKey,
    input: { lines: TillCountLineInput[]; witnessBy?: string | null; notes?: string | null },
  ): Promise<TillCountResultPayload> {
    const caller = await this.context.caller();
    const supervisor = (await this.context.rights(TILL_MENU.SESSIONS)).override;

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockForCount(tx, key, caller, supervisor, [
        TillSessionStatus.COUNTING,
      ]);
      const settings = await this.context.settings({
        companyId: key.companyId,
        branchId: key.branchId,
        deviceId: session.tssDeviceId,
        userId: session.tssOperatorId,
      });
      const maxAttempts = 1 + settings.maxRecounts;
      if (session.tssCountAttempts >= maxAttempts) {
        throwTill(
          TillErrorCode.RECOUNT_LIMIT,
          `${session.tssCountAttempts} count(s) already made; a further recount needs RECOUNT approval`,
          'tssId',
          { event: 'RECOUNT', attempts: session.tssCountAttempts },
        );
      }
      if (input.witnessBy && input.witnessBy === caller.userId) {
        throwTill(
          TillErrorCode.COUNT_INVALID,
          'The witness must be someone other than the counter',
          'witnessBy',
        );
      }

      const expectations = await this.ledger.expected(tx, this.expectationSession(session));
      const priced = await this.priceLines(tx, key.companyId, input.lines);
      await this.assertCountable(tx, input.lines);
      if (settings.closeByTerminal) {
        this.assertTerminalNamed(input.lines, expectations);
      }
      const counted = this.countedByTender(priced, expectations);

      const rows = this.compare(expectations, counted, settings);
      const outOfTolerance = rows.filter((r) => !r.within);
      const drawerOut = outOfTolerance.filter((r) => !isSlipRow(r));
      const slipsOut = outOfTolerance.filter(isSlipRow);
      const attemptNo = session.tssCountAttempts + 1;
      const isLast = attemptNo >= maxAttempts;
      const outcome =
        drawerOut.length === 0
          ? TillCountOutcome.ACCEPTED
          : isLast
            ? TillCountOutcome.SENT_FOR_APPROVAL
            : TillCountOutcome.RECOUNT_REQUIRED;
      const isFinal = outcome !== TillCountOutcome.RECOUNT_REQUIRED;
      const slipCheckRequired = isFinal && slipsOut.length > 0;

      const countedRows = rows.filter((r) => r.counted !== null);
      const count = await this.writeCount(tx, session, {
        kind: attemptNo === 1 ? TillCountKind.CLOSE : TillCountKind.RECOUNT,
        attemptNo,
        isFinal,
        isBlind: session.tssCountMode === 'BLIND',
        lines: priced,
        expected: countedRows.reduce((s, r) => s.plus(r.expectation.expected), ZERO),
        caller,
        deviceId: caller.deviceId ?? session.tssDeviceId,
        witnessBy: input.witnessBy ?? null,
        notes: input.notes ?? null,
      });

      const cash = rows.find((r) => r.expectation.tenderTypeId === CASH_TENDER_TYPE_ID)!;
      const slips = rows.filter((r) => r.expectation.closeMode === TenderCloseMode.SLIPS);
      const sessionData: Prisma.TillSessionUpdateInput = {
        tssCountAttempts: attemptNo,
        tssModifiedOn: new Date(),
        tssModifiedBy: caller.actorName,
      };

      if (isFinal) {
        for (const row of countedRows) {
          await tx.tillVariance.create({
            data: this.varianceRow(session, row, settings, caller, outcome),
          });
        }
        Object.assign(sessionData, {
          tssCloseCountId: count.tctId,
          tssCountedOn: new Date(),
          tssCountedBy: caller.userId,
          tssWitnessBy: input.witnessBy ?? null,
          tssCashExpected: cash.expectation.expected,
          tssCashCounted: cash.counted ?? ZERO,
          tssNoncashExpected: slips.reduce((s, r) => s.plus(r.expectation.expected), ZERO),
          tssNoncashCounted: slips.reduce((s, r) => s.plus(r.counted ?? ZERO), ZERO),
          tssVarianceStatus:
            outcome === TillCountOutcome.SENT_FOR_APPROVAL || slipCheckRequired
              ? TillSessionVarianceStatus.PENDING
              : rows.every((r) => r.variance.isZero())
                ? TillSessionVarianceStatus.NONE
                : TillSessionVarianceStatus.WITHIN_TOLERANCE,
          ...(outcome === TillCountOutcome.SENT_FOR_APPROVAL
            ? { tssStatus: TillSessionStatus.PENDING_APPROVAL }
            : {}),
        } satisfies Prisma.TillSessionUpdateInput);
      }
      await tx.tillSession.update({
        where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
        data: sessionData,
      });

      await this.logSessionEvent(
        tx,
        session,
        caller,
        attemptNo === 1 ? TillEventCode.SESSION_COUNT : TillEventCode.SESSION_RECOUNT,
        { attemptNo, outcome, countId: count.tctId },
      );
      if (outcome === TillCountOutcome.SENT_FOR_APPROVAL) {
        await this.logSessionEvent(tx, session, caller, TillEventCode.APPROVAL_REQUESTED, {
          event: outOfTolerance.some((r) => r.expectation.tenderTypeId === CASH_TENDER_TYPE_ID)
            ? 'CASH_VARIANCE'
            : 'NONCASH_VARIANCE',
          variance: outOfTolerance.map((r) => ({
            tenderTypeId: r.expectation.tenderTypeId,
            tenderId: r.expectation.tenderId,
            variance: r.variance.toFixed(2),
          })),
        });
      } else if (slipCheckRequired) {
        // The drawer agreed, a slip total did not: reported for the slip check
        // and the approver (phase 3); nothing waits on it (`enforced: false`).
        await this.logSessionEvent(tx, session, caller, TillEventCode.APPROVAL_REQUESTED, {
          event: 'NONCASH_VARIANCE',
          enforced: false,
          variance: slipsOut.map((r) => ({
            tenderTypeId: r.expectation.tenderTypeId,
            tenderId: r.expectation.tenderId,
            variance: r.variance.toFixed(2),
          })),
        });
      }

      return {
        tctId: count.tctId,
        attemptNo,
        attemptsLeft: Math.max(0, maxAttempts - attemptNo),
        outcome,
        slipCheckRequired,
        status:
          isFinal && outcome === TillCountOutcome.SENT_FOR_APPROVAL
            ? TillSessionStatus.PENDING_APPROVAL
            : (session.tssStatus as TillSessionStatus),
        blind: session.tssCountMode === 'BLIND',
        operatorId: session.tssOperatorId,
      };
    });

    // The cashier of a blind count never sees the figure, even one who also
    // holds the supervisor flag: a supervisor counting SOMEONE ELSE'S drawer does.
    const ownCount = result.operatorId === caller.userId;
    const showFigures = !result.blind || (supervisor && !ownCount);
    const variances = showFigures
      ? (await this.get(key, { asOperator: ownCount })).variances
      : null;
    return {
      tssId: key.tssId,
      tssAccYear: key.accYear,
      tctId: result.tctId,
      attemptNo: result.attemptNo,
      attemptsLeft: result.attemptsLeft,
      outcome: result.outcome,
      slipCheckRequired: result.slipCheckRequired,
      tssStatus: result.status,
      variances,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Close
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * CLOSED (S4 step 4 / §5.7): the accepted count's variances posted (TVar),
   * the cash that leaves the drawer handed to the safe (TDrp CLOSE_HANDOVER),
   * the rest left as the next session's float, the totals frozen and the
   * counter's Z number issued. All in one transaction.
   *
   * A session PENDING_APPROVAL answers 428 TILL_APPROVAL_REQUIRED — the
   * approval gate is phase 3; until then a supervisor decides it there.
   */
  async close(
    key: SessionKey,
    input: { floatLeft?: number | null; notes?: string | null },
  ): Promise<TillSessionPayload> {
    const caller = await this.context.caller();
    const supervisor = (await this.context.rights(TILL_MENU.SESSIONS)).override;

    await this.prisma.$transaction(async (tx) => {
      const session = await this.lockForCount(tx, key, caller, supervisor, [
        TillSessionStatus.COUNTING,
        TillSessionStatus.PENDING_APPROVAL,
      ]);
      if ((session.tssStatus as TillSessionStatus) === TillSessionStatus.PENDING_APPROVAL) {
        const pending = await tx.tillVariance.findMany({
          where: {
            tvrSessionId: session.tssId,
            tvrAccYear: session.tssAccYear,
            tvrIsDeleted: false,
            tvrTreatment: TillVarianceTreatment.PENDING,
          },
          select: { tvrTenderTypeId: true, tvrExpected: true, tvrCounted: true },
        });
        const cashGap = pending.find((p) => p.tvrTenderTypeId === CASH_TENDER_TYPE_ID);
        throwTill(
          TillErrorCode.APPROVAL_REQUIRED,
          'The count is outside tolerance: the variance needs an approver before this session can close',
          'tssId',
          {
            event: cashGap ? 'CASH_VARIANCE' : 'NONCASH_VARIANCE',
            amount: num(
              pending.reduce(
                (s, p) => s.plus(dec(p.tvrCounted).minus(dec(p.tvrExpected)).abs()),
                ZERO,
              ),
            ),
            requiredRole: cashGap ? 'SUPERVISOR' : 'STORE_MANAGER',
            channel: 'EITHER',
          },
        );
      }
      if (!session.tssCloseCountId) {
        throwTill(
          TillErrorCode.NOT_COUNTED,
          'Count the drawer first (/till/sessions/count)',
          'tssId',
        );
      }

      const settings = await this.context.settings({
        companyId: key.companyId,
        branchId: key.branchId,
        deviceId: session.tssDeviceId,
        userId: session.tssOperatorId,
      });
      const counter = await tx.tillCounter.findUniqueOrThrow({
        where: { tcnId: session.tssCounterId },
      });
      const businessDate = isoDateOf(session.tssBusinessDate);
      const postingSession = this.postingSession(session, businessDate);

      // ── what stays in the drawer, what goes to the safe ──────────────
      const cashCounted = dec(session.tssCashCounted);
      const floatLeft =
        input.floatLeft !== undefined && input.floatLeft !== null
          ? dec(input.floatLeft)
          : settings.floatMode === TillFloatMode.CARRIED
            ? Prisma.Decimal.min(cashCounted, dec(counter.tcnDefaultFloat))
            : ZERO;
      if (floatLeft.isNegative() || floatLeft.greaterThan(cashCounted)) {
        throwTill(
          TillErrorCode.FLOAT_INVALID,
          `The float left must be between 0 and the cash counted`,
          'floatLeft',
        );
      }
      const handedOver = cashCounted.minus(floatLeft);

      // ── the variances (TVar) ─────────────────────────────────────────
      const variances = await tx.tillVariance.findMany({
        where: {
          tvrSessionId: session.tssId,
          tvrAccYear: session.tssAccYear,
          tvrIsDeleted: false,
          tvrStage: 'CLOSE',
          tvrStatus: 'OPEN',
        },
      });
      const tillCash = await this.ledger.tillCashTender(tx, key.companyId, key.branchId);
      for (const v of variances) {
        const treatment = v.tvrTreatment as TillVarianceTreatment;
        if (
          treatment !== TillVarianceTreatment.WITHIN_TOLERANCE &&
          treatment !== TillVarianceTreatment.EXPENSE
        ) {
          // phase 3 posts RECOVER / SUSPENSE; RETENDERED posts nothing; a slip
          // gap left PENDING by an accepted count stays OPEN for its decision
          continue;
        }
        const tenderLedgerId =
          v.tvrTenderTypeId === CASH_TENDER_TYPE_ID
            ? tillCash.ledgerId
            : await this.tenderLedger(tx, v.tvrTenderId, v.tvrTenderTypeId);
        await this.posting.postVariance(tx, {
          session: postingSession,
          tvrId: v.tvrId,
          tenderLedgerId,
          tenderLabel:
            v.tvrTenderTypeId === CASH_TENDER_TYPE_ID ? 'Cash' : `tender type ${v.tvrTenderTypeId}`,
          variance: dec(v.tvrCounted).minus(dec(v.tvrExpected)),
          treatment,
          caller,
        });
      }

      // ── the hand-over (TDrp) ─────────────────────────────────────────
      if (handedOver.greaterThan(0)) {
        const safe = await this.ledger.safeFor(tx, {
          companyId: key.companyId,
          branchId: key.branchId,
          counterSafeId: counter.tcnSafeId,
        });
        if (!safe) {
          throwTill(
            TillErrorCode.SAFE_MISSING,
            `${handedOver.toFixed(2)} goes to the safe at close, and this branch has none (Till Masters, menu 275)`,
            'floatLeft',
          );
        }
        await this.posting.postMovement(tx, {
          session: postingSession,
          kind: TillMovementKind.CLOSE_HANDOVER,
          amount: handedOver,
          safe,
          tillCash,
          caller,
          countId: session.tssCloseCountId,
        });
      }

      // ── frozen totals, Z, CLOSED ─────────────────────────────────────
      const totals = await this.frozenTotals(tx, session);
      const zNo = counter.tcnZLastNo + 1;
      await tx.tillCounter.update({
        where: { tcnId: counter.tcnId },
        data: { tcnZLastNo: zNo, tcnModifiedOn: new Date(), tcnModifiedBy: caller.actorName },
      });
      await tx.tillSession.update({
        where: { tssId_tssAccYear: { tssId: session.tssId, tssAccYear: session.tssAccYear } },
        data: {
          ...totals,
          tssHandedOver: handedOver,
          tssFloatLeft: floatLeft,
          tssZNo: zNo,
          tssStatus: TillSessionStatus.CLOSED,
          tssClosedOn: new Date(),
          tssClosedBy: caller.userId,
          tssNotes: input.notes ?? session.tssNotes,
          tssModifiedOn: new Date(),
          tssModifiedBy: caller.actorName,
        },
      });
      await this.logSessionEvent(tx, session, caller, TillEventCode.SESSION_CLOSE, {
        zNo,
        handedOver: handedOver.toFixed(2),
        floatLeft: floatLeft.toFixed(2),
      });
    });
    return this.get(key, { asOperator: true });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The money paths' check (§7.4)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The session a money-moving post on this device must carry, or null when
   * the till does not govern this device.
   *
   * The till governs a device that HOLDS a live session (tss_device_id — a
   * counter it picked, plan-till-counter-claim §2.2), and one LINKED to an
   * active counter (till_counter.tcn_device_id) that requires a session while
   * till.require_session holds for it. Phase 1 rollout rule: every other
   * device — the back office, the web, and every till that has not been set
   * up yet — posts as it did before: whatever session id the client sent is
   * passed through untouched (today's client sends a random uuid per app run,
   * §4, which matches no session and must not start failing bills).
   *
   * On a governed device: the session named (or, if none is named, the
   * device's live one, else the linked counter's) must be OPEN, in this
   * company and branch, on this device (§3.1), and the caller's own.
   */
  async resolveForMoney(
    client: Tx | PrismaService,
    scope: {
      companyId: string;
      branchId: string;
      sessionId: string | null | undefined;
      field: string;
      /**
       * When the document was made — a bill's own datetime. A bill made while
       * its session was live but reaching the server after the session
       * stopped billing (an offline till) is a LATE ARRIVAL: accepted, never
       * refused — the sale happened — and logged (REV 2 §2.6). It also judges
       * the business-day cut-off (§2.7). Left out = now.
       */
      docTime?: Date | null;
      /**
       * When the document REACHED this server (a bill's sb_created_on). A late
       * arrival made before billing stopped must also have arrived after it —
       * a draft that sat on the server while the session was live and is
       * posted after the end is not late, it is late to the drawer.
       */
      arrivedAt?: Date | null;
      /** Only a bill may arrive late; any other document into a closed session is refused. */
      lateArrivalOk?: boolean;
      /**
       * No session on a governed device is not a refusal: the document moves
       * no drawer money (48 §3.1 — a receipt or payment with no CASH tender).
       * A live session is still stamped on it.
       */
      optional?: boolean;
      /**
       * The document brings money INTO the drawer (a bill, a receipt): refused
       * while the drawer is over the counter's block limit — "billing stops
       * until a pickup" (§8 S2). A refund or a payment takes cash OUT and is
       * never blocked by it.
       */
      cashIn?: boolean;
    },
  ): Promise<LiveSessionRef | null> {
    const caller = await this.context.caller(client);
    if (!caller.deviceId) {
      return null;
    }
    const limits = {
      tcnId: true,
      tcnRequiresSession: true,
      tcnCashAlertLimit: true,
      tcnCashBlockLimit: true,
    } as const;
    // The session this device holds: the drawer it picked, linked or not.
    const held = await client.tillSession.findFirst({
      where: {
        tssDeviceId: caller.deviceId,
        tssCompanyId: scope.companyId,
        tssBranchId: scope.branchId,
        tssIsDeleted: false,
        tssStatus: { in: LIVE_SESSION_STATUSES as TillSessionStatus[] },
      },
      orderBy: { tssOpenedOn: 'desc' },
    });
    const counter = held
      ? await client.tillCounter.findUniqueOrThrow({
          where: { tcnId: held.tssCounterId },
          select: limits,
        })
      : await client.tillCounter.findFirst({
          where: {
            tcnDeviceId: caller.deviceId,
            tcnCompanyId: scope.companyId,
            tcnBranchId: scope.branchId,
            tcnIsDeleted: false,
            tcnIsActive: true,
          },
          select: limits,
        });
    if (!counter || (!held && !counter.tcnRequiresSession)) {
      return null;
    }
    const settings = await this.context.settings({
      companyId: scope.companyId,
      branchId: scope.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    if (!held && !settings.requireSession) {
      return null;
    }

    // The session the document names, when it IS a till session; else (no id,
    // or today's random client uuid, which names nothing) the device's live
    // one, else the linked counter's — which, run from another device, is
    // refused by assertLive (§3.1).
    const named =
      scope.sessionId && isUuidLike(scope.sessionId)
        ? await client.tillSession.findFirst({
            where: { tssId: scope.sessionId, tssIsDeleted: false },
          })
        : null;
    const session =
      named ??
      held ??
      (await client.tillSession.findFirst({
        where: {
          tssCounterId: counter.tcnId,
          tssIsDeleted: false,
          tssStatus: { in: LIVE_SESSION_STATUSES as TillSessionStatus[] },
        },
        orderBy: { tssOpenedOn: 'desc' },
      }));
    if (!session) {
      if (scope.optional) {
        return null;
      }
      throwTill(
        TillErrorCode.SESSION_REQUIRED,
        'This counter has no open till session: open one (Open Till) before taking money',
        scope.field,
      );
    }
    const status = session.tssStatus as TillSessionStatus;
    if (named && status !== TillSessionStatus.OPEN && status !== TillSessionStatus.SUSPENDED) {
      // Billing had stopped (COUNTING, PENDING_APPROVAL, CLOSED, VOIDED).
      const stoppedAt = session.tssBillingEndedOn ?? session.tssClosedOn;
      const late =
        scope.lateArrivalOk === true &&
        status !== TillSessionStatus.VOIDED &&
        !!scope.docTime &&
        !!scope.arrivedAt &&
        !!stoppedAt &&
        scope.docTime.getTime() <= stoppedAt.getTime() &&
        scope.arrivedAt.getTime() > stoppedAt.getTime();
      if (late) {
        const ref = this.assertOwnedHere(session, {
          ...scope,
          userId: caller.userId,
          deviceId: caller.deviceId,
        });
        await this.events.log(client, {
          companyId: session.tssCompanyId,
          branchId: session.tssBranchId,
          accYear: session.tssAccYear,
          code: TillEventCode.LATE_ARRIVAL,
          sessionId: session.tssId,
          dayId: session.tssDayId,
          counterId: session.tssCounterId,
          deviceId: caller.deviceId,
          userId: caller.userId,
          payload: {
            status,
            docTime: scope.docTime!.toISOString(),
            billingStoppedAt: stoppedAt.toISOString(),
          },
        });
        return ref;
      }
      if (status === TillSessionStatus.CLOSED) {
        throwTill(
          TillErrorCode.SESSION_CLOSED,
          `Session ${session.tssSessionNo} is closed: money moves in the session that is open now`,
          scope.field,
          { sessionNo: session.tssSessionNo },
        );
      }
    }
    const ref = this.assertLive(session, {
      ...scope,
      userId: caller.userId,
      deviceId: caller.deviceId,
    });
    // REV 2 §2.7 — past the business-day cut-off a session bills no more: it is
    // ended and counted (or force-closed), and the next bill needs a session on
    // the new business date. Logged outside the refused transaction.
    const today = scope.docTime
      ? await businessDateAt(client, scope.docTime, settings.dayCutoff)
      : await businessDateNow(client, settings.dayCutoff);
    if (today !== ref.businessDate) {
      await this.events.log(this.prisma, {
        companyId: session.tssCompanyId,
        branchId: session.tssBranchId,
        accYear: session.tssAccYear,
        code: TillEventCode.SESSION_DAY_ENDED,
        sessionId: session.tssId,
        dayId: session.tssDayId,
        counterId: session.tssCounterId,
        deviceId: caller.deviceId,
        userId: caller.userId,
        payload: {
          sessionDate: ref.businessDate,
          businessDateNow: today,
          cutoff: settings.dayCutoff,
        },
      });
      throwTill(
        TillErrorCode.SESSION_DAY_ENDED,
        `Session ${session.tssSessionNo} belongs to business date ${ref.businessDate}; it is now ${today} ` +
          `(cut-off ${settings.dayCutoff}). End and count it, then open a session for today.`,
        scope.field,
        { sessionDate: ref.businessDate, businessDate: today },
      );
    }
    // The limits are the drawer's: the session's counter.
    const drawer =
      session.tssCounterId === counter.tcnId
        ? counter
        : await client.tillCounter.findUniqueOrThrow({
            where: { tcnId: session.tssCounterId },
            select: limits,
          });
    if (scope.cashIn && dec(drawer.tcnCashBlockLimit).greaterThan(0)) {
      const cash = await this.cashState(client, session, drawer);
      if (cash.state === 'BLOCKED') {
        throwTill(
          TillErrorCode.CASH_BLOCKED,
          `The drawer is over its block limit (${num(dec(drawer.tcnCashBlockLimit))}): a pickup or a drop first`,
          scope.field,
          { blockLimit: num(dec(drawer.tcnCashBlockLimit)), event: 'CASH_LIMIT_OVERRIDE' },
        );
      }
    }
    return ref;
  }

  /**
   * How full the drawer is against the counter's limits (§8 S2 — "a gauge
   * against the alert limit, never the figure"): NORMAL / ALERT ("pickup
   * due") / BLOCKED (billing stops), and a 0–4 gauge in quarters of the alert
   * limit. The cash itself is the expectation's cash row, the server's own.
   */
  async cashState(
    client: Tx | PrismaService,
    session: TillSession,
    counter?: { tcnCashAlertLimit: Prisma.Decimal; tcnCashBlockLimit: Prisma.Decimal },
  ): Promise<{
    state: 'NORMAL' | 'ALERT' | 'BLOCKED';
    gauge: number | null;
    alertLimit: number;
    blockLimit: number;
    cash: Prisma.Decimal;
  }> {
    const limits =
      counter ??
      (await client.tillCounter.findUniqueOrThrow({
        where: { tcnId: session.tssCounterId },
        select: { tcnCashAlertLimit: true, tcnCashBlockLimit: true },
      }));
    const alert = dec(limits.tcnCashAlertLimit);
    const block = dec(limits.tcnCashBlockLimit);
    const expectations = await this.ledger.expected(client, this.expectationSession(session));
    const cash = expectations.find((e) => e.tenderTypeId === CASH_TENDER_TYPE_ID)?.expected ?? ZERO;
    const state =
      block.greaterThan(0) && cash.greaterThanOrEqualTo(block)
        ? 'BLOCKED'
        : alert.greaterThan(0) && cash.greaterThanOrEqualTo(alert)
          ? 'ALERT'
          : 'NORMAL';
    const gauge = alert.greaterThan(0)
      ? Math.max(0, Math.min(4, Math.floor(cash.dividedBy(alert).times(4).toNumber())))
      : null;
    return { state, gauge, alertLimit: num(alert), blockLimit: num(block), cash };
  }

  /**
   * Re-point a money document's live tender rows at the session the money
   * moved in (D7 — a draft saved earlier, or under today's random client
   * session uuid, is posted in THIS drawer). Returns how many rows moved.
   */
  async stampTenderRows(
    tx: Tx,
    ref: LiveSessionRef,
    doc: { srcDocType: string; srcDocId: string; accYear: string },
    actorName: string,
  ): Promise<number> {
    return tx.$executeRaw`
      UPDATE accounts.acc_tender_detail
         SET td_session_id  = ${ref.tssId}::uuid,
             td_modified_on = now(),
             td_modified_by = ${actorName}
       WHERE td_src_doc_type = ${doc.srcDocType}
         AND td_src_doc_id   = ${doc.srcDocId}::uuid
         AND td_acc_year     = ${doc.accYear}::char(9)
         AND td_is_deleted   = false
         AND td_is_voided    = false
         AND td_session_id IS DISTINCT FROM ${ref.tssId}::uuid`;
  }

  /**
   * A money VOUCHER (receipt, payment — 48: they join the session) and its
   * tender rows carry the session the money moved in. The header object is
   * the caller's to update in place; this writes the rows.
   */
  async stampVoucher(
    tx: Tx,
    ref: LiveSessionRef,
    doc: { voucherId: string; accYear: string; srcDocType: string },
    actorName: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE accounts.acc_voucher_header
         SET avh_session_id  = ${ref.tssId}::uuid,
             avh_modified_on = now(),
             avh_modified_by = ${actorName}
       WHERE avh_voucher_id = ${doc.voucherId}::uuid
         AND avh_acc_year   = ${doc.accYear}::char(9)
         AND avh_session_id IS DISTINCT FROM ${ref.tssId}::uuid`;
    await this.stampTenderRows(
      tx,
      ref,
      { srcDocType: doc.srcDocType, srcDocId: doc.voucherId, accYear: doc.accYear },
      actorName,
    );
  }

  /**
   * A receipt, payment or expense voucher about to post (plan-till-receipt-
   * payment-expense §2.3 / §3): which drawer its cash moves through.
   *
   *   · till.money_docs_in_session off for the device → nothing changes;
   *   · a device holding a live session (or governed by its counter) → that
   *     session, stamped on the document; CASH with no session is
   *     TILL_SESSION_REQUIRED, a document with no CASH needs none;
   *   · a back-office device in a branch that runs a till (an active counter
   *     needing a session) with CASH → till.backoffice_cash_from: SAFE puts the
   *     cash on the branch's default safe (`cashLedgerId`, so the safe book
   *     shows it and the till cash ledger never moves outside a session);
   *     REFUSE is TILL_SESSION_REQUIRED;
   *   · a branch with no till → nothing changes (the rollout rule).
   */
  async routeMoneyDoc(
    client: Tx | PrismaService,
    scope: {
      companyId: string;
      branchId: string;
      sessionId: string | null | undefined;
      field: string;
      /** Any tender row of the document is CASH (ttm_type_id 1). */
      hasCash: boolean;
      /** A receipt: money INTO the drawer, so the block limit applies. */
      cashIn?: boolean;
    },
  ): Promise<{
    ref: LiveSessionRef | null;
    /** The ledger the CASH rows post to instead of the tender's own: the default safe's. */
    cashLedgerId: string | null;
    safeName: string | null;
  }> {
    const none = { ref: null, cashLedgerId: null, safeName: null };
    const caller = await this.context.caller(client);
    if (!caller.deviceId) {
      return none;
    }
    const settings = await this.context.settings({
      companyId: scope.companyId,
      branchId: scope.branchId,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    if (!settings.moneyDocsInSession) {
      return none;
    }
    const ref = await this.resolveForMoney(client, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      sessionId: scope.sessionId,
      field: scope.field,
      optional: !scope.hasCash,
      cashIn: scope.cashIn,
    });
    if (ref || !scope.hasCash) {
      return { ...none, ref };
    }
    const tillHere = await client.tillCounter.findFirst({
      where: {
        tcnCompanyId: scope.companyId,
        tcnBranchId: scope.branchId,
        tcnIsDeleted: false,
        tcnIsActive: true,
        tcnRequiresSession: true,
      },
      select: { tcnId: true },
    });
    if (!tillHere) {
      return none;
    }
    if (settings.backofficeCashFrom === 'REFUSE') {
      throwTill(
        TillErrorCode.SESSION_REQUIRED,
        'This device is not a till, and this branch takes cash only through a till session ' +
          '(till.backoffice_cash_from = REFUSE): post it on a till, or pay by bank',
        scope.field,
      );
    }
    const safe = await this.ledger.safeFor(client as Tx, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      counterSafeId: null,
    });
    if (!safe) {
      throwTill(
        TillErrorCode.SAFE_MISSING,
        'Cash on a back-office device comes from the branch safe, and this branch has none (Till Masters, menu 275)',
        scope.field,
      );
    }
    return { ref: null, cashLedgerId: safe.ledgerId, safeName: safe.name };
  }

  /**
   * routeMoneyDoc's SAFE answer, written: the document's CASH tender rows name
   * the safe's ledger, so the safe book (and anything reading the rows) shows
   * where the cash really came from. The caller posts its CASH legs there too.
   */
  async routeCashToLedger(
    tx: Tx,
    doc: { srcDocType: string; srcDocId: string; accYear: string; ledgerId: string; actor: string },
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE accounts.acc_tender_detail
         SET td_tender_ledger_id = ${doc.ledgerId}::uuid,
             td_settle_ledger_id = NULL,
             td_modified_on      = now(),
             td_modified_by      = ${doc.actor}
       WHERE td_src_doc_type   = ${doc.srcDocType}
         AND td_src_doc_id     = ${doc.srcDocId}::uuid
         AND td_acc_year       = ${doc.accYear}::char(9)
         AND td_tender_type_id = ${CASH_TENDER_TYPE_ID}::int
         AND td_is_deleted     = false
         AND td_is_voided      = false`;
  }

  /**
   * 48 §2.3 — a receipt, payment or expense in a till session is cancelled only
   * while that session still takes money (OPEN, SUSPENDED): its cash really
   * moved, and a counted drawer is not changed after the fact. After that it is
   * corrected by a new document or an accounts journal. TILL_SESSION_CLOSED.
   */
  async assertMoneyDocCancellable(
    client: Tx | PrismaService,
    doc: { sessionId: string | null; field: string },
  ): Promise<void> {
    if (!doc.sessionId || !isUuidLike(doc.sessionId)) {
      return;
    }
    const session = await client.tillSession.findFirst({
      where: { tssId: doc.sessionId, tssIsDeleted: false },
      select: { tssSessionNo: true, tssStatus: true },
    });
    if (!session || MOVABLE.includes(session.tssStatus as TillSessionStatus)) {
      return;
    }
    throwTill(
      TillErrorCode.SESSION_CLOSED,
      `This document moved money in till session ${session.tssSessionNo}, which is ${session.tssStatus}: ` +
        'correct it with a new document or an accounts journal',
      doc.field,
      { sessionNo: session.tssSessionNo, status: session.tssStatus },
    );
  }

  /**
   * RECEIPT_POSTED / PAYMENT_POSTED / EXPENSE_POSTED / MONEY_DOC_CANCELLED / RETENDER in the
   * session's journal. A session id that names no till session (an ungoverned device's random
   * uuid) logs nothing.
   */
  async logMoneyDoc(
    tx: Tx,
    doc: {
      sessionId: string;
      code:
        | TillEventCode.RECEIPT_POSTED
        | TillEventCode.PAYMENT_POSTED
        | TillEventCode.EXPENSE_POSTED
        | TillEventCode.MONEY_DOC_CANCELLED
        | TillEventCode.RETENDER;
      srcDocType: 'RECEIPT' | 'PAYMENT' | 'EXPENSE' | 'SALE_BILL';
      srcDocId: string;
      srcRefno: string | null;
      amount: Prisma.Decimal | number;
      payload?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const session = await tx.tillSession.findFirst({
      where: { tssId: doc.sessionId, tssIsDeleted: false },
    });
    if (!session) {
      return;
    }
    const caller = await this.context.caller(tx);
    await this.events.log(tx, {
      companyId: session.tssCompanyId,
      branchId: session.tssBranchId,
      accYear: session.tssAccYear,
      code: doc.code,
      sessionId: session.tssId,
      dayId: session.tssDayId,
      counterId: session.tssCounterId,
      deviceId: caller.deviceId,
      userId: caller.userId,
      srcDocType: doc.srcDocType,
      srcDocId: doc.srcDocId,
      srcRefno: doc.srcRefno,
      amount: new Prisma.Decimal(doc.amount),
      payload: doc.payload,
    });
  }

  /**
   * 48 §2.2 — on a device holding a live session, a journal or contra with a
   * leg on the till cash ledger is refused (TILL_CASH_LEDGER_DIRECT): cash
   * enters or leaves a drawer only through a document that writes a tender
   * row, or a till movement. Back-office devices are not checked.
   */
  async assertNoTillCashLeg(
    client: Tx | PrismaService,
    scope: { companyId: string; branchId: string; ledgerIds: readonly string[]; field: string },
  ): Promise<void> {
    const caller = await this.context.caller(client);
    if (!caller.deviceId || scope.ledgerIds.length === 0) {
      return;
    }
    const held = await client.tillSession.findFirst({
      where: {
        tssDeviceId: caller.deviceId,
        tssCompanyId: scope.companyId,
        tssBranchId: scope.branchId,
        tssIsDeleted: false,
        tssStatus: { in: [...LIVE_SESSION_STATUSES] },
      },
      select: { tssSessionNo: true },
    });
    if (!held) {
      return;
    }
    const cash = await this.ledger.tillCashTender(client as Tx, scope.companyId, scope.branchId);
    if (scope.ledgerIds.includes(cash.ledgerId)) {
      throwTill(
        TillErrorCode.CASH_LEDGER_DIRECT,
        `This device is in till session ${held.tssSessionNo}: cash leaves or enters the drawer through a ` +
          'receipt, payment, expense voucher or till movement, never a journal or contra on the till cash ledger',
        scope.field,
        { sessionNo: held.tssSessionNo },
      );
    }
  }

  /**
   * D7 / §5.5: a document that took CASH in a session whose drawer has been
   * counted (COUNTING, PENDING_APPROVAL, CLOSED) is not cancelled — the cash
   * it took was counted, and a cancel would change a counted drawer after the
   * fact. A sale return takes the cash out of TODAY's drawer instead. A
   * non-cash document, or one whose session id names no till session (today's
   * random client uuid), is not the till's business.
   */
  async assertCancellable(
    client: Tx | PrismaService,
    doc: {
      sessionId: string | null;
      srcDocType: string;
      srcDocId: string;
      accYear: string;
      field: string;
    },
  ): Promise<void> {
    if (!doc.sessionId || !isUuidLike(doc.sessionId)) {
      return;
    }
    const session = await client.tillSession.findFirst({
      where: { tssId: doc.sessionId, tssIsDeleted: false },
      select: { tssSessionNo: true, tssStatus: true },
    });
    if (!session) {
      return;
    }
    const counted = [
      TillSessionStatus.COUNTING,
      TillSessionStatus.PENDING_APPROVAL,
      TillSessionStatus.CLOSED,
    ].includes(session.tssStatus as TillSessionStatus);
    if (!counted) {
      return;
    }
    const [cash] = await client.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = ${doc.srcDocType}
         AND td_src_doc_id   = ${doc.srcDocId}::uuid
         AND td_acc_year     = ${doc.accYear}::char(9)
         AND td_tender_type_id = ${CASH_TENDER_TYPE_ID}::int
         AND td_is_deleted = false
         AND td_is_voided  = false`;
    if ((cash?.n ?? 0) > 0) {
      throwTill(
        TillErrorCode.SESSION_CLOSED_USE_RETURN,
        `This document took cash in till session ${session.tssSessionNo}, which is ${session.tssStatus}: ` +
          'do a sale return, so the cash leaves today’s drawer',
        doc.field,
        { sessionNo: session.tssSessionNo, status: session.tssStatus },
      );
    }
  }

  /** A late arrival's check: this branch, this device, this cashier — whatever the status. */
  private assertOwnedHere(
    session: TillSession,
    scope: { companyId: string; branchId: string; userId: string; deviceId: string; field: string },
  ): LiveSessionRef {
    return this.assertLive({ ...session, tssStatus: TillSessionStatus.OPEN }, scope);
  }

  /** The §7.4 check itself, for a session row already in hand. */
  assertLive(
    session: TillSession,
    scope: { companyId: string; branchId: string; userId: string; deviceId: string; field: string },
  ): LiveSessionRef {
    if (session.tssCompanyId !== scope.companyId || session.tssBranchId !== scope.branchId) {
      throwTill(
        TillErrorCode.SESSION_NOT_FOUND,
        `Session ${session.tssSessionNo} belongs to another branch`,
        scope.field,
      );
    }
    if ((session.tssStatus as TillSessionStatus) !== TillSessionStatus.OPEN) {
      throwTill(
        TillErrorCode.SESSION_NOT_OPEN,
        `Session ${session.tssSessionNo} is ${session.tssStatus}: it takes no money`,
        scope.field,
        { status: session.tssStatus },
      );
    }
    if (session.tssDeviceId !== scope.deviceId) {
      throwTill(
        TillErrorCode.SESSION_WRONG_DEVICE,
        `Session ${session.tssSessionNo} was opened on another device; money posts only from it`,
        scope.field,
      );
    }
    if (session.tssOperatorId !== scope.userId) {
      throwTill(
        TillErrorCode.SESSION_NOT_YOURS,
        `Session ${session.tssSessionNo} belongs to another cashier`,
        scope.field,
      );
    }
    return {
      tssId: session.tssId,
      tssAccYear: session.tssAccYear,
      tssCounterId: session.tssCounterId,
      tssDeviceId: session.tssDeviceId,
      tssOperatorId: session.tssOperatorId,
      businessDate: isoDateOf(session.tssBusinessDate),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Internals
  // ═════════════════════════════════════════════════════════════════════════

  private requireDevice(caller: TillCaller): string {
    if (!caller.deviceId) {
      throwTill(
        TillErrorCode.DEVICE_REQUIRED,
        'A till session opens on a registered device, and this login carries none',
        'deviceId',
      );
    }
    return caller.deviceId;
  }

  /**
   * Counter claim §2 rule 1: the login's device is registered and usable. A
   * blocked device cannot log in either; this catches one blocked since.
   */
  private async knownDevice(client: Tx | PrismaService, deviceId: string): Promise<void> {
    const device = await client.deviceMaster.findFirst({
      where: { devId: deviceId, devIsDeleted: false },
      select: { devIsBlocked: true, devIsActive: true, devBlockReason: true },
    });
    if (!device) {
      throwTill(
        TillErrorCode.DEVICE_UNKNOWN,
        'This device is not registered (Device Master): no till session opens on it',
        'deviceId',
      );
    }
    if (device.devIsBlocked || !device.devIsActive) {
      const why = device.devIsBlocked
        ? `blocked${device.devBlockReason ? ` (${device.devBlockReason})` : ''}`
        : 'switched off';
      throwTill(
        TillErrorCode.DEVICE_BLOCKED,
        `This device is ${why} in Device Master: no till session opens on it`,
        'deviceId',
      );
    }
  }

  /** The counter of this branch the device is linked to (tcn_device_id), active or not. */
  private linkedCounter(
    client: Tx | PrismaService,
    scope: { companyId: string; branchId: string; deviceId: string },
  ): Promise<TillCounter | null> {
    return client.tillCounter.findFirst({
      where: {
        tcnDeviceId: scope.deviceId,
        tcnCompanyId: scope.companyId,
        tcnBranchId: scope.branchId,
        tcnIsDeleted: false,
      },
    });
  }

  /**
   * Counter claim §2.1: the counters an unlinked device may pick — this branch,
   * active, needing a session, linked to no device — split into the free ones
   * and the ones a session still holds. tcn_sort_order, then tcn_code.
   */
  private async counterBoard(
    client: Tx | PrismaService,
    scope: { companyId: string; branchId: string },
  ): Promise<{
    free: TillCounter[];
    busy: { counter: TillCounter; session: TillOpenCheckSessionPayload }[];
  }> {
    const counters = await client.tillCounter.findMany({
      where: {
        tcnCompanyId: scope.companyId,
        tcnBranchId: scope.branchId,
        tcnIsDeleted: false,
        tcnIsActive: true,
        tcnRequiresSession: true,
        tcnDeviceId: null,
      },
      orderBy: [{ tcnSortOrder: 'asc' }, { tcnCode: 'asc' }],
    });
    const holding =
      counters.length === 0
        ? []
        : await this.holdingSessions(client, {
            tssCounterId: { in: counters.map((c) => c.tcnId) },
          });
    const byCounter = new Map(holding.map((h) => [h.counterId, h]));
    return {
      free: counters.filter((c) => !byCounter.has(c.tcnId)),
      busy: counters
        .filter((c) => byCounter.has(c.tcnId))
        .map((counter) => ({ counter, session: byCounter.get(counter.tcnId)! })),
    };
  }

  private async counterRow(
    client: Tx | PrismaService,
    counter: TillCounter,
  ): Promise<TillOpenCheckCounterPayload> {
    const { prev, takenBy } = await this.lastClosed(client, counter.tcnId, null);
    return {
      counterId: counter.tcnId,
      code: counter.tcnCode,
      name: counter.tcnName,
      defaultFloat: num(counter.tcnDefaultFloat),
      carriedFrom:
        prev && !takenBy
          ? ({
              sessionId: prev.tssId,
              accYear: prev.tssAccYear,
              sessionNo: prev.tssSessionNo,
              floatLeft: num(prev.tssFloatLeft),
            } satisfies TillCarriedFromPayload)
          : null,
    };
  }

  /** Sessions still holding a drawer, newest first, with who and where — for S1's messages. */
  private async holdingSessions(
    client: Tx | PrismaService,
    where: Prisma.TillSessionWhereInput,
  ): Promise<TillOpenCheckSessionPayload[]> {
    const rows = await client.tillSession.findMany({
      where: {
        ...where,
        tssIsDeleted: false,
        tssStatus: { in: [...HOLDING_SESSION_STATUSES] },
      },
      orderBy: { tssOpenedOn: 'desc' },
      include: { counter: { select: { tcnCode: true } } },
    });
    if (rows.length === 0) {
      return [];
    }
    const [users, devices] = await Promise.all([
      client.userMaster.findMany({
        where: { usrId: { in: [...new Set(rows.map((r) => r.tssOperatorId))] } },
        select: { usrId: true, usrDisplayName: true, usrLoginName: true },
      }),
      client.deviceMaster.findMany({
        where: { devId: { in: [...new Set(rows.map((r) => r.tssDeviceId))] } },
        select: { devId: true, devDeviceName: true },
      }),
    ]);
    const userName = new Map(
      users.map((u) => [u.usrId, u.usrDisplayName?.trim() || u.usrLoginName]),
    );
    const deviceName = new Map(devices.map((d) => [d.devId, d.devDeviceName]));
    return rows.map((r) => ({
      sessionId: r.tssId,
      accYear: r.tssAccYear,
      sessionNo: r.tssSessionNo,
      counterId: r.tssCounterId,
      counterCode: r.counter.tcnCode,
      operatorId: r.tssOperatorId,
      operatorName: userName.get(r.tssOperatorId) ?? r.tssOperatorId,
      deviceId: r.tssDeviceId,
      deviceName: deviceName.get(r.tssDeviceId) ?? null,
      openedOn: r.tssOpenedOn.toISOString(),
      status: r.tssStatus as TillSessionStatus,
    }));
  }

  /**
   * Counter claim §2: the counter this open is on, locked for the rest of the
   * transaction — which serialises every open on it (day seq, Z number), so two
   * devices picking the same free counter meet at assertCounterFree (§2.3).
   *
   *   linked (rule 3)   → that counter. Another counterId is TILL_COUNTER_NOT_YOURS;
   *                       an inactive counter TILL_COUNTER_INACTIVE.
   *   unlinked (rule 4) → the counterId named, which must be on the free list.
   *
   * Nothing is written to the counter or the device: the claim is the session
   * row's (tss_device_id), and it ends when the session closes (§2.2). Linking a
   * PC to a counter is the counter master's.
   */
  private async claimCounter(
    tx: Tx,
    scope: { companyId: string; branchId: string; counterId: string | null; deviceId: string },
  ): Promise<{ counter: TillCounter; claim: TillCounterClaim }> {
    const linked = await this.linkedCounter(tx, scope);
    if (linked) {
      if (scope.counterId && scope.counterId !== linked.tcnId) {
        throwTill(
          TillErrorCode.COUNTER_NOT_YOURS,
          `This device is linked to counter ${linked.tcnCode}: it opens only there`,
          'counterId',
        );
      }
      const counter = await this.lockCounter(tx, linked.tcnId);
      if (!counter.tcnIsActive) {
        throwTill(
          TillErrorCode.COUNTER_INACTIVE,
          `Counter ${counter.tcnCode}, which this device is linked to, is inactive (Till Masters)`,
          'counterId',
        );
      }
      return { counter, claim: TillCounterClaim.LINKED };
    }

    if (!scope.counterId) {
      const board = await this.counterBoard(tx, scope);
      if (board.free.length === 0) {
        throwTill(
          TillErrorCode.NO_FREE_COUNTER,
          'This device is linked to no counter, and no counter of this branch is free',
          'counterId',
          {
            busy: board.busy.map((b) => ({
              code: b.counter.tcnCode,
              operator: b.session.operatorName,
            })),
          },
        );
      }
      throwTillBadRequest(
        'This device is linked to no counter: name one of the free counters (counterId)',
        'counterId',
      );
    }
    const found = await tx.tillCounter.findFirst({
      where: {
        tcnId: scope.counterId,
        tcnCompanyId: scope.companyId,
        tcnBranchId: scope.branchId,
        tcnIsDeleted: false,
      },
      select: { tcnId: true },
    });
    if (!found) {
      throwTill(
        TillErrorCode.COUNTER_NOT_FOUND,
        `Counter ${scope.counterId} is not a counter of this branch`,
        'counterId',
      );
    }
    const counter = await this.lockCounter(tx, found.tcnId);
    const notFree = counter.tcnDeviceId
      ? 'is linked to another device; only that device opens on it'
      : !counter.tcnIsActive
        ? 'is inactive'
        : !counter.tcnRequiresSession
          ? 'takes no till session'
          : null;
    if (notFree) {
      throwTill(
        TillErrorCode.COUNTER_NOT_YOURS,
        `Counter ${counter.tcnCode} ${notFree}: pick a free counter`,
        'counterId',
      );
    }
    // A live session on it is TILL_COUNTER_BUSY, from assertCounterFree.
    return { counter, claim: TillCounterClaim.PICKED };
  }

  private async lockCounter(tx: Tx, tcnId: string): Promise<TillCounter> {
    await tx.$queryRaw`SELECT tcn_id FROM accounts.till_counter WHERE tcn_id = ${tcnId}::uuid FOR UPDATE`;
    return tx.tillCounter.findUniqueOrThrow({ where: { tcnId } });
  }

  /**
   * §2.3's backstop: the counter lock already serialises two opens on one
   * counter, but should ux_tss_counter_live still refuse the insert, the
   * second device hears TILL_COUNTER_BUSY like any other.
   */
  private rethrowCounterTaken(error: unknown, counterCode: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      `${error.message} ${JSON.stringify(error.meta ?? {})}`.includes('counter')
    ) {
      throwTill(
        TillErrorCode.COUNTER_BUSY,
        `Counter ${counterCode} was just taken: pick another`,
        'counterId',
      );
    }
    throw error;
  }

  /**
   * Counter claim §3.2: one drawer per device. A device holding a session —
   * any cashier's — opens no other: its cashier resumes it, or a supervisor
   * force-closes it.
   */
  private async assertDeviceFree(tx: Tx, deviceId: string): Promise<void> {
    const [live] = await this.holdingSessions(tx, { tssDeviceId: deviceId });
    if (live) {
      throwTill(
        TillErrorCode.COUNTER_BUSY,
        `This device holds session ${live.sessionNo} (${live.status}) of ${live.operatorName} on counter ` +
          `${live.counterCode}: resume it, or a supervisor force-closes it`,
        'counterId',
        { sessionNo: live.sessionNo, operatorName: live.operatorName },
      );
    }
  }

  private async assertCounterFree(tx: Tx, counterId: string): Promise<void> {
    const live = await tx.tillSession.findFirst({
      where: {
        tssCounterId: counterId,
        tssIsDeleted: false,
        tssStatus: { in: [...LIVE_SESSION_STATUSES, TillSessionStatus.PENDING_APPROVAL] },
      },
      select: { tssSessionNo: true, tssStatus: true },
    });
    if (live) {
      throwTill(
        TillErrorCode.COUNTER_BUSY,
        `Counter already has session ${live.tssSessionNo} (${live.tssStatus})`,
        'counterId',
        { sessionNo: live.tssSessionNo },
      );
    }
  }

  /** One live session per operator — a service rule, NOT an index (§5.9). */
  private async assertOperatorFree(tx: Tx, companyId: string, userId: string): Promise<void> {
    const live = await tx.tillSession.findFirst({
      where: {
        tssCompanyId: companyId,
        tssOperatorId: userId,
        tssIsDeleted: false,
        tssStatus: { in: [...LIVE_SESSION_STATUSES, TillSessionStatus.PENDING_APPROVAL] },
      },
      select: { tssSessionNo: true },
    });
    if (live) {
      throwTill(
        TillErrorCode.OPERATOR_BUSY,
        `You already have session ${live.tssSessionNo} open; close or resume it first`,
        'tssOperatorId',
        { sessionNo: live.tssSessionNo },
      );
    }
  }

  /** The CLOSED session whose drawer this one inherits (CARRIED float). */
  /**
   * The FLOAT_MISMATCH reason an opening difference is filed under (notes 98
   * §2): the one named, else the shipped UNKNOWN (a company row before the
   * global one). A reason that needs a note needs the open's `notes`.
   */
  private async floatMismatchReason(
    tx: Tx,
    input: { companyId: string; reasonId: string | null; notes: string | null },
  ): Promise<TillReason> {
    const reason = await tx.tillReason.findFirst({
      where: {
        ...(input.reasonId ? { trsId: input.reasonId } : { trsCode: 'UNKNOWN' }),
        trsCategory: 'FLOAT_MISMATCH',
        trsIsDeleted: false,
        trsIsActive: true,
        OR: [{ trsCompanyId: null }, { trsCompanyId: input.companyId }],
      },
      orderBy: { trsCompanyId: { sort: 'asc', nulls: 'last' } },
    });
    if (!reason) {
      throwTill(
        TillErrorCode.REASON_INVALID,
        input.reasonId
          ? 'The reason must be an active FLOAT_MISMATCH reason'
          : 'The count differs from the float issued: name a FLOAT_MISMATCH reason',
        'reasonId',
      );
    }
    if (reason.trsNeedsNote && !input.notes?.trim()) {
      throwTill(TillErrorCode.REASON_INVALID, `“${reason.trsName}” needs a note`, 'notes');
    }
    return reason;
  }

  private async carriedFrom(tx: Tx, counterId: string, prevSessionId: string | null) {
    const { prev, takenBy } = await this.lastClosed(tx, counterId, prevSessionId);
    if (!prev) {
      throwTill(
        TillErrorCode.FLOAT_INVALID,
        prevSessionId
          ? `Session ${prevSessionId} is not a CLOSED session of this counter`
          : 'No CLOSED session on this counter left a float to carry',
        'prevSessionId',
      );
    }
    if (takenBy) {
      throwTill(
        TillErrorCode.FLOAT_INVALID,
        `The float ${prev.tssSessionNo} left was already carried into ${takenBy}`,
        'prevSessionId',
      );
    }
    return prev;
  }

  /** The counter's last CLOSED session (or the one named), and who already carried its float. */
  private async lastClosed(
    client: Tx | PrismaService,
    counterId: string,
    prevSessionId: string | null,
  ) {
    const prev = await client.tillSession.findFirst({
      where: {
        tssCounterId: counterId,
        tssIsDeleted: false,
        tssStatus: TillSessionStatus.CLOSED,
        ...(prevSessionId ? { tssId: prevSessionId } : {}),
      },
      orderBy: { tssClosedOn: 'desc' },
      select: { tssId: true, tssAccYear: true, tssFloatLeft: true, tssSessionNo: true },
    });
    if (!prev) {
      return { prev: null, takenBy: null };
    }
    const taken = await client.tillSession.findFirst({
      where: {
        tssPrevSessionId: prev.tssId,
        tssIsDeleted: false,
        tssStatus: { not: TillSessionStatus.VOIDED },
      },
      select: { tssSessionNo: true },
    });
    return { prev, takenBy: taken?.tssSessionNo ?? null };
  }

  private async nextDaySeq(tx: Tx, counterId: string, businessDate: string): Promise<number> {
    const [row] = await tx.$queryRaw<{ n: number }[]>`
      SELECT COALESCE(max(tss_day_seq), 0)::int AS n
        FROM accounts.till_session
       WHERE tss_counter_id = ${counterId}::uuid
         AND tss_business_date = ${businessDate}::date
         AND tss_acc_year = ${accYearOf(businessDate)}::char(9)`;
    return (row?.n ?? 0) + 1;
  }

  /** The session row locked, and the caller its operator on its device. */
  private async lockOwn(
    tx: Tx,
    key: SessionKey,
    caller: TillCaller,
    statuses: TillSessionStatus[],
  ): Promise<TillSession> {
    const session = await this.lock(tx, key, statuses);
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
        `Session ${session.tssSessionNo} is driven from the device it was opened on`,
        'tssId',
      );
    }
    return session;
  }

  /**
   * Count / close: the operator on the session's device, or — CASH_OFFICE
   * counting, an absent cashier — a supervisor (Till Sessions OVERRIDE) on any
   * device. Force close proper (an OPEN session) is phase 4.
   */
  private async lockForCount(
    tx: Tx,
    key: SessionKey,
    caller: TillCaller,
    supervisor: boolean,
    statuses: TillSessionStatus[],
  ): Promise<TillSession> {
    const session = await this.lock(tx, key, statuses);
    if (supervisor) {
      return session;
    }
    if (session.tssOperatorId !== caller.userId) {
      throwTill(
        TillErrorCode.SESSION_NOT_YOURS,
        `Session ${session.tssSessionNo} belongs to another cashier`,
        'tssId',
      );
    }
    if (session.tssCountPlace !== 'CASH_OFFICE' && caller.deviceId !== session.tssDeviceId) {
      throwTill(
        TillErrorCode.SESSION_WRONG_DEVICE,
        `Session ${session.tssSessionNo} is counted at its own counter`,
        'tssId',
      );
    }
    return session;
  }

  private async lock(tx: Tx, key: SessionKey, statuses: TillSessionStatus[]): Promise<TillSession> {
    const locked = await tx.$queryRaw<{ tss_id: string }[]>`
      SELECT tss_id FROM accounts.till_session
       WHERE tss_id = ${key.tssId}::uuid
         AND tss_acc_year = ${key.accYear}::char(9)
         AND tss_company_id = ${key.companyId}::uuid
         AND tss_branch_id = ${key.branchId}::uuid
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
        TillErrorCode.SESSION_NOT_OPEN,
        `Session ${session.tssSessionNo} is ${session.tssStatus}; this needs ${statuses.join(' or ')}`,
        'tssId',
        { status: session.tssStatus },
      );
    }
    return session;
  }

  /**
   * Each line's amount: a DENOM line is face value × pieces from the
   * denomination master (never the client's arithmetic — tcl_amount is
   * GENERATED from the two); any other line is the amount typed.
   */
  async priceLines(
    tx: Tx,
    companyId: string,
    lines: TillCountLineInput[],
  ): Promise<(TillCountLineInput & { faceValue: Prisma.Decimal; amount: Prisma.Decimal })[]> {
    const ids = [...new Set(lines.map((l) => l.denominationId).filter((id): id is string => !!id))];
    const denoms = ids.length
      ? await tx.tillDenomination.findMany({
          where: {
            tdnId: { in: ids },
            tdnIsDeleted: false,
            tdnIsActive: true,
            OR: [{ tdnCompanyId: null }, { tdnCompanyId: companyId }],
          },
          select: { tdnId: true, tdnValue: true },
        })
      : [];
    const valueOf = new Map(denoms.map((d) => [d.tdnId, dec(d.tdnValue)]));
    return lines.map((line, i) => {
      const qty = line.qty ?? 0;
      if (!Number.isInteger(qty) || qty < 0) {
        throwTill(
          TillErrorCode.COUNT_INVALID,
          'A quantity is a whole number of pieces or slips',
          `lines.${i}.qty`,
        );
      }
      if (line.denominationId) {
        const face = valueOf.get(line.denominationId);
        if (!face) {
          throwTill(
            TillErrorCode.COUNT_INVALID,
            'Unknown or withdrawn denomination',
            `lines.${i}.denominationId`,
          );
        }
        if (line.tenderTypeId !== CASH_TENDER_TYPE_ID) {
          throwTill(
            TillErrorCode.COUNT_INVALID,
            'Only cash is counted by denomination',
            `lines.${i}.denominationId`,
          );
        }
        return { ...line, faceValue: face, amount: face.times(qty) };
      }
      const entered = dec(line.enteredAmount ?? 0);
      if (entered.isNegative()) {
        throwTill(
          TillErrorCode.COUNT_INVALID,
          'An amount counted cannot be negative',
          `lines.${i}.enteredAmount`,
        );
      }
      return { ...line, faceValue: ZERO, amount: entered };
    });
  }

  /**
   * The denomination count of a movement (PICKUP, a TOP_UP's FLOAT_ISSUE,
   * either side of an EXCHANGE): its own till_count row naming the movement,
   * written here so till_count keeps one writer.
   */
  async writeMovementCount(
    tx: Tx,
    session: TillSession,
    input: {
      kind: TillCountKind;
      lines: (TillCountLineInput & { faceValue: Prisma.Decimal; amount: Prisma.Decimal })[];
      safeId: string | null;
      movementId: string;
      caller: TillCaller;
      deviceId: string;
      witnessBy?: string | null;
    },
  ): Promise<string> {
    const total = input.lines.reduce((s, l) => s.plus(l.amount), ZERO);
    const count = await this.writeCount(tx, session, {
      kind: input.kind,
      attemptNo: 1,
      isFinal: true,
      isBlind: false,
      lines: input.lines,
      expected: total,
      caller: input.caller,
      deviceId: input.deviceId,
      witnessBy: input.witnessBy ?? null,
    });
    await tx.tillCount.update({
      where: { tctId_tctAccYear: { tctId: count.tctId, tctAccYear: session.tssAccYear } },
      data: { tctSafeId: input.safeId, tctMovementId: input.movementId },
    });
    return count.tctId;
  }

  /** STATEMENT / NONE tenders are never counted at the till (47 §1.8). */
  private async assertCountable(tx: Tx, lines: TillCountLineInput[]): Promise<void> {
    const typeIds = [...new Set(lines.map((l) => l.tenderTypeId))];
    if (typeIds.length === 0) {
      return;
    }
    const types = await tx.accTenderType.findMany({
      where: { ttmTypeId: { in: typeIds } },
      select: { ttmTypeId: true, ttmTypeName: true, ttmCloseMode: true },
    });
    const byId = new Map(types.map((t) => [t.ttmTypeId, t]));
    lines.forEach((line, i) => {
      const type = byId.get(line.tenderTypeId);
      if (!type) {
        throwTill(
          TillErrorCode.COUNT_INVALID,
          `Unknown tender type ${line.tenderTypeId}`,
          `lines.${i}.tenderTypeId`,
        );
      }
      if (
        (type.ttmCloseMode as TenderCloseMode) !== TenderCloseMode.DENOM &&
        (type.ttmCloseMode as TenderCloseMode) !== TenderCloseMode.SLIPS
      ) {
        throwTill(
          TillErrorCode.COUNT_INVALID,
          `${type.ttmTypeName} is not counted at the till (${type.ttmCloseMode}): it is reconciled against its statement`,
          `lines.${i}.tenderTypeId`,
        );
      }
    });
  }

  /**
   * Non-cash plan §4.1 (`tender.close_by_terminal`): one batch total per
   * terminal. A slip line that names no tender is taken as its type's only
   * row — which is a guess once the session took that money on two terminals
   * (CARD-T1, CARD-T2): then the line must say which.
   */
  private assertTerminalNamed(
    lines: TillCountLineInput[],
    expectations: TenderExpectation[],
  ): void {
    lines.forEach((line, i) => {
      if (line.tenderTypeId === CASH_TENDER_TYPE_ID || line.tenderId) {
        return;
      }
      const terminals = expectations.filter((e) => e.tenderTypeId === line.tenderTypeId);
      if (terminals.length > 1) {
        throwTill(
          TillErrorCode.COUNT_INVALID,
          `This session took ${terminals[0].tenderTypeName} money on ${terminals.length} terminals ` +
            `(${terminals.map((t) => t.tenderName ?? t.tenderId).join(', ')}): count each batch on its own line, naming its tender`,
          `lines.${i}.tenderId`,
        );
      }
    });
  }

  /**
   * Counted money per expectation row. Cash: every cash line, one drawer.
   * Slips: by (type, tender); a line that names no tender goes to the only
   * row of its type. A counted tender nobody expected becomes a row of its
   * own with nothing expected — an excess, not a silently dropped slip.
   */
  private countedByTender(
    priced: (TillCountLineInput & { amount: Prisma.Decimal })[],
    expectations: TenderExpectation[],
  ): Map<string, CountedTender> {
    const counted = new Map<string, CountedTender>();
    const add = (
      key: string,
      typeId: number,
      tenderId: string | null,
      amount: Prisma.Decimal,
      slips: number,
    ) => {
      const row = counted.get(key) ?? {
        key,
        tenderTypeId: typeId,
        tenderId,
        amount: ZERO,
        slips: 0,
      };
      row.amount = row.amount.plus(amount);
      row.slips += slips;
      counted.set(key, row);
    };
    for (const line of priced) {
      if (line.tenderTypeId === CASH_TENDER_TYPE_ID) {
        const cash = expectations.find((e) => e.tenderTypeId === CASH_TENDER_TYPE_ID)!;
        add(
          tenderKey(cash.tenderTypeId, cash.tenderId),
          cash.tenderTypeId,
          cash.tenderId,
          line.amount,
          0,
        );
        continue;
      }
      let tenderId = line.tenderId ?? null;
      if (!tenderId) {
        const ofType = expectations.filter((e) => e.tenderTypeId === line.tenderTypeId);
        if (ofType.length === 1) {
          tenderId = ofType[0].tenderId;
        }
      }
      add(
        tenderKey(line.tenderTypeId, tenderId),
        line.tenderTypeId,
        tenderId,
        line.amount,
        line.qty ?? 0,
      );
    }
    return counted;
  }

  /** Expected vs counted, per row, with its tolerance verdict. */
  private compare(
    expectations: TenderExpectation[],
    counted: Map<string, CountedTender>,
    settings: TillSettings,
  ): {
    expectation: TenderExpectation;
    counted: Prisma.Decimal | null;
    slips: number | null;
    variance: Prisma.Decimal;
    tolerance: Prisma.Decimal;
    within: boolean;
  }[] {
    const rows: ReturnType<TillSessionService['compare']> = [];
    const seen = new Set<string>();
    for (const e of expectations) {
      const key = tenderKey(e.tenderTypeId, e.tenderId);
      seen.add(key);
      const countable =
        e.closeMode === TenderCloseMode.DENOM || e.closeMode === TenderCloseMode.SLIPS;
      if (!countable) {
        rows.push({
          expectation: e,
          counted: null,
          slips: null,
          variance: ZERO,
          tolerance: ZERO,
          within: true,
        });
        continue;
      }
      const c = counted.get(key);
      const amount = c?.amount ?? ZERO;
      const tolerance =
        e.tenderTypeId === CASH_TENDER_TYPE_ID ? settings.cashTolerance : settings.noncashTolerance;
      const variance = amount.minus(e.expected);
      rows.push({
        expectation: e,
        counted: amount,
        slips: c ? c.slips : 0,
        variance,
        tolerance,
        within: variance.abs().lessThanOrEqualTo(tolerance),
      });
    }
    for (const [key, c] of counted) {
      if (seen.has(key)) {
        continue;
      }
      const orphan: TenderExpectation = {
        tenderTypeId: c.tenderTypeId,
        tenderTypeName: String(c.tenderTypeId),
        closeMode: TenderCloseMode.SLIPS,
        tenderId: c.tenderId,
        tenderName: null,
        ledgerId: null,
        open: ZERO,
        sales: ZERO,
        refund: ZERO,
        receipt: ZERO,
        payment: ZERO,
        expense: ZERO,
        movedIn: ZERO,
        movedOut: ZERO,
        paidFromBank: ZERO,
        txnCount: 0,
        noRefCount: 0,
        expected: ZERO,
      };
      const tolerance = settings.noncashTolerance;
      rows.push({
        expectation: orphan,
        counted: c.amount,
        slips: c.slips,
        variance: c.amount,
        tolerance,
        within: c.amount.abs().lessThanOrEqualTo(tolerance),
      });
    }
    return rows;
  }

  private varianceRow(
    session: TillSession,
    row: ReturnType<TillSessionService['compare']>[number],
    settings: TillSettings,
    caller: TillCaller,
    outcome: TillCountOutcome,
  ): Prisma.TillVarianceUncheckedCreateInput {
    const e = row.expectation;
    // A slip gap waits for its decision even when the drawer was accepted (notes 99 §1).
    const pending =
      !row.within && (outcome === TillCountOutcome.SENT_FOR_APPROVAL || isSlipRow(row));
    return {
      tvrCompanyId: session.tssCompanyId,
      tvrBranchId: session.tssBranchId,
      tvrTenantId: session.tssTenantId,
      tvrAccYear: session.tssAccYear,
      tvrSessionId: session.tssId,
      tvrStage: 'CLOSE',
      tvrTenderTypeId: e.tenderTypeId,
      tvrTenderId: e.tenderId,
      tvrOpenAmount: e.open,
      tvrSalesAmount: e.sales,
      tvrRefundAmount: e.refund,
      tvrReceiptAmount: e.receipt,
      tvrPaymentAmount: e.payment,
      tvrExpenseAmount: e.expense,
      tvrMovedIn: e.movedIn,
      tvrMovedOut: e.movedOut,
      tvrTxnCount: e.txnCount,
      tvrExpected: e.expected,
      tvrCounted: row.counted ?? ZERO,
      tvrSlipCount: e.closeMode === TenderCloseMode.SLIPS ? row.slips : null,
      tvrTolerance: row.tolerance,
      tvrTreatment: pending
        ? TillVarianceTreatment.PENDING
        : TillVarianceTreatment.WITHIN_TOLERANCE,
      tvrDecidedBy: pending ? null : caller.userId,
      tvrDecidedOn: pending ? null : new Date(),
      tvrStatus: 'OPEN',
      tvrCreatedBy: caller.actorName,
    };
  }

  private async writeCount(
    tx: Tx,
    session: TillSession,
    input: {
      kind: TillCountKind;
      attemptNo: number;
      isFinal: boolean;
      isBlind: boolean;
      lines: (TillCountLineInput & { faceValue: Prisma.Decimal; amount: Prisma.Decimal })[];
      expected: Prisma.Decimal;
      caller: TillCaller;
      deviceId: string;
      witnessBy?: string | null;
      notes?: string | null;
    },
  ): Promise<{ tctId: string }> {
    const total = input.lines.reduce((s, l) => s.plus(l.amount), ZERO);
    const count = await tx.tillCount.create({
      data: {
        tctCompanyId: session.tssCompanyId,
        tctBranchId: session.tssBranchId,
        tctTenantId: session.tssTenantId,
        tctAccYear: session.tssAccYear,
        tctKind: input.kind,
        tctSessionId: session.tssId,
        tctAttemptNo: input.attemptNo,
        tctIsFinal: input.isFinal,
        tctIsBlind: input.isBlind,
        tctCountedBy: input.caller.userId,
        tctWitnessBy: input.witnessBy ?? null,
        tctDeviceId: input.deviceId,
        tctTotalCounted: total,
        tctExpected: input.expected,
        tctNotes: input.notes ?? null,
        tctCreatedBy: input.caller.actorName,
      },
      select: { tctId: true },
    });
    if (input.lines.length > 0) {
      await tx.tillCountLine.createMany({
        data: input.lines.map((line, i) => ({
          tclAccYear: session.tssAccYear,
          tclCountId: count.tctId,
          tclRowNo: i + 1,
          tclTenderTypeId: line.tenderTypeId,
          tclTenderId: line.tenderId ?? null,
          tclDenominationId: line.denominationId ?? null,
          tclFaceValue: line.faceValue,
          tclQty: new Prisma.Decimal(line.qty ?? 0),
          tclEnteredAmount: line.denominationId ? ZERO : line.amount,
          tclBatchRef: line.batchRef ?? null,
        })),
      });
    }
    return count;
  }

  /** The counts §5 freezes at close, from the session's own documents. */
  private async frozenTotals(tx: Tx, session: TillSession): Promise<Prisma.TillSessionUpdateInput> {
    const [docs] = await tx.$queryRaw<
      { bills: number; bill_amt: Prisma.Decimal; returns: number; return_amt: Prisma.Decimal }[]
    >`
      SELECT (SELECT count(*)::int FROM sales.sale_bill
               WHERE sb_session_id = ${session.tssId}::uuid AND sb_acc_year = ${session.tssAccYear}::char(9)
                 AND sb_status = 'POSTED') AS bills,
             (SELECT COALESCE(sum(sb_bill_amt), 0) FROM sales.sale_bill
               WHERE sb_session_id = ${session.tssId}::uuid AND sb_acc_year = ${session.tssAccYear}::char(9)
                 AND sb_status = 'POSTED') AS bill_amt,
             (SELECT count(*)::int FROM sales.sale_return
               WHERE sr_session_id = ${session.tssId}::uuid AND sr_acc_year = ${session.tssAccYear}::char(9)
                 AND sr_status = 'POSTED') AS returns,
             (SELECT COALESCE(sum(sr_return_amt), 0) FROM sales.sale_return
               WHERE sr_session_id = ${session.tssId}::uuid AND sr_acc_year = ${session.tssAccYear}::char(9)
                 AND sr_status = 'POSTED') AS return_amt`;
    const [money] = await tx.$queryRaw<{ receipts: number; payments: number; expenses: number }[]>`
      SELECT count(DISTINCT t.td_voucher_id) FILTER (WHERE t.td_src_doc_type = 'RECEIPT')::int AS receipts,
             count(DISTINCT t.td_voucher_id) FILTER (WHERE t.td_src_doc_type = 'PAYMENT')::int AS payments,
             count(DISTINCT t.td_voucher_id) FILTER (WHERE t.td_src_doc_type = 'EXPENSE')::int AS expenses
        FROM accounts.acc_tender_detail t
        JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = t.td_voucher_id
       WHERE t.td_session_id = ${session.tssId}::uuid
         AND t.td_acc_year = ${session.tssAccYear}::char(9)
         AND t.td_is_deleted = false
         AND h.avh_voucher_status = 'POSTED'`;
    const [noSale] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.till_event
       WHERE tev_session_id = ${session.tssId}::uuid
         AND tev_acc_year = ${session.tssAccYear}::char(9)
         AND tev_event_code = ${TillEventCode.NO_SALE}`;
    return {
      tssBillCount: docs.bills,
      tssReturnCount: docs.returns,
      tssReceiptCount: money.receipts,
      tssPaymentCount: money.payments,
      tssExpenseCount: money.expenses,
      tssNoSaleCount: noSale.n,
      tssNetSales: dec(docs.bill_amt).minus(dec(docs.return_amt)),
    };
  }

  private async tenderLedger(tx: Tx, tenderId: string | null, typeId: number): Promise<string> {
    const tender = tenderId
      ? await tx.accTenderMaster.findUnique({
          where: { tndId: tenderId },
          select: { tndLedgerId: true },
        })
      : null;
    if (!tender) {
      throwTill(
        TillErrorCode.LEDGER_UNMAPPED,
        `A tender type ${typeId} variance names no tender, so it has no ledger to post to`,
        'tvrTenderId',
      );
    }
    return tender.tndLedgerId;
  }

  private async expectedVisible(
    session: TillSession,
    settings: TillSettings,
    asOperator: boolean,
  ): Promise<boolean> {
    if (
      (session.tssStatus as TillSessionStatus) === TillSessionStatus.CLOSED ||
      (session.tssStatus as TillSessionStatus) === TillSessionStatus.VOIDED
    ) {
      return true;
    }
    const blind = session.tssCountMode ? session.tssCountMode === 'BLIND' : settings.blindClose;
    if (!blind) {
      return true;
    }
    if (asOperator) {
      return false;
    }
    return (await this.context.rights(TILL_MENU.SESSIONS)).override;
  }

  private async toPayload(
    session: TillSession & { counter: { tcnCode: string; tcnName: string } },
    visible: boolean,
  ): Promise<TillSessionPayload> {
    const operator = await this.prisma.userMaster.findUnique({
      where: { usrId: session.tssOperatorId },
      select: { usrLoginName: true, usrDisplayName: true },
    });
    const [movements, variances, finalLines] = await Promise.all([
      this.prisma.tillCashMovement.findMany({
        where: { tcmSessionId: session.tssId, tcmAccYear: session.tssAccYear, tcmIsDeleted: false },
        orderBy: { tcmCreatedOn: 'asc' },
      }),
      this.prisma.tillVariance.findMany({
        where: { tvrSessionId: session.tssId, tvrAccYear: session.tssAccYear, tvrIsDeleted: false },
        orderBy: [{ tvrStage: 'desc' }, { tvrTenderTypeId: 'asc' }],
      }),
      session.tssCloseCountId
        ? this.prisma.tillCountLine.findMany({
            where: { tclCountId: session.tssCloseCountId, tclAccYear: session.tssAccYear },
          })
        : Promise.resolve([]),
    ]);

    const live = [
      TillSessionStatus.OPEN,
      TillSessionStatus.SUSPENDED,
      TillSessionStatus.COUNTING,
    ].includes(session.tssStatus as TillSessionStatus);
    const expectations = await this.ledger.expected(this.prisma, this.expectationSession(session));
    const closeVariance = variances.filter(
      (v) => v.tvrStage === 'CLOSE' && v.tvrStatus !== 'REVERSED',
    );
    const tenders: TillSessionTenderPayload[] = expectations.map((e) => {
      const frozen = live
        ? undefined
        : closeVariance.find(
            (v) => v.tvrTenderTypeId === e.tenderTypeId && v.tvrTenderId === e.tenderId,
          );
      const counted =
        frozen?.tvrCounted ??
        (e.closeMode === TenderCloseMode.DENOM || e.closeMode === TenderCloseMode.SLIPS
          ? finalLines.length > 0
            ? finalLines
                .filter((l) =>
                  e.tenderTypeId === CASH_TENDER_TYPE_ID
                    ? l.tclTenderTypeId === CASH_TENDER_TYPE_ID
                    : l.tclTenderTypeId === e.tenderTypeId &&
                      (l.tclTenderId ?? e.tenderId) === e.tenderId,
                )
                .reduce((s, l) => s.plus(dec(l.tclAmount)), ZERO)
            : null
          : null);
      const show = (v: Prisma.Decimal | null | undefined): number | null =>
        visible ? num(v ?? ZERO) : null;
      const expected = frozen ? dec(frozen.tvrExpected) : e.expected;
      return {
        tenderTypeId: e.tenderTypeId,
        tenderTypeName: e.tenderTypeName,
        tenderId: e.tenderId,
        tenderName: e.tenderName,
        closeMode: e.closeMode,
        openAmount: show(frozen ? dec(frozen.tvrOpenAmount) : e.open),
        salesAmount: show(frozen ? dec(frozen.tvrSalesAmount) : e.sales),
        refundAmount: show(frozen ? dec(frozen.tvrRefundAmount) : e.refund),
        receiptAmount: show(frozen ? dec(frozen.tvrReceiptAmount) : e.receipt),
        paymentAmount: show(frozen ? dec(frozen.tvrPaymentAmount) : e.payment),
        expenseAmount: show(frozen ? dec(frozen.tvrExpenseAmount) : e.expense),
        movedIn: show(frozen ? dec(frozen.tvrMovedIn) : e.movedIn),
        movedOut: show(frozen ? dec(frozen.tvrMovedOut) : e.movedOut),
        paidFromBank: show(e.paidFromBank),
        txnCount: visible ? (frozen ? frozen.tvrTxnCount : e.txnCount) : null,
        noRefCount: e.noRefCount,
        expected: show(expected),
        counted: counted === null || counted === undefined ? null : num(dec(counted)),
        variance:
          visible && counted !== null && counted !== undefined
            ? num(dec(counted).minus(expected))
            : null,
      };
    });

    const hide = (v: Prisma.Decimal | null): number | null => (visible ? num(v ?? ZERO) : null);
    return {
      tssId: session.tssId,
      tssAccYear: session.tssAccYear,
      tssCompanyId: session.tssCompanyId,
      tssBranchId: session.tssBranchId,
      tssDayId: session.tssDayId,
      tssBusinessDate: isoDateOf(session.tssBusinessDate),
      tssCounterId: session.tssCounterId,
      counterCode: session.counter.tcnCode,
      counterName: session.counter.tcnName,
      tssDeviceId: session.tssDeviceId,
      tssOperatorId: session.tssOperatorId,
      operatorName: operator?.usrDisplayName ?? operator?.usrLoginName ?? null,
      tssSessionNo: session.tssSessionNo,
      tssDaySeq: session.tssDaySeq,
      tssStatus: session.tssStatus as TillSessionStatus,
      tssOpenedOn: session.tssOpenedOn.toISOString(),
      tssFloatMode: session.tssFloatMode as TillFloatMode,
      tssPrevSessionId: session.tssPrevSessionId,
      tssFloatIssued: num(session.tssFloatIssued),
      tssFloatCounted: num(session.tssFloatCounted),
      tssFloatVariance: num(dec(session.tssFloatCounted).minus(dec(session.tssFloatIssued))),
      tssSuspendCount: session.tssSuspendCount,
      tssSuspendedOn: session.tssSuspendedOn?.toISOString() ?? null,
      tssBillingEndedOn: session.tssBillingEndedOn?.toISOString() ?? null,
      tssCountMode: session.tssCountMode as 'BLIND' | 'OPEN' | null,
      tssCountPlace: session.tssCountPlace as 'COUNTER' | 'CASH_OFFICE' | null,
      tssCountAttempts: session.tssCountAttempts,
      tssCountedOn: session.tssCountedOn?.toISOString() ?? null,
      tssClosedOn: session.tssClosedOn?.toISOString() ?? null,
      tssClosedBy: session.tssClosedBy,
      tssZNo: session.tssZNo,
      tssVarianceStatus: session.tssVarianceStatus as TillSessionVarianceStatus,
      totals: {
        billCount: session.tssBillCount,
        returnCount: session.tssReturnCount,
        receiptCount: session.tssReceiptCount,
        paymentCount: session.tssPaymentCount,
        expenseCount: session.tssExpenseCount,
        netSales: hide(session.tssNetSales),
        cashExpected: hide(session.tssCashExpected),
        cashCounted: hide(session.tssCashCounted),
        cashVariance: hide(dec(session.tssCashCounted).minus(dec(session.tssCashExpected))),
        noncashExpected: hide(session.tssNoncashExpected),
        noncashCounted: hide(session.tssNoncashCounted),
        noncashVariance: hide(
          dec(session.tssNoncashCounted).minus(dec(session.tssNoncashExpected)),
        ),
        handedOver: num(session.tssHandedOver),
        floatLeft: num(session.tssFloatLeft),
      },
      expectedVisible: visible,
      cashLimit: MOVABLE.includes(session.tssStatus as TillSessionStatus)
        ? await this.cashState(this.prisma, session).then(
            ({ state, gauge, alertLimit, blockLimit }) => ({
              state,
              gauge,
              alertLimit,
              blockLimit,
            }),
          )
        : null,
      tenders,
      movements: movements.map(
        (m): TillMovementPayload => ({
          tcmId: m.tcmId,
          tcmAccYear: m.tcmAccYear,
          tcmKind: m.tcmKind as TillMovementKind,
          tcmDocNo: m.tcmDocNo,
          tcmDocDate: isoDateOf(m.tcmDocDate),
          tcmAmount: num(m.tcmAmount),
          tcmSafeId: m.tcmSafeId,
          tcmVoucherId: m.tcmVoucherId,
          tcmStatus: m.tcmStatus as 'POSTED' | 'VOIDED',
          tcmCreatedOn: m.tcmCreatedOn.toISOString(),
        }),
      ),
      variances: visible
        ? variances.map(
            (v): TillVariancePayload => ({
              tvrId: v.tvrId,
              tvrAccYear: v.tvrAccYear,
              tvrStage: v.tvrStage as 'OPEN' | 'CLOSE',
              tvrTenderTypeId: v.tvrTenderTypeId,
              tvrTenderId: v.tvrTenderId,
              tvrExpected: num(v.tvrExpected),
              tvrCounted: num(v.tvrCounted),
              tvrVariance: num(dec(v.tvrCounted).minus(dec(v.tvrExpected))),
              tvrTolerance: num(v.tvrTolerance),
              tvrTreatment: v.tvrTreatment as TillVarianceTreatment,
              tvrReasonId: v.tvrReasonId,
              tvrStatus: v.tvrStatus as 'OPEN' | 'POSTED' | 'REVERSED',
              tvrVoucherId: v.tvrVoucherId,
            }),
          )
        : [],
    };
  }

  private expectationSession(session: TillSession) {
    return {
      tssId: session.tssId,
      tssAccYear: session.tssAccYear,
      tssCompanyId: session.tssCompanyId,
      tssBranchId: session.tssBranchId,
      tssFloatCounted: dec(session.tssFloatCounted),
      tssClosedOn: session.tssClosedOn,
    };
  }

  private postingSession(session: TillSession, businessDate: string): PostingSession {
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
      businessDate,
    };
  }

  private async logSessionEvent(
    tx: Tx,
    session: TillSession,
    caller: TillCaller,
    code: TillEventCode,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.events.log(tx, {
      companyId: session.tssCompanyId,
      branchId: session.tssBranchId,
      accYear: session.tssAccYear,
      code,
      sessionId: session.tssId,
      dayId: session.tssDayId,
      counterId: session.tssCounterId,
      deviceId: caller.deviceId ?? session.tssDeviceId,
      userId: caller.userId,
      srcRefno: session.tssSessionNo,
      payload: payload as Prisma.InputJsonValue,
    });
  }
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(value: string): boolean {
  return UUID_LIKE.test(value);
}

function tenderKey(typeId: number, tenderId: string | null): string {
  return `${typeId}|${tenderId ?? '*'}`;
}

/** A batch-total line (card / UPI slips): its gap is not in the drawer (notes 99 §1). */
function isSlipRow(row: { expectation: { closeMode: TenderCloseMode } }): boolean {
  return row.expectation.closeMode === TenderCloseMode.SLIPS;
}

// re-exported for the controller's 400s
export { throwTillBadRequest };
