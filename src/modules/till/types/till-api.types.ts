import type {
  ModuleErrorDetail,
  ModuleErrorResponse,
} from '../../../common/utils/module-shared.utils';
import type {
  TillCountKind,
  TillCountOutcome,
  TillDayStatus,
  TillFloatMode,
  TillMovementKind,
  TillSessionStatus,
  TillSessionVarianceStatus,
  TillVarianceTreatment,
  TenderCloseMode,
} from './till-enum';

/**
 * Wire shapes of /till/*. Money goes out as numbers (two places), computed in
 * Prisma.Decimal end to end and converted only here, at the edge — the house
 * response convention (payment, receipt).
 */

export interface TillErrorDetail extends ModuleErrorDetail {
  code?: string;
  /** TILL_APPROVAL_REQUIRED: what the TillGate needs to request one. */
  event?: string;
  amount?: number;
  requiredRole?: string;
  channel?: string;
  [key: string]: unknown;
}

export type TillErrorResponse = ModuleErrorResponse<TillErrorDetail>;

export interface TillSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

// ─── Business day ────────────────────────────────────────────────────────────

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
  tbdZNo: number | null;
  tbdReopenCount: number;
  /** Live, not frozen: the sessions hanging off the day right now, by status. */
  sessions: { status: TillSessionStatus; count: number }[];
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

export interface TillOpenCheckCounterPayload {
  counterId: string;
  code: string;
  name: string;
  defaultFloat: number;
  /** What a CARRIED float on this counter would inherit; null when nothing is left to carry. */
  carriedFrom: TillCarriedFromPayload | null;
}

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
}

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
  /** Who handled the cash (the supervisor on a pickup / top-up). */
  tcmDoneBy: string;
  /** Who signed for it (the cashier on a pickup). */
  tcmWitnessBy: string | null;
  tcmVoidedOn: string | null;
  tcmVoidedBy: string | null;
  tcmVoidReasonId: string | null;
  tcmNotes: string | null;
  /** The denominations that moved (an exchange has both sides). */
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

export interface TillVariancePayload {
  tvrId: string;
  tvrAccYear: string;
  tvrStage: 'OPEN' | 'CLOSE';
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

export interface TillCountLineInput {
  tenderTypeId: number;
  tenderId?: string | null;
  denominationId?: string | null;
  qty?: number;
  enteredAmount?: number;
  batchRef?: string | null;
}

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
  tsfRemarks: string | null;
  tsfIsActive: boolean;
  tsfCreatedOn: string;
  tsfModifiedOn: string | null;
}

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
 * What an approval rule would ask of one money document (TillApprovalService.
 * assess): reported by the expense voucher and the payment until phase 3 builds
 * the gate, never enforced before then.
 */
export interface TillApprovalNeed {
  /** ck_tar_event: CASH_PAYMENT, EXPENSE … */
  event: string;
  ruleId: string;
  /** ALWAYS | OVER_AMOUNT */
  mode: string;
  threshold: number;
  /** What was judged: the cash part of a payment, the total of an expense. */
  amount: number;
  /** SUPERVISOR | STORE_MANAGER | CASH_OFFICE | AREA_MANAGER | HO_FINANCE */
  minRole: string;
  /** COUNTER | REMOTE | EITHER */
  channel: string;
  twoPerson: boolean;
  blocksTill: boolean;
  /** false until phase 3: the document posts, and the need is on its record. */
  enforced: false;
}

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

export interface TillDeletePayload {
  id: string;
  deleted: true;
}

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

export interface TillSlipCheckResultPayload {
  tssId: string;
  tenderId: string;
  ticked: number;
  noSlip: number;
  slipsWithoutRow: number;
  amountDiffers: number;
}
