/**
 * The payload interfaces every /till/* route answers inside TillSuccessResponse — the `data`
 * the Swagger classes of dto/till-response.dto.ts stand for. Built by the services
 * (TillSessionService, TillDayService, TillDayCloseService, TillMovementService,
 * TillSafeService, TillApprovalGateService, TillReviewService …), handed through the
 * controllers, read by the print providers (TillPrintService) and the clients; nothing here is
 * validated. The one input shape, TillCountLineInput, is what the services take from
 * TillCountLineDto.
 *
 * Sections, in route order: the error body (TillErrorDetail is the row throwTill builds) ·
 * the business day (days/get · close-check · close · reopen) · the open check · the session
 * (sessions/get and every verb that answers the session, with its tenders, movements and
 * variances; force-close · reopen · x-report · decide-variance · approve-cash) · the movement in
 * full (movements/get) · the cash receipt (awaiting-receipt · receive) · the count · the masters
 * · the approval gate (request / decide / get and the inbox) · the slip check · the safe
 * (balance · count · decide-variance · remit · remit-confirm) · head office reviews.
 *
 * Blind figures: a cashier under till.blind_close gets every expected / variance figure null
 * (`expectedVisible` on a session, `figuresVisible` on the safe) and the shapes say so with
 * `number | null`; a count is always shown (`noRefCount`, `cashLimit.gauge`).
 */
import type {
  ModuleErrorDetail,
  ModuleErrorResponse,
} from '../../../common/utils/module-shared.utils';
import type {
  TillCashReceiptState,
  TillCloseCheckCode,
  TillCloseCheckTone,
  TillCountKind,
  TillCountOutcome,
  TillDayStatus,
  TillErrorCode,
  TillFloatMode,
  TillHandoverReceipt,
  TillMovementKind,
  TillReceiptStatus,
  TillRemitMode,
  TillRemitStatus,
  TillReviewOutcome,
  TillSafeGapOutcome,
  TillSessionStatus,
  TillSessionVarianceStatus,
  TillVarianceDecision,
  TillVarianceStage,
  TillVarianceTreatment,
  TenderCloseMode,
} from './till-enum';

/**
 * Wire shapes of /till/*. Money goes out as numbers (two places), computed in
 * Prisma.Decimal end to end and converted only here, at the edge — the house
 * response convention (payment, receipt).
 */

export interface TillErrorDetail extends ModuleErrorDetail {
  /** Notes 119: every till refusal names one — the client words its box by it. */
  code: TillErrorCode;
  /** TILL_APPROVAL_REQUIRED: what the TillGate needs to request one. */
  event?: string;
  amount?: number;
  requiredRole?: string;
  channel?: string;
  [key: string]: unknown;
}

/** The house error body (`success: false`, message, errors[]) with till rows. */
export type TillErrorResponse = ModuleErrorResponse<TillErrorDetail>;

/** The envelope every /till/* route answers: `{ success: true, message, data }`. */
export interface TillSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

// ─── Business day ────────────────────────────────────────────────────────────

/**
 * One business day — GET /till/days/get · POST days/open, and inside the close / reopen
 * answers: the header, the frozen totals, the live session counts, the receipt and safe figures.
 */
export interface TillDayPayload {
  tbdId: string;
  tbdAccYear: string;
  tbdCompanyId: string;
  tbdBranchId: string;
  tbdBusinessDate: string;
  tbdStatus: TillDayStatus;
  tbdOpenedOn: string;
  tbdOpenedBy: string;
  tbdClosedOn: string | null;
  tbdClosedBy: string | null;
  tbdClosedByName: string | null;
  /** The store Z: issued at the first close, kept by every re-close (notes 117). */
  tbdZNo: number | null;
  tbdReopenCount: number;
  /**
   * Notes 117 — frozen at the close over the day's CLOSED sessions; 0 while
   * the day is open (a reopen clears them).
   */
  totals: {
    sessionCount: number;
    billCount: number;
    netSales: number;
    cashExpected: number;
    cashCounted: number;
    cashVariance: number;
    noncashVariance: number;
  };
  /** RED close-check items a DAY_CLOSE_EXCEPTION closed the day over (their counts). */
  tbdExceptionCount: number;
  tbdCloseApprovalId: string | null;
  tbdPrintCount: number;
  tbdNotes: string | null;
  /** Live, not frozen: the sessions hanging off the day right now, by status. */
  sessions: { status: TillSessionStatus; count: number }[];
  /** Notes 113 — till.handover_receipt for the branch: NONE shows no receipt row. */
  handoverReceipt: TillHandoverReceipt;
  /**
   * Notes 113 — the branch's hand-overs and drops no supervisor has received.
   * No amount: the receive is blind. `thisDay` blocks the day close (phase 4).
   */
  awaitingReceipt: {
    /** Of this business day. */
    thisDay: number;
    /** Of earlier business days, still unreceived. */
    earlierDays: number;
    /** When the oldest one was handed over; null when none waits. */
    oldestOn: string | null;
  };
  /**
   * Notes 118 — the safes of the day. `counted` / `expected`: over the safes
   * counted that day, each by its last count (expected = what the count was
   * judged against); `counted` null and `expected` the safes' expected balance
   * when none was counted. `opening` (the safes' expected balance when the day
   * opened) is written at the day close. `remitted`: the day's live REMITs.
   * Kept current by every count / remittance; frozen at the close.
   */
  safe: {
    opening: number;
    expected: number;
    counted: number | null;
    remitted: number;
    /**
     * Notes 124 §3: the book below zero (the opening of a closed day, or the
     * expected) — printed as it is, with the reason beside it.
     */
    belowZero: boolean;
    /** Cash handed over and not yet received into a safe, at the end of the day before. */
    awaitingOpening: number;
    /** The same at the end of the day. */
    awaiting: number;
  };
}

// ─── Day close (notes 117) ──────────────────────────────────────────────────

/** One line of GET /till/days/close-check. */
export interface TillCloseCheckItem {
  code: TillCloseCheckCode;
  /** RED blocks the close (unless an exception may cover it) · AMBER is shown · GREEN is clear. */
  tone: TillCloseCheckTone;
  count: number;
  detail: string;
  /** The sessions behind it, for the screen's jump buttons. */
  sessionIds: string[];
}

/** GET /till/days/close-check — the day's checklist as the server sees it. */
export interface TillDayCloseCheckPayload {
  tbdId: string;
  tbdAccYear: string;
  tbdBusinessDate: string;
  tbdStatus: TillDayStatus;
  /** Every code, GREEN when clear. */
  items: TillCloseCheckItem[];
  /** The day is open and nothing is RED. */
  canClose: boolean;
  /** Something is RED, and every RED is of a kind an exception may cover (SESSIONS_LIVE). */
  canCloseWithException: boolean;
}

/** POST /till/days/close. */
export interface TillDayClosePayload {
  day: TillDayPayload;
  zNo: number;
  /** The DAY_CLOSE_EXCEPTION till_approval row; null for a clean close. */
  tapId: string | null;
  /** The RED items the exception closed the day over. */
  closedOver: TillCloseCheckItem[];
  /** The live sessions the close force-closed (reason DAY_CLOSE), their hand-over received. */
  forceClosed: { tssId: string; tssAccYear: string; sessionNo: string }[];
}

/** POST /till/days/reopen. */
export interface TillDayReopenPayload {
  day: TillDayPayload;
  /** The DAY_REOPEN till_approval row. */
  tapId: string;
}

// ─── Open check (plan-till-counter-claim §4) ────────────────────────────────

/** The CLOSED session whose drawer a CARRIED float inherits, when it has not been carried yet. */
export interface TillCarriedFromPayload {
  sessionId: string;
  accYear: string;
  sessionNo: string;
  floatLeft: number;
}

/** A live session S1 must mention instead of opening a new one. */
export interface TillOpenCheckSessionPayload {
  sessionId: string;
  accYear: string;
  sessionNo: string;
  counterId: string;
  counterCode: string;
  operatorId: string;
  operatorName: string;
  deviceId: string;
  deviceName: string | null;
  openedOn: string;
  status: TillSessionStatus;
}

/** A counter an unlinked device may pick (open-check `freeCounters`), with its default float. */
export interface TillOpenCheckCounterPayload {
  counterId: string;
  code: string;
  name: string;
  defaultFloat: number;
  /** What a CARRIED float on this counter would inherit; null when nothing is left to carry. */
  carriedFrom: TillCarriedFromPayload | null;
}

/** The counter this device is linked to (open-check `linkedCounter`, counter claim rule 3). */
export interface TillOpenCheckLinkedPayload extends TillOpenCheckCounterPayload {
  /** A session still holding this counter's drawer, whichever device it runs on. */
  liveSessionId: string | null;
  /** The counter is switched off: open answers TILL_COUNTER_INACTIVE. */
  inactive: boolean;
}

/** A counter that would be free but for the session holding it — who holds it (S1, none free). */
export interface TillOpenCheckBusyPayload {
  counterId: string;
  code: string;
  name: string;
  session: TillOpenCheckSessionPayload;
}

/** GET /till/sessions/open-check — everything S1 needs in one read; advice only, nothing is written. */
export interface TillOpenCheckPayload {
  /**
   * False: a back-office device (till.require_session = false), or one linked to a counter that
   * needs no session. S1 does not open.
   */
  requireSession: boolean;
  businessDay: {
    /** Null until the day is opened (by the first session under till.day_auto_open). */
    dayId: string | null;
    accYear: string;
    date: string;
    status: TillDayStatus | null;
    autoOpen: boolean;
  };
  /** Linked (rule 3): the one counter; freeCounters and busyCounters are then empty. */
  linkedCounter: TillOpenCheckLinkedPayload | null;
  /** Unlinked (rule 4): the counters this device may pick, tcn_sort_order then tcn_code. */
  freeCounters: TillOpenCheckCounterPayload[];
  /** Unlinked: the counters taken by a live session, for "no free counter — who holds them". */
  busyCounters: TillOpenCheckBusyPayload[];
  /** A session this device already holds (any operator): resume it, or a supervisor force-closes. */
  deviceSession: TillOpenCheckSessionPayload | null;
  /** This user's session on another device: TILL_OPERATOR_BUSY until it is closed. */
  userSessionElsewhere: TillOpenCheckSessionPayload | null;
  /**
   * The carried float of the linked counter, or of the `counterId` asked for when it is on the
   * free list. Every free counter also carries its own in `freeCounters[].carriedFrom`.
   */
  carriedFrom: TillCarriedFromPayload | null;
}

// ─── Session ─────────────────────────────────────────────────────────────────

/**
 * One tender of a session. In BLIND mode a cashier gets the tender list with
 * every expected / variance figure NULL (§5.4: "never the figure"); a
 * supervisor (menu 273 OVERRIDE) gets them all.
 */
export interface TillSessionTenderPayload {
  tenderTypeId: number;
  tenderTypeName: string;
  tenderId: string | null;
  tenderName: string | null;
  closeMode: TenderCloseMode;
  /** The expectation split (§5.4 / 48): null when hidden. */
  openAmount: number | null;
  salesAmount: number | null;
  refundAmount: number | null;
  receiptAmount: number | null;
  paymentAmount: number | null;
  expenseAmount: number | null;
  movedIn: number | null;
  movedOut: number | null;
  /** Payments / expenses paid by this non-drawer tender: information, never in expected (48 §2.1). */
  paidFromBank: number | null;
  txnCount: number | null;
  /** Non-cash plan §4.3 — money-in rows with no reference (the UPI chase list). Shown blind too: it is a count, not money. */
  noRefCount: number;
  expected: number | null;
  /** The final close count for DENOM / SLIPS tenders; null before it, or for STATEMENT / NONE. */
  counted: number | null;
  variance: number | null;
}

/**
 * The session as sessions/get answers it — and open · suspend · resume · end-billing · close ·
 * current, and inside the force-close / reopen / decide-variance / approve-cash answers: the
 * header, the frozen totals, the cash gauge, the tenders, the movements, the variances and the
 * cash receipt. The figures are null when the caller may not see them (`expectedVisible`).
 */
export interface TillSessionPayload {
  tssId: string;
  tssAccYear: string;
  tssCompanyId: string;
  tssBranchId: string;
  tssDayId: string;
  tssBusinessDate: string;
  tssCounterId: string;
  counterCode: string;
  counterName: string;
  /**
   * Notes 110 §3 — the counter's own safe when it is a drop safe, else null:
   * a DROP is refused (TILL_NO_DROP_SAFE) and the screen disables its tile.
   */
  dropSafeName: string | null;
  tssDeviceId: string;
  tssOperatorId: string;
  operatorName: string | null;
  tssSessionNo: string;
  tssDaySeq: number;
  tssStatus: TillSessionStatus;
  tssOpenedOn: string;
  tssFloatMode: TillFloatMode;
  tssPrevSessionId: string | null;
  tssFloatIssued: number;
  tssFloatCounted: number;
  /** counted − issued at open (generated). */
  tssFloatVariance: number;
  tssSuspendCount: number;
  tssSuspendedOn: string | null;
  tssBillingEndedOn: string | null;
  tssCountMode: 'BLIND' | 'OPEN' | null;
  tssCountPlace: 'COUNTER' | 'CASH_OFFICE' | null;
  tssCountAttempts: number;
  tssCountedOn: string | null;
  tssClosedOn: string | null;
  tssClosedBy: string | null;
  tssZNo: number | null;
  /** Notes 117 — closed by a supervisor in the cashier's place, and why (a FORCE_CLOSE reason). */
  tssForceClosed: boolean;
  tssForceReasonId: string | null;
  /** Notes 117 — times reopened; the Z number stays the first close's. */
  tssReopenCount: number;
  tssPrintCount: number;
  tssVarianceStatus: TillSessionVarianceStatus;
  /** Frozen at close; zero before it. Cash / non-cash figures are null when hidden. */
  totals: {
    billCount: number;
    returnCount: number;
    receiptCount: number;
    paymentCount: number;
    expenseCount: number;
    netSales: number | null;
    cashExpected: number | null;
    cashCounted: number | null;
    cashVariance: number | null;
    noncashExpected: number | null;
    noncashCounted: number | null;
    noncashVariance: number | null;
    handedOver: number;
    floatLeft: number;
  };
  /** True when this caller is shown the expected figures. */
  expectedVisible: boolean;
  /**
   * The drawer against the counter's limits, for the till strip (§8 S2): a
   * state and a 0–4 gauge, NEVER the figure — shown to a blind cashier too.
   * Null once the session stops billing.
   */
  cashLimit: {
    state: 'NORMAL' | 'ALERT' | 'BLOCKED';
    /** Quarters of the alert limit, 0–4; null when the counter has no alert limit. */
    gauge: number | null;
    alertLimit: number;
    blockLimit: number;
  } | null;
  tenders: TillSessionTenderPayload[];
  /** The vouchers this session posted itself (float, hand-over, variance). */
  movements: TillMovementPayload[];
  variances: TillVariancePayload[];
  /**
   * Notes 113 / 114 — the cash receipt over the session's hand-over and drops:
   * NONE when none waited for a receipt (setting NONE, nothing handed over, or
   * closed before notes 113); AWAITING while any is unreceived (the CASH TO
   * APPROVE pill); DIFFERENCE when all are received and the total differs from
   * what was handed over (decided, or pending — tssVarianceStatus and the
   * RECEIVE-stage variances say which); else APPROVED.
   */
  receiptState: TillCashReceiptState;
  /** Handed over (hand-over + drops) and not yet received; 0 when nothing waits. */
  cashAwaiting: number;
  /** The supervisor of the latest receipt; null until one. */
  receivedBy: string | null;
  receivedByName: string | null;
  receivedOn: string | null;
  /** Notes 127 §3 — the latest receipt was made by the session's own cashier. */
  receivedBySelf: boolean;
}

/** One movement as the session lists them (`movements[]`): kind, number, amount, status, receipt. */
export interface TillMovementPayload {
  tcmId: string;
  tcmAccYear: string;
  tcmKind: TillMovementKind;
  tcmDocNo: string;
  tcmDocDate: string;
  tcmAmount: number;
  tcmSafeId: string | null;
  tcmVoucherId: string | null;
  tcmStatus: 'POSTED' | 'VOIDED';
  tcmCreatedOn: string;
  /** Notes 113: null = straight into the safe; AWAITING a supervisor's receive; RECEIVED. */
  tcmReceiptStatus: TillReceiptStatus | null;
  /** What the receiver counted, once RECEIVED (≠ tcmAmount = a RECEIVE-stage variance). */
  tcmReceivedAmount: number | null;
  tcmReceivedOn: string | null;
}

/** GET /till/movements/supervisors — one person who can sign a pickup / top-up on the session (notes 110 §2). */
export interface TillSupervisorPayload {
  userId: string;
  loginName: string;
  /** usr_full_name, else usr_display_name; null when both are blank. */
  fullName: string | null;
  /** False: the screen says to set a till PIN in User Administration (menu 58) before the count. */
  hasPin: boolean;
}

/** One movement in full — what the slip prints (§9 TILL_MOVEMENT). */
export interface TillMovementDetailPayload extends TillMovementPayload {
  safeName: string | null;
  tcmSessionId: string | null;
  sessionNo: string | null;
  sessionOperatorId: string | null;
  tcmLedgerId: string | null;
  tcmReasonId: string | null;
  reasonCode: string | null;
  reasonName: string | null;
  tcmRefNo: string | null;
  tcmRefDate: string | null;
  tcmPartyName: string | null;
  tcmBagNo: string | null;
  tcmSealNo: string | null;
  /**
   * Who entered it. A pickup / top-up on /create (notes 110): the session's
   * cashier, at the counter. On /change, and on rows posted before notes 110:
   * the supervisor who carried the cash.
   */
  tcmDoneBy: string;
  /**
   * The second signature. A pickup / top-up on /create (notes 110): the
   * supervisor — given TO them on a PICKUP, given BY them on a TOP_UP. On
   * /change and before notes 110: the cashier.
   */
  tcmWitnessBy: string | null;
  /** When the second signer's till PIN was checked (notes 108 / 110); null = nobody's PIN was checked. */
  tcmWitnessVerifiedOn: string | null;
  tcmVoidedOn: string | null;
  tcmVoidedBy: string | null;
  tcmVoidReasonId: string | null;
  tcmNotes: string | null;
  /** Notes 113: who received it into the safe, and the TRcv voucher (none for an empty bag). */
  tcmReceivedBy: string | null;
  tcmReceiveVoucherId: string | null;
  /** Notes 118 — a REMIT: how it went, where it stands, the bank's confirmation of a CIT one. */
  tcmRemitMode: TillRemitMode | null;
  tcmRemitStatus: TillRemitStatus | null;
  tcmCitAgency: string | null;
  tcmBankDate: string | null;
  tcmBankRef: string | null;
  tcmBankAmount: number | null;
  tcmConfirmedBy: string | null;
  tcmConfirmedOn: string | null;
  tcmConfirmVoucherId: string | null;
  /** The denominations that moved (an exchange has both sides; a received bag adds its DROP_VERIFY count). */
  counts: {
    tctId: string;
    tctKind: TillCountKind;
    tctTotalCounted: number;
    lines: {
      tenderTypeId: number;
      denominationId: string | null;
      faceValue: number;
      qty: number;
      amount: number;
    }[];
  }[];
}

/**
 * One till_variance row of the session (stage OPEN · CLOSE · RECEIVE), as the session and the
 * count answer it: expected, counted, the treatment and the TVar that posted it.
 */
export interface TillVariancePayload {
  tvrId: string;
  tvrAccYear: string;
  tvrStage: TillVarianceStage;
  /** Stage RECEIVE (notes 113): the bag received. */
  tvrMovementId: string | null;
  tvrTenderTypeId: number;
  tvrTenderId: string | null;
  tvrExpected: number;
  tvrCounted: number;
  tvrVariance: number;
  tvrTolerance: number;
  tvrTreatment: TillVarianceTreatment;
  /** till_reason — an OPEN-stage variance carries its FLOAT_MISMATCH reason. */
  tvrReasonId: string | null;
  tvrStatus: 'OPEN' | 'POSTED' | 'REVERSED';
  tvrVoucherId: string | null;
  /** Notes 105: the till_approval row that decided it, who decided, and RECOVER's staff ledger. */
  tvrApprovalId: string | null;
  tvrDecidedBy: string | null;
  tvrRecoveryLedgerId: string | null;
}

/** /till/sessions/force-close (notes 117). */
export interface TillForceClosePayload {
  /**
   * CLOSED: the supervisor's count was within tolerance and the session is
   * closed, its hand-over theirs · SENT_FOR_APPROVAL: out of tolerance, the
   * session PENDING_APPROVAL for sessions/decide-variance, then /close.
   */
  outcome: 'CLOSED' | 'SENT_FOR_APPROVAL';
  /** The FORCE_CLOSE till_approval row. */
  tapId: string;
  /** The supervisor's count. */
  tctId: string;
  session: TillSessionPayload;
}

/** /till/sessions/reopen (notes 117). */
export interface TillSessionReopenPayload {
  /** The SESSION_REOPEN till_approval row. */
  tapId: string;
  /** The Rev vouchers mirroring the close's hand-over and its posted variances. */
  reversalVoucherIds: string[];
  session: TillSessionPayload;
}

/** /till/sessions/x-report (notes 117): the sessions/expected payload, numbered. */
export type TillXReportPayload = TillSessionPayload & {
  /** 1, 2, … — the session's X reads (its X_REPORT events), this one included. */
  xNo: number;
  xReadOn: string;
};

/** /till/sessions/decide-variance (notes 105 A1): the decision as recorded, and the session after it. */
export interface TillVarianceDecisionPayload {
  /** The till_approval row (A3). */
  tapId: string;
  decision: TillVarianceDecision;
  /** CASH_VARIANCE | NONCASH_VARIANCE */
  event: string;
  /** Σ|counted − expected| over the PENDING variances. */
  amount: number;
  /** The rule's level. */
  requiredRole: string;
  /** The level the approver's grant conferred — HO_FINANCE for a SUPER ADMIN. */
  approverRole: string;
  channel: 'COUNTER' | 'REMOTE';
  /** APPROVE: the treatment the variances took; null on RECOUNT. */
  treatment: TillVarianceTreatment | null;
  /** Notes 113: the bag whose receive difference was decided; null for a close variance. */
  tcmId: string | null;
  session: TillSessionPayload;
}

/** /till/sessions/approve-cash (notes 114) — one hand-over / drop, as received. */
export interface TillCashApprovalMovementPayload {
  tcmId: string;
  tcmAccYear: string;
  tcmKind: TillMovementKind;
  tcmDocNo: string;
  handedOver: number;
  /** Its share of the received total: a gap sits on the hand-over first. */
  received: number;
  /** The TRcv voucher; null when nothing of it was received. */
  receiveVoucherId: string | null;
  receiveVoucherNo: string | null;
}

/** /till/sessions/approve-cash (notes 114): the session's cash, as approved. */
/**
 * Notes 127 §3 — the session's own cashier approved its cash into the safe:
 * RULE under the company's CASH_VARIANCE rule (`tar_allow_self`, with their
 * PIN); SINGLE_OPERATOR under till.single_operator.
 */
export type SelfCashApproval = 'RULE' | 'SINGLE_OPERATOR';

/**
 * POST /till/sessions/approve-cash (notes 114) — the hand-over and drops received in one
 * approval, the gap if any and how it was dealt with, and the session after it.
 */
export interface TillCashApprovalPayload {
  tssId: string;
  tssAccYear: string;
  sessionNo: string;
  /** Σ of the hand-over and drops that were awaiting receipt. */
  handedOver: number;
  received: number;
  /** received − handed over. */
  difference: number;
  /**
   * APPROVED: no gap · WITHIN_TOLERANCE: posted at once to Cash short & excess ·
   * DECIDED: beyond tolerance, decided in the same step by the caller's grant ·
   * SENT_FOR_APPROVAL: a PENDING RECEIVE-stage variance for decide-variance
   * with `tcmId`.
   */
  outcome: 'APPROVED' | 'WITHIN_TOLERANCE' | 'DECIDED' | 'SENT_FOR_APPROVAL';
  /** The RECEIVE-stage variance raised, if any. */
  tvrId: string | null;
  /** The movement the variance names (the hand-over, else the latest drop) — decide-variance's tcmId. */
  tcmId: string | null;
  /** DECIDED: the treatment and the till_approval row. */
  treatment: TillVarianceTreatment | null;
  tapId: string | null;
  /** The TVar of a WITHIN_TOLERANCE / DECIDED gap. */
  varianceVoucherId: string | null;
  varianceVoucherNo: string | null;
  receivedOn: string;
  /** Approved by the session's own cashier, and on what footing; null when by someone else. */
  selfApproval: SelfCashApproval | null;
  movements: TillCashApprovalMovementPayload[];
  session: TillSessionPayload;
}

/**
 * GET /till/movements/awaiting-receipt (notes 113) — one bag no supervisor has
 * received. No amount: the receive is blind, as the cashier's count is.
 */
export interface TillAwaitingReceiptPayload {
  tcmId: string;
  tcmAccYear: string;
  tcmKind: TillMovementKind;
  tcmDocNo: string;
  tcmDocDate: string;
  /** When the cashier parted with it (the close, or the drop). */
  handedOverOn: string;
  ageMinutes: number;
  bagNo: string | null;
  sealNo: string | null;
  safeId: string | null;
  safeName: string | null;
  tssId: string;
  sessionNo: string;
  sessionStatus: TillSessionStatus;
  counterCode: string;
  counterName: string;
  cashierId: string;
  cashierName: string | null;
  /** Whoever handed it over (the cashier, or a supervisor who closed for them). */
  handedOverBy: string;
  /** False when the caller was the session's cashier (and till.single_operator is off). */
  canReceive: boolean;
}

/** POST /till/movements/receive (notes 113) — one bag, as received. Shown only after the count. */
export interface TillReceivedPayload {
  tcmId: string;
  tcmAccYear: string;
  tcmKind: TillMovementKind;
  tcmDocNo: string;
  tssId: string;
  sessionNo: string;
  handedOver: number;
  received: number;
  /** received − handed over. */
  difference: number;
  /**
   * RECEIVED: nothing to decide (no difference) · WITHIN_TOLERANCE: posted at
   * once to Cash short & excess · SENT_FOR_APPROVAL: a PENDING variance, decided
   * on sessions/decide-variance with this tcmId.
   */
  outcome: 'RECEIVED' | 'WITHIN_TOLERANCE' | 'SENT_FOR_APPROVAL';
  /** The RECEIVE-stage variance raised, if any. */
  tvrId: string | null;
  /** The TRcv voucher; null for an empty bag. */
  receiveVoucherId: string | null;
  receivedOn: string;
}

/** /till/sessions/count — what a (possibly blind) cashier is told. */
export interface TillCountResultPayload {
  tssId: string;
  tssAccYear: string;
  tctId: string;
  attemptNo: number;
  attemptsLeft: number;
  outcome: TillCountOutcome;
  /**
   * A card / UPI slip total disagrees while the drawer was accepted (notes 99 §1): the count is
   * final, the gap waits for the supervisor's slip check (`sessions/slip-check`), and the cashier is
   * not asked to recount. No figure — shown to a blind cashier too.
   */
  slipCheckRequired: boolean;
  tssStatus: TillSessionStatus;
  /** Only when the caller may see expected figures (open mode, or a supervisor). */
  variances: TillVariancePayload[] | null;
}

/** One count line as the services take it from TillCountLineDto (open, count, movements, receive, safe). */
export interface TillCountLineInput {
  tenderTypeId: number;
  tenderId?: string | null;
  denominationId?: string | null;
  qty?: number;
  enteredAmount?: number;
  batchRef?: string | null;
}

/** One till_count row: kind, attempt, final / blind, total. No route answers it on its own today. */
export interface TillCountPayload {
  tctId: string;
  tctAccYear: string;
  tctKind: TillCountKind;
  tctAttemptNo: number;
  tctIsFinal: boolean;
  tctIsBlind: boolean;
  tctTotalCounted: number;
  tctCountedOn: string;
}

// ─── Masters ─────────────────────────────────────────────────────────────────

/** counters/create · get — a till_counter row with its device's and safe's names (notes 101 §3). */
export interface TillCounterPayload {
  tcnId: string;
  tcnCompanyId: string;
  tcnBranchId: string;
  tcnCode: string;
  tcnName: string;
  tcnKind: string;
  tcnDrawerMode: string;
  tcnDeviceId: string | null;
  /** fixed.device_master.dev_device_name of tcnDeviceId (notes 101 §3). */
  deviceName: string | null;
  tcnSafeId: string | null;
  /** till_safe.tsf_name of tcnSafeId. */
  safeName: string | null;
  tcnDefaultFloat: number;
  tcnCashAlertLimit: number;
  tcnCashBlockLimit: number;
  tcnZLastNo: number;
  tcnRequiresSession: boolean;
  tcnSortOrder: number;
  tcnRemarks: string | null;
  tcnIsActive: boolean;
  tcnCreatedOn: string;
  tcnModifiedOn: string | null;
}

/** safes/create · get — a till_safe row with its ledger's name. */
export interface TillSafePayload {
  tsfId: string;
  tsfCompanyId: string;
  tsfBranchId: string;
  tsfCode: string;
  tsfName: string;
  tsfLedgerId: string;
  ledgerName: string | null;
  tsfInsuredLimit: number;
  tsfIsDefault: boolean;
  /** Notes 110 §3 — a drop box at the counter: a counter whose own safe has it takes DROPs. */
  tsfIsDropSafe: boolean;
  tsfRemarks: string | null;
  tsfIsActive: boolean;
  tsfCreatedOn: string;
  tsfModifiedOn: string | null;
}

/** reasons/create · get — a till_reason row; `shipped` marks the read-only rows every company shares. */
export interface TillReasonPayload {
  trsId: string;
  trsCompanyId: string | null;
  trsCategory: string;
  trsCode: string;
  trsName: string;
  trsLedgerId: string | null;
  /** The default ledger's name (notes 101 §3). */
  ledgerName: string | null;
  trsNeedsNote: boolean;
  trsNeedsRef: boolean;
  trsMaxAmount: number;
  trsSortOrder: number;
  trsIsActive: boolean;
  /** Shipped (company NULL) rows are read-only to a company. */
  shipped: boolean;
}

/** denominations/create · get · list — one note or coin. */
export interface TillDenominationPayload {
  tdnId: string;
  tdnCompanyId: string | null;
  tdnCurrency: string;
  tdnValue: number;
  tdnKind: 'NOTE' | 'COIN';
  tdnLabel: string;
  tdnBundleQty: number;
  tdnSortOrder: number;
  tdnValidTo: string | null;
  tdnIsActive: boolean;
  shipped: boolean;
}

/** approval-rules/create · get — a till_approval_rule row (the ck_tar_* values as text). */
export interface TillApprovalRulePayload {
  tarId: string;
  tarCompanyId: string | null;
  tarBranchId: string | null;
  tarEventCode: string;
  tarMode: string;
  tarThresholdAmount: number;
  tarThresholdCount: number;
  tarThresholdPercent: number;
  tarChannel: string;
  tarMinRole: string;
  tarTwoPerson: boolean;
  tarAllowSelf: boolean;
  tarBlocksTill: boolean;
  tarExpireMinutes: number;
  tarEffectiveFrom: string;
  tarRemarks: string | null;
  tarIsActive: boolean;
  shipped: boolean;
}

/**
 * What an approval rule asks of one money document (TillApprovalService.
 * assess). Notes 124 §5: the gate acts on it — under `till.approval_gate`
 * WARN the document goes through and a PENDING request waits in the inbox
 * (`approvalId`); under REFUSE, on a rule that blocks the till, it is refused
 * until an approved request is brought (`enforced` true, `approvalId` that one).
 */
export interface TillApprovalNeed {
  /** ck_tar_event: CASH_PAYMENT, EXPENSE … */
  event: string;
  ruleId: string | null;
  /** ALWAYS | OVER_AMOUNT | OVER_COUNT */
  mode: string;
  threshold: number;
  /** OVER_COUNT (void bill REV 2): the session count the rule asks past, and this document's ordinal. */
  thresholdCount?: number;
  count?: number | null;
  /** What was judged: the cash part of a payment, the total of an expense. */
  amount: number;
  /** SUPERVISOR | STORE_MANAGER | CASH_OFFICE | AREA_MANAGER | HO_FINANCE */
  minRole: string;
  /** COUNTER | REMOTE | EITHER */
  channel: string;
  twoPerson: boolean;
  blocksTill: boolean;
  /** True when the gate refused (or would refuse) the document without an approved request. */
  enforced: boolean;
  /** The request filed for review (WARN), or the approved one the document took. */
  approvalId?: string | null;
}

/** till_approval.tap_status. */
export type TillApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

/** One approval request (notes 124 §5): approvals/request · decide · get · cancel answer it. */
export interface TillApprovalPayload {
  tapId: string;
  tapAccYear: string;
  companyId: string;
  branchId: string;
  event: string;
  status: TillApprovalStatus;
  amount: number;
  requiredRole: string;
  /** The rule's channel while PENDING (COUNTER · REMOTE · EITHER); the one used once decided. */
  channel: string;
  twoPerson: boolean;
  selfAllowed: boolean;
  sessionId: string | null;
  sessionNo: string | null;
  counterId: string | null;
  counterName: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcRefno: string | null;
  reasonId: string | null;
  reasonName: string | null;
  requestedBy: string;
  requestedByName: string | null;
  requestedOn: string;
  requestNote: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedOn: string | null;
  decisionNote: string | null;
  secondBy: string | null;
  secondByName: string | null;
  secondOn: string | null;
  expiresOn: string | null;
  /** An approved request a document has already taken (it approves nothing more). */
  usedOn: string | null;
}

/** What waits for an approver, and the route that decides it (approvals/pending). */
export type TillApprovalInboxKind =
  | 'REQUEST'
  | 'SESSION_VARIANCE'
  | 'RECEIVE_VARIANCE'
  | 'SAFE_VARIANCE';

/** One decision waiting in the branch (approvals/pending), and whether the caller may make it. */
export interface TillApprovalInboxItem {
  kind: TillApprovalInboxKind;
  /** The route that decides it: approvals/decide · sessions/decide-variance · safes/decide-variance. */
  action: string;
  event: string;
  accYear: string;
  tapId: string | null;
  tssId: string | null;
  tcmId: string | null;
  tvrId: string | null;
  safeId: string | null;
  sessionNo: string | null;
  counterName: string | null;
  safeName: string | null;
  /** Null for a caller without Till Sessions (273) OVERRIDE: a blind count's gap is not shown. */
  amount: number | null;
  requiredRole: string;
  channel: string;
  twoPerson: boolean;
  requestedBy: string | null;
  requestedByName: string | null;
  requestedOn: string | null;
  expiresOn: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcRefno: string | null;
  note: string | null;
  /** The session closed with this gap undecided (decided on sessions/decide-variance after close). */
  afterClose: boolean;
  /** Whether the caller's own authority could decide it (self, level, ceiling); a PIN may still be asked. */
  canDecide: boolean;
  /** Why not: TILL_APPROVER_SELF · TILL_APPROVER_NO_GRANT · TILL_APPROVER_LIMIT. */
  cannotBecause: string | null;
}

/** GET /till/approvals/pending — the inbox (notes 124 §5). */
export interface TillApprovalInboxPayload {
  items: TillApprovalInboxItem[];
  /** Requests swept to EXPIRED by this read. */
  expired: number;
}

/** approval-authorities/create · get — a till_approval_authority grant with the user's name. */
export interface TillApprovalAuthorityPayload {
  taaId: string;
  taaUserId: string;
  userName: string | null;
  taaCompanyId: string | null;
  taaBranchId: string | null;
  taaRole: string;
  taaEventCode: string | null;
  taaMaxAmount: number | null;
  taaCanRemote: boolean;
  taaValidFrom: string;
  taaValidTo: string | null;
  taaRemarks: string | null;
  taaIsActive: boolean;
}

/** `<master>/delete` — the id soft-deleted. */
export interface TillDeletePayload {
  id: string;
  deleted: true;
}

/** POST /till/events/batch — the rows the batch wrote, and the ones it had sent before. */
export interface TillEventBatchPayload {
  accepted: number;
  /** Already in the journal under (device, clientSeq): a re-sent batch. */
  duplicates: number;
}

/** Non-cash plan §4.2 — the rows behind one terminal, for the slip check. */
export interface TillSlipCheckPayload {
  tssId: string;
  tssSessionNo: string;
  tenderId: string;
  tenderName: string | null;
  expected: number | null;
  /** The batch total the cashier entered at close. */
  batchTotal: number | null;
  batchRef: string | null;
  slipCount: number | null;
  /** batchTotal − expected. */
  difference: number | null;
  rows: {
    tdId: string;
    tdAccYear: string;
    time: string;
    srcDocType: string;
    srcDocId: string;
    docRefno: string | null;
    drCr: 'DR' | 'CR';
    amount: number;
    authCode: string | null;
    cardLast4: string | null;
    refNo: string | null;
  }[];
}

/** POST /till/sessions/slip-check — the verdict as the SLIP_CHECK event recorded it. */
export interface TillSlipCheckResultPayload {
  tssId: string;
  tenderId: string;
  ticked: number;
  noSlip: number;
  slipsWithoutRow: number;
  amountDiffers: number;
}

// ─── The safe (notes 118) ───────────────────────────────────────────────────

/** One remittance, as the Cash Office lists the ones in transit (and the grid would). */
export interface TillRemittancePayload {
  tcmId: string;
  tcmAccYear: string;
  docNo: string;
  /** The business date it left the safe. */
  docDate: string;
  safeId: string;
  safeName: string | null;
  mode: TillRemitMode;
  status: TillRemitStatus;
  amount: number;
  bankLedgerId: string;
  bankName: string | null;
  bagNo: string | null;
  sealNo: string | null;
  citAgency: string | null;
  slipNo: string | null;
  slipDate: string | null;
  /** Whole days since it left (IST). */
  ageDays: number;
  doneBy: string;
  createdOn: string;
}

/**
 * One safe's figures (GET /till/safes/balance). Money is null when the caller
 * may not see it (`figuresVisible` false: till.blind_close, and no Cash Office
 * (287) / Till Sessions (273) OVERRIDE) — the count is blind.
 */
export interface TillSafeStatePayload {
  safeId: string;
  code: string;
  name: string;
  ledgerId: string;
  ledgerName: string | null;
  isDefault: boolean;
  isDropSafe: boolean;
  isActive: boolean;
  insuredLimit: number;
  /** Expected over a non-zero insured limit (shown even when the figures are not). */
  overInsured: boolean;
  /**
   * Another active safe of the branch posts to the same ledger (safes default to
   * the SAFE_CASH role's): bookBalance / drift are the ledger's, not this safe's.
   */
  ledgerShared: boolean;
  /**
   * COUNT = the last safe count; BOOK = no count yet: the safe expects what its
   * ledger holds; ZERO = no count yet and a shared ledger: 0.
   */
  openingFrom: 'COUNT' | 'BOOK' | 'ZERO';
  opening: number | null;
  /** Since the last count (or all time before one). */
  in: {
    /** Hand-overs straight into the safe, or received into it (notes 113/114). */
    handOvers: number;
    drops: number;
    pickups: number;
    transfersIn: number;
    /** Back-office receipts in cash, posted to this safe's ledger (48 §2.3). */
    receipts: number;
    total: number;
  } | null;
  out: {
    floatIssues: number;
    topUps: number;
    remittances: number;
    transfersOut: number;
    /** Back-office payments / expenses in cash, from this safe's ledger (48 §2.3). */
    payments: number;
    total: number;
  } | null;
  /** Notes for notes with a drawer: net zero, counted only. */
  exchanges: number;
  expected: number | null;
  /** The safe ledger's balance (Ledger Statement), today. */
  bookBalance: number | null;
  /** bookBalance − expected: a journal, an opening balance, a gap not decided yet. */
  drift: number | null;
  lastCount: {
    tctId: string;
    tctAccYear: string;
    countedOn: string;
    countedBy: string;
    countedByName: string | null;
    witnessBy: string | null;
    counted: number | null;
    expected: number | null;
    difference: number | null;
  } | null;
  /** Counted on today's business day. */
  countedToday: boolean;
  inTransit: { count: number; amount: number };
  /** Safe gaps (stage SAFE / REMIT) still PENDING. */
  pendingGaps: { tvrId: string; tvrAccYear: string; stage: TillVarianceStage; variance: number }[];
}

/** GET /till/safes/balance — every safe asked for, and the branch's CIT remittances in transit. */
export interface TillSafeBalancePayload {
  companyId: string;
  branchId: string;
  businessDate: string;
  figuresVisible: boolean;
  safes: TillSafeStatePayload[];
  /** CIT remittances not yet confirmed by the bank, oldest first. */
  inTransit: TillRemittancePayload[];
}

/** POST /till/safes/count — the count, then what it was judged against. */
export interface TillSafeCountPayload {
  tctId: string;
  tctAccYear: string;
  safeId: string;
  safeName: string;
  tbdId: string;
  businessDate: string;
  countedOn: string;
  counted: number;
  /** Shown only now, after the blind count. */
  expected: number;
  difference: number;
  outcome: TillSafeGapOutcome;
  tvrId: string | null;
  treatment: TillVarianceTreatment | null;
  tapId: string | null;
  varianceVoucherId: string | null;
  varianceVoucherNo: string | null;
  witnessBy: string | null;
  safe: TillSafeStatePayload;
}

/** POST /till/safes/decide-variance. */
export interface TillSafeDecisionPayload {
  tvrId: string;
  tvrAccYear: string;
  stage: TillVarianceStage;
  safeId: string;
  safeName: string | null;
  expected: number;
  counted: number;
  variance: number;
  treatment: TillVarianceTreatment;
  tapId: string;
  secondBy: string | null;
  varianceVoucherId: string | null;
  varianceVoucherNo: string | null;
  decidedOn: string;
}

/** POST /till/movements/remit. */
export interface TillRemitPayload {
  movement: TillMovementDetailPayload;
  tapId: string | null;
  countId: string | null;
  safe: TillSafeStatePayload;
}

/** POST /till/movements/remit-confirm. */
export interface TillRemitConfirmPayload {
  tcmId: string;
  tcmAccYear: string;
  docNo: string;
  sent: number;
  credited: number;
  difference: number;
  outcome: TillSafeGapOutcome;
  confirmVoucherId: string | null;
  confirmVoucherNo: string | null;
  tvrId: string | null;
  treatment: TillVarianceTreatment | null;
  tapId: string | null;
  varianceVoucherId: string | null;
  varianceVoucherNo: string | null;
  movement: TillMovementDetailPayload;
}

// ─── Head office reviews (notes 134) ───────────────────────────────────────

/** One accounts.till_session_review row. */
export interface TillReviewPayload {
  tsrId: string;
  tsrAccYear: string;
  /** The day reviewed — for a session review, null (the session names its day). */
  dayId: string | null;
  sessionId: string | null;
  /** till_session.tss_session_no of sessionId. */
  sessionNo: string | null;
  /** The business date of the day, or of the session's day (YYYY-MM-DD). */
  businessDate: string | null;
  outcome: TillReviewOutcome;
  note: string | null;
  reviewedBy: string;
  /** user_master.usr_login_name of reviewedBy. */
  reviewedByName: string | null;
  reviewedOn: string;
  refVoucherId: string | null;
  refVoucherAccYear: string | null;
  /** acc_voucher_header.avh_voucher_refno of the journal named. */
  refVoucherNo: string | null;
  /** True on the newest review of its day / session: a later one supersedes it. */
  current: boolean;
}

/** POST /till/reviews/create. */
export interface TillReviewCreatePayload {
  review: TillReviewPayload;
  /** The review of the same day / session this one supersedes, or null for the first. */
  supersedes: string | null;
}

/** GET /till/reviews/list. */
export interface TillReviewListPayload {
  reviews: TillReviewPayload[];
}
