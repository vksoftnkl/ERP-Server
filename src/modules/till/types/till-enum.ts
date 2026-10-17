/**
 * The till's fixed vocabulary (TILL_DESIGN.md REV 1 + share files 47 / 48 / 49).
 * Every list here mirrors a CHECK on the 47–49 tables; the CHECK is the truth
 * and these exist so the service can refuse in words before Postgres refuses
 * with a constraint name.
 */

/**
 * Who reads what: TILL_MENU — the controllers' rights (TillContextService.requireRight);
 * TillErrorCode + TILL_ERROR_STATUS — throwTill (till-errors.ts), one HTTP status per code;
 * TillEventCode — TillEventService for the server's own rows, and CLIENT_EVENT_CODES, the only
 * codes events/batch accepts; TillSettingKey — till.settings.ts; the master lists
 * (TILL_COUNTER_KINDS, TillDrawerMode, TILL_REASON_CATEGORIES, TILL_APPROVAL_EVENTS / MODES /
 * CHANNELS, TILL_APPROVER_ROLES) — TillMastersService's value checks; MOVEMENT_VOUCHER_TYPE /
 * RECEIPT_MOVEMENTS — TillPostingService; VOIDABLE_MOVEMENTS / VARIANCE_STATUS_OF_TREATMENT —
 * TillMovementService and TillSessionService; CLOSE_EXCEPTION_CODES — TillDayCloseService;
 * approverRoleRank — TillApprovalService.assertApprover.
 *
 * The state machines the enums below spell out:
 *   session (ck_tss_status)   OPEN ⇄ SUSPENDED → COUNTING → (PENDING_APPROVAL → COUNTING →)
 *     CLOSED; sessions/reopen (notes 117) takes CLOSED back to COUNTING; VOIDED is in the
 *     CHECK, no route writes it today. LIVE_SESSION_STATUSES hold the counter;
 *     HOLDING_SESSION_STATUSES (+ PENDING_APPROVAL) hold the device and the operator too.
 *   day (ck_tbd_status)       OPEN → CLOSED (→ OPEN again on days/reopen); CLOSING is in the
 *     CHECK for a later two-step close, nothing writes it.
 *   movement                  POSTED → VOIDED (tcm_status); a bag under till.handover_receipt
 *     REQUIRED: AWAITING → RECEIVED (tcm_receipt_status, TillReceiptStatus); a REMIT:
 *     DEPOSITED, or IN_TRANSIT → CONFIRMED (tcm_remit_status, TillRemitStatus).
 *   variance                  OPEN → POSTED (→ REVERSED on a session reopen), its treatment
 *     PENDING → WITHIN_TOLERANCE · EXPENSE · RECOVER · SUSPENSE · RETENDERED
 *     (TillVarianceTreatment); the session's summary of it is TillSessionVarianceStatus, by
 *     VARIANCE_STATUS_OF_TREATMENT once approved.
 *   approval (till_approval)  PENDING → APPROVED · REJECTED · CANCELLED · EXPIRED
 *     (TillApprovalStatus, in till-api.types.ts).
 *   a count's answer          ACCEPTED · RECOUNT_REQUIRED · SENT_FOR_APPROVAL (TillCountOutcome);
 *     a safe gap's EXACT · WITHIN_TOLERANCE · DECIDED · SENT_FOR_APPROVAL (TillSafeGapOutcome).
 */

/** Menus 271–276 (migration 20261008140000), 280–283 (notes 101 / 102), 285 (notes 111), 287 (notes 118). Rights are judged on these. */
export const TILL_MENU = {
  GROUP: 271,
  /** The cashier's own session: VIEW · CREATE (open) · EDIT (suspend … close) · PRINT. */
  OPEN_TILL: 272,
  /** A supervisor's view of every session: VIEW · EXPORT · OVERRIDE (expected) · PRINT. */
  SESSIONS: 273,
  /**
   * Till Reports (notes 133): the Qt report screen over grids 157 / 159-169.
   * VIEW · PRINT · EXPORT. No route reads it.
   */
  REPORTS: 288,
  /**
   * Cash Position (notes 134): head office's every-branch screen over grids
   * 170-174. VIEW · CREATE (add an HO review, /till/reviews/create) · EXPORT.
   */
  CASH_POSITION: 289,
  /** VIEW · CREATE (Day Open). */
  BUSINESS_DAY: 274,
  /** The "Till Masters" group of the four master screens below (notes 102). VIEW only. */
  MASTERS_GROUP: 283,
  /** Till Counters — was "Till Masters" (all four) until the screens split (notes 101). */
  COUNTERS: 275,
  /** Till Safes (notes 101). */
  SAFES: 280,
  /** Till Reasons (notes 101). */
  REASONS: 281,
  /** Denominations (notes 101); also opens denominations/list without Open Till. */
  DENOMINATIONS: 282,
  /** Till Approval Rules — "Till Approval Setup", with authority as a tab, until notes 111. */
  APPROVAL_RULES: 276,
  /** Till Approval Authority (notes 111): who may approve what, up to how much. */
  APPROVAL_AUTHORITY: 285,
  /**
   * Cash Office (notes 118): the safe — VIEW its balance · CREATE count it /
   * remit to the bank · OVERRIDE decide a safe gap. A new id: 286 stays retired.
   */
  CASH_OFFICE: 287,
  /**
   * The first Cash Office (notes 113) — retired by notes 114 (menu_is_active
   * false, its grants removed): the cash is approved on Till Sessions (273). No
   * route reads it.
   */
  RETIRED_CASH_OFFICE: 286,
} as const;

/** `<prefix>_RIGHT_<RIGHT>` codes for the menu-right refusals (rights.ts). */
export const TILL_RIGHT_CODE_PREFIX = 'TILL';

/** ck_tss_status. */
export enum TillSessionStatus {
  OPEN = 'OPEN',
  SUSPENDED = 'SUSPENDED',
  COUNTING = 'COUNTING',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  CLOSED = 'CLOSED',
  VOIDED = 'VOIDED',
}

/** The statuses ux_tss_counter_live counts as "live" on a counter. */
export const LIVE_SESSION_STATUSES: readonly TillSessionStatus[] = [
  TillSessionStatus.OPEN,
  TillSessionStatus.SUSPENDED,
  TillSessionStatus.COUNTING,
];

/**
 * A session that still holds its drawer: live, or counted and waiting for an
 * approver. No new session opens on its counter, device or operator.
 */
export const HOLDING_SESSION_STATUSES: readonly TillSessionStatus[] = [
  ...LIVE_SESSION_STATUSES,
  TillSessionStatus.PENDING_APPROVAL,
];

/** How a session got its counter (plan-till-counter-claim §2.2), in the SESSION_OPEN payload. */
export enum TillCounterClaim {
  /** The counter this device is linked to (tcn_device_id). */
  LINKED = 'LINKED',
  /** An unlinked device picked it from the free list; nothing is written to the counter. */
  PICKED = 'PICKED',
}

/** ck_tbd_status. */
export enum TillDayStatus {
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

/** ck_tss_float_mode. */
export enum TillFloatMode {
  /** Counted out of the safe for this session (a TFlt voucher). */
  ISSUED = 'ISSUED',
  /** Left in the drawer by the previous close on this counter. */
  CARRIED = 'CARRIED',
  /** No float (a cashless lane, or a drawer opened empty). */
  NONE = 'NONE',
}

/** ck_tcn_drawer. */
export enum TillDrawerMode {
  DRAWER = 'DRAWER',
  TRAY = 'TRAY',
  NONE = 'NONE',
}

/** ck_tcn_kind. */
export const TILL_COUNTER_KINDS = [
  'POS',
  'EXPRESS',
  'RETURNS_DESK',
  'SERVICE_DESK',
  'CASH_OFFICE',
  'MOBILE',
  'SELF_CHECKOUT',
] as const;

/** ck_tct_kind. */
export enum TillCountKind {
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
  RECOUNT = 'RECOUNT',
  HANDOVER = 'HANDOVER',
  SURPRISE = 'SURPRISE',
  FLOAT_ISSUE = 'FLOAT_ISSUE',
  PICKUP = 'PICKUP',
  DROP_VERIFY = 'DROP_VERIFY',
  SAFE = 'SAFE',
  /** Notes 118: the denominations a remittance took out of the safe. */
  REMIT = 'REMIT',
}

/** ck_tcm_kind after 48 (PAID_OUT left — an expense is an ExpV). */
export enum TillMovementKind {
  FLOAT_ISSUE = 'FLOAT_ISSUE',
  TOP_UP = 'TOP_UP',
  PICKUP = 'PICKUP',
  DROP = 'DROP',
  CLOSE_HANDOVER = 'CLOSE_HANDOVER',
  PAID_IN = 'PAID_IN',
  REMIT = 'REMIT',
  SAFE_TRANSFER = 'SAFE_TRANSFER',
  EXCHANGE = 'EXCHANGE',
}

/** The voucher type each movement kind posts in (47 §5). EXCHANGE posts none. */
export const MOVEMENT_VOUCHER_TYPE: Readonly<Record<TillMovementKind, string | null>> = {
  [TillMovementKind.FLOAT_ISSUE]: 'TFlt',
  [TillMovementKind.TOP_UP]: 'TFlt',
  [TillMovementKind.PICKUP]: 'TDrp',
  [TillMovementKind.DROP]: 'TDrp',
  [TillMovementKind.CLOSE_HANDOVER]: 'TDrp',
  [TillMovementKind.PAID_IN]: 'TPIn',
  [TillMovementKind.REMIT]: 'CRem',
  [TillMovementKind.SAFE_TRANSFER]: 'CRem',
  [TillMovementKind.EXCHANGE]: null,
};

/**
 * The movements a till posts by hand (§5, S3), every one entered at the counter
 * by the session's cashier: a drop of a sealed bag into the drop safe, money in,
 * notes changed — and, signed by a SUPERVISOR standing there with their till PIN
 * (notes 110), a pickup handed to them or change they bring. FLOAT_ISSUE and
 * CLOSE_HANDOVER are written by the session's open and close; REMIT is the
 * cash office's (notes 118, movements/remit); SAFE_TRANSFER has no route yet.
 */
export const CASHIER_MOVEMENTS: readonly TillMovementKind[] = [
  TillMovementKind.DROP,
  TillMovementKind.PAID_IN,
  TillMovementKind.EXCHANGE,
];
/** The two-signature kinds (notes 110): the cashier keys them, a supervisor with Till Sessions (273) OVERRIDE signs by PIN. */
export const SUPERVISOR_MOVEMENTS: readonly TillMovementKind[] = [
  TillMovementKind.PICKUP,
  TillMovementKind.TOP_UP,
];
/** What MOVEMENT_VOID may undo: the hand-posted ones, never the open's float or the close's hand-over. */
export const VOIDABLE_MOVEMENTS: readonly TillMovementKind[] = [
  ...CASHIER_MOVEMENTS,
  ...SUPERVISOR_MOVEMENTS,
];

/** The till variance voucher type (47 §10.2). */
export const VARIANCE_VOUCHER_TYPE = 'TVar';

/** Notes 113 — a received bag into the safe: Dr Safe / Cr Till cash awaiting receipt. */
export const RECEIVE_VOUCHER_TYPE = 'TRcv';

/** Notes 113 — the ledger role a hand-over / drop sits in until it is received (Cash-in-Hand). */
export const TILL_CASH_AWAITING_ROLE = 'TILL_CASH_AWAITING';

/**
 * Notes 113 — the movements that wait for a supervisor to receive them when
 * till.handover_receipt is REQUIRED: the bags the cashier parts with alone
 * (ck_tcm_receipt_kind). A PICKUP is already two signatures (notes 110).
 */
export const RECEIPT_MOVEMENTS: readonly TillMovementKind[] = [
  TillMovementKind.DROP,
  TillMovementKind.CLOSE_HANDOVER,
];

/** tcm_remit_mode (notes 118). */
export enum TillRemitMode {
  /** Staff paid it in at the bank: CRem Dr Bank / Cr Safe. */
  BANK_DEPOSIT = 'BANK_DEPOSIT',
  /** A cash-in-transit agency took it: CRem Dr Cash in transit / Cr Safe, then the confirm's Contra. */
  CIT = 'CIT',
}

/** tcm_remit_status (notes 118); VOIDED is tcm_status. */
export enum TillRemitStatus {
  /** BANK_DEPOSIT: in the bank once posted. */
  DEPOSITED = 'DEPOSITED',
  /** CIT: with the agency, until the bank statement shows it. */
  IN_TRANSIT = 'IN_TRANSIT',
  /** CIT: remit-confirm posted the Contra Dr Bank / Cr Cash in transit. */
  CONFIRMED = 'CONFIRMED',
}

/** Notes 118 — the ledger role a CIT remittance sits in until the bank confirms it. */
export const CASH_IN_TRANSIT_ROLE = 'CASH_IN_TRANSIT';

/** Notes 118 — what a safe count or a remit-confirm answers about its gap. */
export enum TillSafeGapOutcome {
  /** No difference. */
  EXACT = 'EXACT',
  /** Within till.cash_tolerance: posted at once. */
  WITHIN_TOLERANCE = 'WITHIN_TOLERANCE',
  /** Beyond it, decided in the same step under SAFE_VARIANCE. */
  DECIDED = 'DECIDED',
  /** Beyond it, PENDING for safes/decide-variance. */
  SENT_FOR_APPROVAL = 'SENT_FOR_APPROVAL',
}

/** tcm_receipt_status (notes 113); NULL = straight into the safe. */
export enum TillReceiptStatus {
  AWAITING = 'AWAITING',
  RECEIVED = 'RECEIVED',
}

/**
 * Notes 114 — a session's cash receipt as the Till Sessions list and the
 * cockpit show it, over its hand-over and drops that waited for a receipt.
 */
export enum TillCashReceiptState {
  /** Some hand-over / drop still waits for a supervisor. */
  AWAITING = 'AWAITING',
  /** All received, for exactly what was handed over. */
  APPROVED = 'APPROVED',
  /** All received, with a gap — decided, or pending a decision. */
  DIFFERENCE = 'DIFFERENCE',
  /** Nothing waited: till.handover_receipt NONE, or closed before notes 113. */
  NONE = 'NONE',
}

/** Notes 117 — one line of a day's close-check. */
export enum TillCloseCheckCode {
  SESSIONS_LIVE = 'SESSIONS_LIVE',
  SESSIONS_PENDING_APPROVAL = 'SESSIONS_PENDING_APPROVAL',
  CASH_TO_APPROVE = 'CASH_TO_APPROVE',
  VARIANCE_UNDECIDED = 'VARIANCE_UNDECIDED',
  MOVEMENTS_UNPOSTED = 'MOVEMENTS_UNPOSTED',
  SLIP_GAPS = 'SLIP_GAPS',
  HELD_BILLS = 'HELD_BILLS',
  SAFE_OVER_INSURED = 'SAFE_OVER_INSURED',
  /** Notes 118 — a safe that held or moved cash has no count of the day (RED under till.day_close_safe_count). */
  SAFE_NOT_COUNTED = 'SAFE_NOT_COUNTED',
}

/** RED blocks the close · AMBER is shown, not enforced · GREEN is clear. */
export enum TillCloseCheckTone {
  RED = 'RED',
  AMBER = 'AMBER',
  GREEN = 'GREEN',
}

/**
 * The RED items a day may be closed over with a DAY_CLOSE_EXCEPTION approval:
 * a cashier who left (their session is force-closed by the close), and a safe
 * not counted (notes 118: "Safe counted next morning"). Every other RED is a
 * decision still missing.
 */
export const CLOSE_EXCEPTION_CODES: readonly TillCloseCheckCode[] = [
  TillCloseCheckCode.SESSIONS_LIVE,
  TillCloseCheckCode.SAFE_NOT_COUNTED,
];

/** till.handover_receipt (notes 113). */
export enum TillHandoverReceipt {
  /** The hand-over and a drop post straight into the safe, as before notes 113. */
  NONE = 'NONE',
  /** They post to Till cash awaiting receipt until a supervisor receives them. */
  REQUIRED = 'REQUIRED',
}

/** ck_tvr_stage. */
export enum TillVarianceStage {
  /** The float mismatch at the open. */
  OPEN = 'OPEN',
  /** The drawer at the close. */
  CLOSE = 'CLOSE',
  /** A bag received for other than was handed over (notes 113). */
  RECEIVE = 'RECEIVE',
  /** Notes 118 — a safe count's gap (no session; the safe and the count). */
  SAFE = 'SAFE',
  /** Notes 118 — a CIT remittance the bank credited short (no session; the safe and the REMIT). */
  REMIT = 'REMIT',
}

/** ck_tvr_treatment. */
export enum TillVarianceTreatment {
  PENDING = 'PENDING',
  WITHIN_TOLERANCE = 'WITHIN_TOLERANCE',
  EXPENSE = 'EXPENSE',
  RECOVER = 'RECOVER',
  SUSPENSE = 'SUSPENSE',
  RETENDERED = 'RETENDERED',
}

/** ck_tss_variance_status. */
export enum TillSessionVarianceStatus {
  NONE = 'NONE',
  WITHIN_TOLERANCE = 'WITHIN_TOLERANCE',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  RECOVER = 'RECOVER',
  INVESTIGATE = 'INVESTIGATE',
}

/** acc_tender_types.ttm_close_mode (47 §1.8). */
export enum TenderCloseMode {
  /** Cash: counted by denomination. */
  DENOM = 'DENOM',
  /** Card / cheque / gift voucher: slips counted + amount + batch ref. */
  SLIPS = 'SLIPS',
  /** UPI / wallet / bank: nothing to count; reconciled against the statement (49). */
  STATEMENT = 'STATEMENT',
  /** Credit / temp credit / loyalty / RRN: not money in the drawer. */
  NONE = 'NONE',
}

/** acc_tender_types.ttm_type_id of CASH — pinned by Acc_Tender_Types.sql and ck_tvr_*. */
export const CASH_TENDER_TYPE_ID = 1;

/** The answer a blind count gets (§5.4): never the figure. */
export enum TillCountOutcome {
  ACCEPTED = 'ACCEPTED',
  RECOUNT_REQUIRED = 'RECOUNT_REQUIRED',
  SENT_FOR_APPROVAL = 'SENT_FOR_APPROVAL',
}

/** ck_tev_code after 49 — the ones phase 1 writes, and the ones a client may send. */
export enum TillEventCode {
  DAY_OPEN = 'DAY_OPEN',
  SESSION_OPEN = 'SESSION_OPEN',
  SESSION_SUSPEND = 'SESSION_SUSPEND',
  SESSION_RESUME = 'SESSION_RESUME',
  SESSION_END_BILLING = 'SESSION_END_BILLING',
  SESSION_COUNT = 'SESSION_COUNT',
  SESSION_RECOUNT = 'SESSION_RECOUNT',
  SESSION_CLOSE = 'SESSION_CLOSE',
  SESSION_IDLE_LOCK = 'SESSION_IDLE_LOCK',
  COUNTER_RELINK = 'COUNTER_RELINK',
  MOVEMENT_POSTED = 'MOVEMENT_POSTED',
  MOVEMENT_VOIDED = 'MOVEMENT_VOIDED',
  VARIANCE_DECIDED = 'VARIANCE_DECIDED',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  /** Notes 124 §5 — a request decided (APPROVED / REJECTED) or cancelled (payload `status`). */
  APPROVAL_DECIDED = 'APPROVAL_DECIDED',
  /** Notes 124 §5 — a request swept past tap_expires_on. */
  APPROVAL_EXPIRED = 'APPROVAL_EXPIRED',
  DRAWER_OPEN_SALE = 'DRAWER_OPEN_SALE',
  NO_SALE = 'NO_SALE',
  DRAWER_LEFT_OPEN = 'DRAWER_LEFT_OPEN',
  X_REPORT = 'X_REPORT',
  REPRINT = 'REPRINT',
  CASH_ALERT = 'CASH_ALERT',
  CASH_BLOCK = 'CASH_BLOCK',
  CASH_UNBLOCK = 'CASH_UNBLOCK',
  OFFLINE_START = 'OFFLINE_START',
  OFFLINE_END = 'OFFLINE_END',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PIN_FAIL = 'PIN_FAIL',
  SYNC_PENDING_AT_CLOSE = 'SYNC_PENDING_AT_CLOSE',
  LATE_ARRIVAL = 'LATE_ARRIVAL',
  SESSION_DAY_ENDED = 'SESSION_DAY_ENDED',
  /** 48 — the money documents of a session (plan-till-receipt-payment-expense §3.6). */
  RECEIPT_POSTED = 'RECEIPT_POSTED',
  PAYMENT_POSTED = 'PAYMENT_POSTED',
  EXPENSE_POSTED = 'EXPENSE_POSTED',
  MONEY_DOC_CANCELLED = 'MONEY_DOC_CANCELLED',
  // 49 — non-cash tender control (plan-noncash-tender-control §3–§6)
  DUPLICATE_REF_BLOCKED = 'DUPLICATE_REF_BLOCKED',
  SLIP_CHECK = 'SLIP_CHECK',
  SETTLEMENT_IMPORTED = 'SETTLEMENT_IMPORTED',
  SETTLEMENT_POSTED = 'SETTLEMENT_POSTED',
  NONCASH_WRITTEN_OFF = 'NONCASH_WRITTEN_OFF',
  /** Notes 113 — a supervisor received a hand-over / drop into the safe. */
  CASH_RECEIVED = 'CASH_RECEIVED',
  /** A bill re-tendered, in the session the money moved in (notes 99 §7; in ck_tev_code since 47). */
  RETENDER = 'RETENDER',
  /** Notes 117 — the day close and the session exceptions (in ck_tev_code since 47). */
  DAY_CLOSE = 'DAY_CLOSE',
  DAY_REOPEN = 'DAY_REOPEN',
  SESSION_FORCE_CLOSE = 'SESSION_FORCE_CLOSE',
  SESSION_REOPEN = 'SESSION_REOPEN',
  /** Notes 118 — a safe counted; a CIT remittance confirmed by the bank. */
  SAFE_COUNT = 'SAFE_COUNT',
  REMIT_CONFIRMED = 'REMIT_CONFIRMED',
  /** Notes 134 — head office reviewed a day or a session (till_session_review). */
  HO_REVIEW = 'HO_REVIEW',
  /**
   * Void bill (REV 2) — a sale bill voided in its live session (/bills/void,
   * the server writes it with the till_void row) and a line removed or reduced
   * on the sale bill screen (a device fact, reported through events/batch).
   */
  BILL_VOID = 'BILL_VOID',
  LINE_VOID = 'LINE_VOID',
}

/**
 * The codes a DEVICE may report through /till/events/batch — facts only the
 * client sees (a drawer kicked, a no-sale, an idle lock, an X read printed).
 * Everything else in ck_tev_code is written by the server as it acts, and a
 * client claiming "SESSION_CLOSE" must not be able to put one in the journal.
 */
export const CLIENT_EVENT_CODES: readonly TillEventCode[] = [
  TillEventCode.DRAWER_OPEN_SALE,
  TillEventCode.NO_SALE,
  TillEventCode.DRAWER_LEFT_OPEN,
  TillEventCode.X_REPORT,
  TillEventCode.REPRINT,
  TillEventCode.SESSION_IDLE_LOCK,
  TillEventCode.CASH_ALERT,
  TillEventCode.OFFLINE_START,
  TillEventCode.OFFLINE_END,
  TillEventCode.LOGIN,
  TillEventCode.LOGOUT,
  TillEventCode.SYNC_PENDING_AT_CLOSE,
  /**
   * Void bill (REV 2 §3.5): a line deleted or its qty lowered on a sale bill
   * keyed in a till session — often on a draft never saved, so only the device
   * sees it. BILL_VOID stays server-only (/bills/void writes it).
   */
  TillEventCode.LINE_VOID,
];

/** ck_trs_category after 49. */
export const TILL_REASON_CATEGORIES = [
  'VARIANCE',
  'FLOAT_MISMATCH',
  'EXPENSE',
  'PAID_IN',
  'PICKUP',
  'NO_SALE',
  'SUSPEND',
  'FORCE_CLOSE',
  'REOPEN',
  'SESSION_VOID',
  'MOVEMENT_VOID',
  'DAY_REOPEN',
  'REPRINT',
  'VOID_BILL',
  'VOID_LINE',
  'PRICE_OVERRIDE',
  'REFUND',
  'NONCASH',
  /** Notes 117: the reason a day closes over an exception. */
  'DAY_CLOSE',
] as const;

/** ck_tar_event / ck_tap_event after 49. */
export const TILL_APPROVAL_EVENTS = [
  'FLOAT_MISMATCH',
  'CASH_VARIANCE',
  'NONCASH_VARIANCE',
  'EXPENSE',
  'CASH_PAYMENT',
  'PAID_IN',
  'PICKUP',
  'TOP_UP',
  'NO_SALE',
  'CASH_LIMIT_OVERRIDE',
  'SUSPEND_LONG',
  'FORCE_CLOSE',
  'SESSION_REOPEN',
  'SESSION_VOID',
  'MOVEMENT_VOID',
  'RECOUNT',
  'DAY_CLOSE_EXCEPTION',
  'DAY_REOPEN',
  'SAFE_VARIANCE',
  'REMITTANCE',
  'VOID_BILL',
  'VOID_LINE',
  'PRICE_OVERRIDE',
  'DISCOUNT_OVER',
  'RETURN_NO_RECEIPT',
  'REFUND_CASH',
  'REPRINT',
  'RETENDER',
  'COUNTER_RELINK',
  'NONCASH_WRITE_OFF',
  'SETTLEMENT_RESOLVE',
] as const;

/** ck_tar_mode. */
export const TILL_APPROVAL_MODES = [
  'NEVER',
  'ALWAYS',
  'OVER_AMOUNT',
  'OVER_COUNT',
  'OVER_PERCENT',
] as const;
/** ck_tar_channel. */
export const TILL_APPROVAL_CHANNELS = ['COUNTER', 'REMOTE', 'EITHER'] as const;
/**
 * ck_tar_role / ck_taa_role, lowest level first — TILL_DESIGN.md §5.1's order
 * (SUPERVISOR · CASH_OFFICE · STORE_MANAGER · AREA_MANAGER · HO_FINANCE), the
 * one the Till Approval Authority screen (285) previews. A grant at one level covers
 * every rule that asks for a lower one (notes 105 A2).
 */
export const TILL_APPROVER_ROLES = [
  'SUPERVISOR',
  'CASH_OFFICE',
  'STORE_MANAGER',
  'AREA_MANAGER',
  'HO_FINANCE',
] as const;
/** One of TILL_APPROVER_ROLES. */
export type TillApproverRole = (typeof TILL_APPROVER_ROLES)[number];
/** The level's rank in TILL_APPROVER_ROLES; −1 for a label outside the list. */
export function approverRoleRank(role: string): number {
  return TILL_APPROVER_ROLES.indexOf(role as TillApproverRole);
}

/** /till/sessions/decide-variance (notes 105 A1). */
export enum TillVarianceDecision {
  /** The PENDING variances take the treatment named; the session goes back to COUNTING for /close. */
  APPROVE = 'APPROVE',
  /** Back to COUNTING, uncounted, with one more count attempt; the next final count replaces the variances. */
  RECOUNT = 'RECOUNT',
}
/** The treatments an approver may choose; WITHIN_TOLERANCE and RETENDERED are the system's. */
export const APPROVABLE_TREATMENTS = [
  TillVarianceTreatment.EXPENSE,
  TillVarianceTreatment.RECOVER,
  TillVarianceTreatment.SUSPENSE,
] as const;
/** Notes 118 — the treatments a safe gap takes: there is no cashier to RECOVER from. */
/** ck_tsr_outcome — what head office made of a day or a session (notes 134). */
export enum TillReviewOutcome {
  OK = 'OK',
  QUERY = 'QUERY',
  ESCALATED = 'ESCALATED',
  RECOVERY_ORDERED = 'RECOVERY_ORDERED',
  WRITTEN_OFF = 'WRITTEN_OFF',
  SUSPENSE_CLEARED = 'SUSPENSE_CLEARED',
  BANK_MATCHED = 'BANK_MATCHED',
}
/** The outcomes that may name the journal head office raised (tsr_ref_voucher_id). */
export const REVIEW_REF_OUTCOMES: readonly TillReviewOutcome[] = [
  TillReviewOutcome.WRITTEN_OFF,
  TillReviewOutcome.SUSPENSE_CLEARED,
];

/** Notes 118 — EXPENSE · SUSPENSE: what a safe gap (stage SAFE / REMIT) may take; no RECOVER, there is no cashier. */
export const SAFE_GAP_TREATMENTS = [
  TillVarianceTreatment.EXPENSE,
  TillVarianceTreatment.SUSPENSE,
] as const;
/** One of SAFE_GAP_TREATMENTS. */
export type TillSafeGapTreatment = (typeof SAFE_GAP_TREATMENTS)[number];
/** What the session's variance status becomes under each approved treatment (ck_tss_variance_status). */
export const VARIANCE_STATUS_OF_TREATMENT: Readonly<
  Record<(typeof APPROVABLE_TREATMENTS)[number], TillSessionVarianceStatus>
> = {
  [TillVarianceTreatment.EXPENSE]: TillSessionVarianceStatus.ACCEPTED,
  [TillVarianceTreatment.RECOVER]: TillSessionVarianceStatus.RECOVER,
  [TillVarianceTreatment.SUSPENSE]: TillSessionVarianceStatus.INVESTIGATE,
};

/** The setting keys phase 1 reads (47 §10.3, 48 §8). */
export enum TillSettingKey {
  REQUIRE_SESSION = 'till.require_session',
  DAY_CUTOFF = 'till.day_cutoff',
  DAY_AUTO_OPEN = 'till.day_auto_open',
  FLOAT_MODE = 'till.float_mode',
  BLIND_CLOSE = 'till.blind_close',
  MAX_RECOUNTS = 'till.max_recounts',
  COUNT_PLACE = 'till.count_place',
  CASH_TOLERANCE = 'till.cash_tolerance',
  NONCASH_TOLERANCE = 'till.noncash_tolerance',
  CLOSE_WITH_HOLDS = 'till.close_with_holds',
  IDLE_LOCK_MINUTES = 'till.idle_lock_minutes',
  SESSION_MAX_HOURS = 'till.session_max_hours',
  SINGLE_OPERATOR = 'till.single_operator',
  MONEY_DOCS_IN_SESSION = 'till.money_docs_in_session',
  BACKOFFICE_CASH_FROM = 'till.backoffice_cash_from',
  /** Notes 113 — REQUIRED: the hand-over and drops wait for a supervisor's receipt. */
  HANDOVER_RECEIPT = 'till.handover_receipt',
  /** 47 — the day close wants each safe counted (notes 118: SAFE_NOT_COUNTED is RED). */
  DAY_CLOSE_SAFE_COUNT = 'till.day_close_safe_count',
  /** Notes 122 §5 — REFUSE: cash paid out of a drawer never exceeds its expected cash. */
  CASH_OUT_OVER_EXPECTED = 'till.cash_out_over_expected',
  /**
   * Notes 124 §5 — WARN: an event its rule asks an approval for goes through
   * and files a PENDING request for the inbox; REFUSE: refused (428) until an
   * approved request is brought — only on a rule that blocks the till.
   */
  APPROVAL_GATE = 'till.approval_gate',
  /** 49 — a TENDER key the close reads (plan-noncash-tender-control §4.1). */
  CLOSE_BY_TERMINAL = 'tender.close_by_terminal',
}

/**
 * Every refusal the till answers with, in the design's §7.3 words. The HTTP
 * status rides with each code (TILL_ERROR_STATUS) so a caller and a test read
 * the same pair.
 */
export enum TillErrorCode {
  SESSION_REQUIRED = 'TILL_SESSION_REQUIRED',
  SESSION_NOT_OPEN = 'TILL_SESSION_NOT_OPEN',
  SESSION_NOT_YOURS = 'TILL_SESSION_NOT_YOURS',
  SESSION_WRONG_DEVICE = 'TILL_SESSION_WRONG_DEVICE',
  SESSION_NOT_FOUND = 'TILL_SESSION_NOT_FOUND',
  COUNTER_BUSY = 'TILL_COUNTER_BUSY',
  COUNTER_NOT_FOUND = 'TILL_COUNTER_NOT_FOUND',
  OPERATOR_BUSY = 'TILL_OPERATOR_BUSY',
  DEVICE_REQUIRED = 'TILL_DEVICE_REQUIRED',
  DAY_NOT_OPEN = 'TILL_DAY_NOT_OPEN',
  DAY_CLOSING = 'TILL_DAY_CLOSING',
  SALES_DAY_CLOSED = 'SALES_DAY_CLOSED',
  APPROVAL_REQUIRED = 'TILL_APPROVAL_REQUIRED',
  BLIND_CLOSE = 'TILL_BLIND_CLOSE',
  HOLDS_OPEN = 'TILL_HOLDS_OPEN',
  RECOUNT_LIMIT = 'TILL_RECOUNT_LIMIT',
  LEDGER_UNMAPPED = 'TILL_LEDGER_UNMAPPED',
  SAFE_MISSING = 'TILL_SAFE_MISSING',
  FLOAT_INVALID = 'TILL_FLOAT_INVALID',
  COUNT_INVALID = 'TILL_COUNT_INVALID',
  NOT_COUNTED = 'TILL_NOT_COUNTED',
  YEAR_NOT_SET_UP = 'TILL_YEAR_NOT_SET_UP',
  MASTER_IN_USE = 'TILL_MASTER_IN_USE',
  EVENT_INVALID = 'TILL_EVENT_INVALID',
  SESSION_CLOSED_USE_RETURN = 'TILL_SESSION_CLOSED_USE_RETURN',
  CASH_BLOCKED = 'TILL_CASH_BLOCKED',
  /** Notes 122 §5 — a document pays out more cash than the drawer is expected to hold (till.cash_out_over_expected = REFUSE). */
  CASH_SHORT_IN_DRAWER = 'TILL_CASH_SHORT_IN_DRAWER',
  MOVEMENT_INVALID = 'TILL_MOVEMENT_INVALID',
  MOVEMENT_NOT_FOUND = 'TILL_MOVEMENT_NOT_FOUND',
  MOVEMENT_NOT_VOIDABLE = 'TILL_MOVEMENT_NOT_VOIDABLE',
  REASON_INVALID = 'TILL_REASON_INVALID',
  /** REV 2 §2.6 — the device still holds bills it has not sent. */
  DEVICE_UNSYNCED = 'TILL_DEVICE_UNSYNCED',
  /** REV 2 §2.7 — the business-day cut-off has passed for this session. */
  SESSION_DAY_ENDED = 'TILL_SESSION_DAY_ENDED',
  /** REV 2 §2.8 — a movement of a session past COUNTING is not voided. */
  MOVEMENT_SESSION_CLOSED = 'TILL_MOVEMENT_SESSION_CLOSED',
  /** REV 2 errata 5 — money into a CLOSED session that is not a late arrival. */
  SESSION_CLOSED = 'TILL_SESSION_CLOSED',
  /** Counter claim §2 rule 1 — the login's device is not in device_master. */
  DEVICE_UNKNOWN = 'TILL_DEVICE_UNKNOWN',
  /** Counter claim §2 rule 1 — the login's device is blocked or switched off in device_master. */
  DEVICE_BLOCKED = 'TILL_DEVICE_BLOCKED',
  /** Counter claim §2.1 — an unlinked device, and no counter of the branch is free. */
  NO_FREE_COUNTER = 'TILL_NO_FREE_COUNTER',
  /** Counter claim §2 rule 3 — the counter this device is linked to is inactive. */
  COUNTER_INACTIVE = 'TILL_COUNTER_INACTIVE',
  /** Counter claim §4 — the counter named is linked to another device, or is not on the free list. */
  COUNTER_NOT_YOURS = 'TILL_COUNTER_NOT_YOURS',
  /** 48 §2.2 — a journal / contra leg on the till cash ledger, on a device in session. */
  CASH_LEDGER_DIRECT = 'TILL_CASH_LEDGER_DIRECT',
  /** Notes 105 A2 — the approver is the session's own cashier (tar_allow_self = false). */
  APPROVER_SELF = 'TILL_APPROVER_SELF',
  /** Notes 127 §6 — the session's own cashier tried to force-close it (FORCE_CLOSE rule, no self). */
  FORCE_CLOSE_SELF = 'TILL_FORCE_CLOSE_SELF',
  /** Notes 105 A2 — no till_approval_authority grant covers this event, branch and level (Till Approval Authority, menu 285); a SUPER ADMIN needs none. */
  APPROVER_NO_GRANT = 'TILL_APPROVER_NO_GRANT',
  /** Notes 105 A2 — every grant at the level has a taa_max_amount below the variance. */
  APPROVER_LIMIT = 'TILL_APPROVER_LIMIT',
  /** Notes 105 A2 — the channel wants the approver's till PIN (usr_pin_hash, notes 95), and none or a wrong one came. */
  APPROVER_PIN = 'TILL_APPROVER_PIN',
  /** Notes 122 §8 — the approver has no till PIN (usr_pin_hash, notes 95) to type, as the witness's / supervisor's / receiver's NO_PIN. */
  APPROVER_NO_PIN = 'TILL_APPROVER_NO_PIN',
  /** Notes 108 — a PICKUP / TOP_UP came without the witness's till PIN. */
  WITNESS_PIN_REQUIRED = 'TILL_WITNESS_PIN_REQUIRED',
  /** Notes 108 — the witness's till PIN is wrong (journalled PIN_FAIL). */
  WITNESS_PIN = 'TILL_WITNESS_PIN',
  /** Notes 108 — the witness has no till PIN (usr_pin_hash, notes 95) to check. */
  WITNESS_NO_PIN = 'TILL_WITNESS_NO_PIN',
  /** Notes 110 — a PICKUP / TOP_UP is entered at the counter by the session's cashier, never from the office. */
  MOVEMENT_AT_COUNTER = 'TILL_MOVEMENT_AT_COUNTER',
  /** Notes 110 — the supervisor signing a PICKUP / TOP_UP is the session's own cashier. */
  SUPERVISOR_SELF = 'TILL_SUPERVISOR_SELF',
  /** Notes 110 — the supervisor named does not hold Till Sessions (273) OVERRIDE. */
  SUPERVISOR_RIGHT = 'TILL_SUPERVISOR_RIGHT',
  /** Notes 110 — the supervisor has no till PIN (usr_pin_hash, notes 95) to sign with. */
  SUPERVISOR_NO_PIN = 'TILL_SUPERVISOR_NO_PIN',
  /** Notes 110 — a PICKUP / TOP_UP came without the supervisor's till PIN. */
  SUPERVISOR_PIN_REQUIRED = 'TILL_SUPERVISOR_PIN_REQUIRED',
  /** Notes 110 — the supervisor's till PIN is wrong (journalled PIN_FAIL). */
  SUPERVISOR_PIN = 'TILL_SUPERVISOR_PIN',
  /** Notes 110 §3 — the counter's own safe is not a drop safe (or it has none). */
  NO_DROP_SAFE = 'TILL_NO_DROP_SAFE',
  /** Notes 113 — the movement is not a bag waiting to be received (already received, voided, or straight to the safe). */
  RECEIPT_NOT_AWAITING = 'TILL_RECEIPT_NOT_AWAITING',
  /** Notes 113 / 116 — the receiver was the session's cashier (allowed only under till.single_operator). */
  RECEIVER_SELF = 'TILL_RECEIVER_SELF',
  /** Notes 113 — the receiver has no till PIN (usr_pin_hash, notes 95). */
  RECEIVER_NO_PIN = 'TILL_RECEIVER_NO_PIN',
  /** Notes 113 — a receive came without the receiver's till PIN. */
  RECEIVER_PIN_REQUIRED = 'TILL_RECEIVER_PIN_REQUIRED',
  /** Notes 113 — the receiver's till PIN is wrong (journalled PIN_FAIL). */
  RECEIVER_PIN = 'TILL_RECEIVER_PIN',
  /** Notes 113 — decide-variance named a bag with no receive difference waiting for a decision. */
  VARIANCE_NOT_PENDING = 'TILL_VARIANCE_NOT_PENDING',
  /** Notes 114 — approve-cash on a session whose cash has all been received already. */
  CASH_ALREADY_APPROVED = 'TILL_CASH_ALREADY_APPROVED',
  /** Notes 117 — days/close found RED items (the close-check's, in `items`) an exception may not cover, or none was given. */
  DAY_CLOSE_BLOCKED = 'TILL_DAY_CLOSE_BLOCKED',
  /** Notes 117 — the business day is CLOSED: closed again, or a session of it reopened. */
  DAY_CLOSED = 'TILL_DAY_CLOSED',
  /** Notes 117 — days/reopen on a day that is not CLOSED. */
  DAY_NOT_CLOSED = 'TILL_DAY_NOT_CLOSED',
  /** Notes 117 — a later business day of the branch is already CLOSED: this one stays closed. */
  DAY_LATER_CLOSED = 'TILL_DAY_LATER_CLOSED',
  /** Notes 117 — the session cannot be reopened (a later session carries its float, or its counter is busy). */
  REOPEN_BLOCKED = 'TILL_REOPEN_BLOCKED',
  /** Notes 117 — a day close over a live session needs the supervisor's count of its drawer. */
  FORCE_COUNT_REQUIRED = 'TILL_FORCE_COUNT_REQUIRED',
  /** Notes 118 — the safe moved while its count or remittance was being judged: count / send again. */
  SAFE_CHANGED = 'TILL_SAFE_CHANGED',
  /** Notes 118 — a remittance above what the safe should hold. */
  REMIT_OVER_BALANCE = 'TILL_REMIT_OVER_BALANCE',
  /** Notes 118 — remit-confirm on a remittance that is not a CIT one in transit. */
  REMIT_NOT_IN_TRANSIT = 'TILL_REMIT_NOT_IN_TRANSIT',
  /** Notes 118 — a two-person rule (SAFE_VARIANCE as shipped) without a valid second signature. */
  APPROVER_SECOND = 'TILL_APPROVER_SECOND',
  /** Notes 124 §5 — the approval request is not PENDING (decided, cancelled, expired). */
  APPROVAL_NOT_PENDING = 'TILL_APPROVAL_NOT_PENDING',
  /** Notes 124 §5 — the approval request ran past its expiry before it was decided. */
  APPROVAL_EXPIRED = 'TILL_APPROVAL_EXPIRED',
  /** Notes 124 §5 — the `approvalId` brought does not approve this action (event, document, amount, used). */
  APPROVAL_INVALID = 'TILL_APPROVAL_INVALID',
  /** Notes 124 §5 — only whoever asked (or a Till Sessions OVERRIDE holder) cancels a request. */
  APPROVAL_NOT_YOURS = 'TILL_APPROVAL_NOT_YOURS',

  // ── Notes 119 — the 404s and 400s throwTillNotFound / throwTillBadRequest raised uncoded ──
  /** No business day by that id (or none open for today) in the caller's scope. */
  DAY_NOT_FOUND = 'TILL_DAY_NOT_FOUND',
  /** No safe by that id in the caller's company. */
  SAFE_NOT_FOUND = 'TILL_SAFE_NOT_FOUND',
  /** No till reason by that id in the caller's company. */
  REASON_NOT_FOUND = 'TILL_REASON_NOT_FOUND',
  /** No denomination by that id in the caller's company. */
  DENOMINATION_NOT_FOUND = 'TILL_DENOMINATION_NOT_FOUND',
  /** No approval rule by that id in the caller's company. */
  APPROVAL_RULE_NOT_FOUND = 'TILL_APPROVAL_RULE_NOT_FOUND',
  /** No approval authority grant by that id in the caller's company. */
  APPROVAL_AUTHORITY_NOT_FOUND = 'TILL_APPROVAL_AUTHORITY_NOT_FOUND',
  /** No approval request by that id in the caller's scope. */
  APPROVAL_NOT_FOUND = 'TILL_APPROVAL_NOT_FOUND',
  /** No safe variance by that id. */
  VARIANCE_NOT_FOUND = 'TILL_VARIANCE_NOT_FOUND',
  /** A decision with no note, where one is required (approval decide, variance decide). */
  NOTE_REQUIRED = 'TILL_NOTE_REQUIRED',
  /** An approval request for a negative amount. */
  AMOUNT_NEGATIVE = 'TILL_AMOUNT_NEGATIVE',
  /** srcDocType given without srcDocId, or the other way round. */
  SOURCE_DOC_PAIR = 'TILL_SOURCE_DOC_PAIR',
  /** A counter / safe / approval rule edited onto another branch: it keeps the scope it was created in. */
  MASTER_SCOPE_FIXED = 'TILL_MASTER_SCOPE_FIXED',
  /** A master field holds a value outside its list (counter kind, drawer mode, reason category, rule event/mode/channel/role …). */
  VALUE_NOT_ALLOWED = 'TILL_VALUE_NOT_ALLOWED',
  /** A counter's cash block limit below its alert limit. */
  BLOCK_BELOW_ALERT = 'TILL_BLOCK_BELOW_ALERT',
  /** A master with that key already exists (counter/safe code, reason, denomination, rule start date). */
  MASTER_DUPLICATE = 'TILL_MASTER_DUPLICATE',
  /** The device named for a counter already drives another counter. */
  DEVICE_ALREADY_LINKED = 'TILL_DEVICE_ALREADY_LINKED',
  /** A counter's safe is not a safe of the counter's branch. */
  SAFE_OTHER_BRANCH = 'TILL_SAFE_OTHER_BRANCH',
  /** A denomination value of zero or less. */
  DENOMINATION_VALUE_INVALID = 'TILL_DENOMINATION_VALUE_INVALID',
  /** A branch-level approval authority grant with no company. */
  GRANT_COMPANY_REQUIRED = 'TILL_GRANT_COMPANY_REQUIRED',
  /** An approval authority grant for a user that does not exist. */
  USER_UNKNOWN = 'TILL_USER_UNKNOWN',
  /** An approval authority grant whose valid-to is before its valid-from. */
  VALID_TO_BEFORE_FROM = 'TILL_VALID_TO_BEFORE_FROM',
  /** The device named for a counter is not a registered device. */
  COUNTER_DEVICE_UNREGISTERED = 'TILL_COUNTER_DEVICE_UNREGISTERED',
  /** The device named for a counter is a web client (no drawer). */
  COUNTER_DEVICE_WEB = 'TILL_COUNTER_DEVICE_WEB',
  /** The device named for a counter is blocked. */
  COUNTER_DEVICE_BLOCKED = 'TILL_COUNTER_DEVICE_BLOCKED',
  /** The device named for a counter is registered to another branch. */
  COUNTER_DEVICE_OTHER_BRANCH = 'TILL_COUNTER_DEVICE_OTHER_BRANCH',
  /** A ledger named on a till master is not a ledger of this company. */
  LEDGER_NOT_IN_COMPANY = 'TILL_LEDGER_NOT_IN_COMPANY',
  /** A receive named no bag. */
  BAGS_REQUIRED = 'TILL_BAGS_REQUIRED',
  /** A receive named the same bag twice. */
  BAG_REPEATED = 'TILL_BAG_REPEATED',
  /** The deviceId / userId sent is not this login's (the token's) device / user. */
  NOT_THIS_LOGIN = 'TILL_NOT_THIS_LOGIN',
  /** An APPROVE decision with no treatment (EXPENSE, RECOVER or SUSPENSE). */
  TREATMENT_REQUIRED = 'TILL_TREATMENT_REQUIRED',
  /** RECOUNT asked where there is nothing to recount (cash handed over, bag received): APPROVE with a treatment. */
  RECOUNT_NOT_ALLOWED = 'TILL_RECOUNT_NOT_ALLOWED',
  /** The device is linked to no counter and the open named none: name one of the free counters. */
  COUNTER_REQUIRED = 'TILL_COUNTER_REQUIRED',

  // ── Notes 134 — head office reviews ──
  /** A review names neither a day nor a session, or both: exactly one. */
  REVIEW_TARGET = 'TILL_REVIEW_TARGET',
  /** refVoucherId without refVoucherAccYear, or the other way round. */
  REVIEW_REF_PAIR = 'TILL_REVIEW_REF_PAIR',
  /** A journal named on an outcome that raises none (only WRITTEN_OFF / SUSPENSE_CLEARED name one). */
  REVIEW_REF_NOT_ALLOWED = 'TILL_REVIEW_REF_NOT_ALLOWED',
  /** No voucher by that id and year in the company. */
  REVIEW_REF_NOT_FOUND = 'TILL_REVIEW_REF_NOT_FOUND',
  /** The voucher named is cancelled: a review cites a posted journal. */
  REVIEW_REF_NOT_POSTED = 'TILL_REVIEW_REF_NOT_POSTED',

  // ── Notes 135 — the movement slip and the remittance memo ──
  /** A REMIT printed as TILL_MOVEMENT, or any other movement as TILL_REMIT. */
  PRINT_WRONG_PURPOSE = 'TILL_PRINT_WRONG_PURPOSE',

  // ── Void bill (REV 2) — /bills/void ──
  /** The bill's session is counted or closed: make a sale return (cash), as assertCancellable says. */
  VOID_SESSION_CLOSED = 'TILL_VOID_SESSION_CLOSED',
  /** The bill names no till session (office / credit bill): cancel it. */
  VOID_NO_SESSION = 'TILL_VOID_NO_SESSION',
  /** Only a POSTED bill is voided (a DRAFT is deleted). */
  VOID_NOT_POSTED = 'TILL_VOID_NOT_POSTED',
  /** Not the session's cashier on its device, and no Till Sessions (273) OVERRIDE. */
  VOID_NOT_ALLOWED = 'TILL_VOID_NOT_ALLOWED',
}

/**
 * The HTTP status throwTill answers each code with (§7.3): 400 a shape the DTO could not refuse
 * · 403 not a person this signature accepts · 404 not there · 409 the wrong state · 422 a value
 * or a master to fix first · 428 an approval first. The comments below say which family a
 * later code joined, and why.
 */
export const TILL_ERROR_STATUS: Readonly<Record<TillErrorCode, number>> = {
  [TillErrorCode.SESSION_REQUIRED]: 409,
  [TillErrorCode.SESSION_NOT_OPEN]: 409,
  [TillErrorCode.SESSION_NOT_YOURS]: 403,
  [TillErrorCode.SESSION_WRONG_DEVICE]: 409,
  [TillErrorCode.SESSION_NOT_FOUND]: 404,
  [TillErrorCode.COUNTER_BUSY]: 409,
  [TillErrorCode.COUNTER_NOT_FOUND]: 404,
  [TillErrorCode.OPERATOR_BUSY]: 409,
  [TillErrorCode.DEVICE_REQUIRED]: 409,
  [TillErrorCode.DAY_NOT_OPEN]: 409,
  [TillErrorCode.DAY_CLOSING]: 409,
  [TillErrorCode.SALES_DAY_CLOSED]: 409,
  // 428 Precondition Required: the call is right, it needs an approval id first.
  [TillErrorCode.APPROVAL_REQUIRED]: 428,
  [TillErrorCode.BLIND_CLOSE]: 403,
  [TillErrorCode.HOLDS_OPEN]: 409,
  [TillErrorCode.RECOUNT_LIMIT]: 428,
  [TillErrorCode.LEDGER_UNMAPPED]: 422,
  [TillErrorCode.SAFE_MISSING]: 422,
  [TillErrorCode.FLOAT_INVALID]: 422,
  [TillErrorCode.COUNT_INVALID]: 422,
  [TillErrorCode.NOT_COUNTED]: 409,
  [TillErrorCode.YEAR_NOT_SET_UP]: 409,
  [TillErrorCode.MASTER_IN_USE]: 409,
  [TillErrorCode.EVENT_INVALID]: 422,
  [TillErrorCode.SESSION_CLOSED_USE_RETURN]: 409,
  [TillErrorCode.CASH_BLOCKED]: 409,
  // The drawer's state refuses it, as CASH_BLOCKED.
  [TillErrorCode.CASH_SHORT_IN_DRAWER]: 409,
  [TillErrorCode.MOVEMENT_INVALID]: 422,
  [TillErrorCode.MOVEMENT_NOT_FOUND]: 404,
  [TillErrorCode.MOVEMENT_NOT_VOIDABLE]: 409,
  [TillErrorCode.REASON_INVALID]: 422,
  [TillErrorCode.DEVICE_UNSYNCED]: 409,
  [TillErrorCode.SESSION_DAY_ENDED]: 409,
  [TillErrorCode.MOVEMENT_SESSION_CLOSED]: 409,
  [TillErrorCode.SESSION_CLOSED]: 409,
  [TillErrorCode.DEVICE_UNKNOWN]: 409,
  [TillErrorCode.DEVICE_BLOCKED]: 403,
  [TillErrorCode.NO_FREE_COUNTER]: 409,
  [TillErrorCode.COUNTER_INACTIVE]: 409,
  [TillErrorCode.COUNTER_NOT_YOURS]: 409,
  [TillErrorCode.CASH_LEDGER_DIRECT]: 409,
  // 403: the caller is not an approver this decision accepts (TILL_DESIGN.md §7.3 TILL_APPROVAL_DENIED, split four ways).
  [TillErrorCode.APPROVER_SELF]: 403,
  [TillErrorCode.FORCE_CLOSE_SELF]: 403,
  [TillErrorCode.APPROVER_NO_GRANT]: 403,
  [TillErrorCode.APPROVER_LIMIT]: 403,
  [TillErrorCode.APPROVER_PIN]: 403,
  // A user master to fix first, as WITNESS_NO_PIN.
  [TillErrorCode.APPROVER_NO_PIN]: 422,
  // Notes 108: no proof the witness was there — the same 403 as an approver's PIN.
  [TillErrorCode.WITNESS_PIN_REQUIRED]: 403,
  [TillErrorCode.WITNESS_PIN]: 403,
  // A user master to fix first, as LEDGER_UNMAPPED / SAFE_MISSING are a master to fix.
  [TillErrorCode.WITNESS_NO_PIN]: 422,
  // Notes 110: the call is right, it comes from the wrong place — as MOVEMENT_INVALID.
  [TillErrorCode.MOVEMENT_AT_COUNTER]: 422,
  [TillErrorCode.SUPERVISOR_SELF]: 422,
  // The person signing is not someone this signature accepts, as an approver's 403s.
  [TillErrorCode.SUPERVISOR_RIGHT]: 403,
  [TillErrorCode.SUPERVISOR_NO_PIN]: 422,
  [TillErrorCode.SUPERVISOR_PIN_REQUIRED]: 403,
  [TillErrorCode.SUPERVISOR_PIN]: 403,
  // A master to fix (tick the counter's safe as a drop safe), as SAFE_MISSING.
  [TillErrorCode.NO_DROP_SAFE]: 422,
  // Notes 113: the bag is not in the state the call needs, as MOVEMENT_NOT_VOIDABLE.
  [TillErrorCode.RECEIPT_NOT_AWAITING]: 409,
  // The receiver is not someone this signature accepts, as an approver's 403s.
  [TillErrorCode.RECEIVER_SELF]: 403,
  [TillErrorCode.RECEIVER_NO_PIN]: 422,
  [TillErrorCode.RECEIVER_PIN_REQUIRED]: 403,
  [TillErrorCode.RECEIVER_PIN]: 403,
  [TillErrorCode.VARIANCE_NOT_PENDING]: 409,
  [TillErrorCode.CASH_ALREADY_APPROVED]: 409,
  [TillErrorCode.DAY_CLOSE_BLOCKED]: 409,
  [TillErrorCode.DAY_CLOSED]: 409,
  [TillErrorCode.DAY_NOT_CLOSED]: 409,
  [TillErrorCode.DAY_LATER_CLOSED]: 409,
  [TillErrorCode.REOPEN_BLOCKED]: 409,
  [TillErrorCode.FORCE_COUNT_REQUIRED]: 422,
  // Notes 118: the state changed under the caller, as DAY_CLOSE_BLOCKED's "check it again".
  [TillErrorCode.SAFE_CHANGED]: 409,
  // The amount asked for is wrong for what the safe holds, as a count's figures are 422.
  [TillErrorCode.REMIT_OVER_BALANCE]: 422,
  [TillErrorCode.REMIT_NOT_IN_TRANSIT]: 409,
  // Not someone this decision accepts, as the approver's own 403s.
  [TillErrorCode.APPROVER_SECOND]: 403,
  // Notes 124 §5: the request is not in the state the call needs, as VARIANCE_NOT_PENDING.
  [TillErrorCode.APPROVAL_NOT_PENDING]: 409,
  [TillErrorCode.APPROVAL_EXPIRED]: 409,
  // The approval brought is wrong for this call, as MOVEMENT_INVALID.
  [TillErrorCode.APPROVAL_INVALID]: 422,
  [TillErrorCode.APPROVAL_NOT_YOURS]: 403,
  // Notes 119: the statuses throwTillNotFound / throwTillBadRequest always answered with.
  [TillErrorCode.DAY_NOT_FOUND]: 404,
  [TillErrorCode.SAFE_NOT_FOUND]: 404,
  [TillErrorCode.REASON_NOT_FOUND]: 404,
  [TillErrorCode.DENOMINATION_NOT_FOUND]: 404,
  [TillErrorCode.APPROVAL_RULE_NOT_FOUND]: 404,
  [TillErrorCode.APPROVAL_AUTHORITY_NOT_FOUND]: 404,
  [TillErrorCode.APPROVAL_NOT_FOUND]: 404,
  [TillErrorCode.VARIANCE_NOT_FOUND]: 404,
  [TillErrorCode.NOTE_REQUIRED]: 400,
  [TillErrorCode.AMOUNT_NEGATIVE]: 400,
  [TillErrorCode.SOURCE_DOC_PAIR]: 400,
  [TillErrorCode.MASTER_SCOPE_FIXED]: 400,
  [TillErrorCode.VALUE_NOT_ALLOWED]: 400,
  [TillErrorCode.BLOCK_BELOW_ALERT]: 400,
  [TillErrorCode.MASTER_DUPLICATE]: 400,
  [TillErrorCode.DEVICE_ALREADY_LINKED]: 400,
  [TillErrorCode.SAFE_OTHER_BRANCH]: 400,
  [TillErrorCode.DENOMINATION_VALUE_INVALID]: 400,
  [TillErrorCode.GRANT_COMPANY_REQUIRED]: 400,
  [TillErrorCode.USER_UNKNOWN]: 400,
  [TillErrorCode.VALID_TO_BEFORE_FROM]: 400,
  [TillErrorCode.COUNTER_DEVICE_UNREGISTERED]: 400,
  [TillErrorCode.COUNTER_DEVICE_WEB]: 400,
  [TillErrorCode.COUNTER_DEVICE_BLOCKED]: 400,
  [TillErrorCode.COUNTER_DEVICE_OTHER_BRANCH]: 400,
  [TillErrorCode.LEDGER_NOT_IN_COMPANY]: 400,
  [TillErrorCode.BAGS_REQUIRED]: 400,
  [TillErrorCode.BAG_REPEATED]: 400,
  [TillErrorCode.NOT_THIS_LOGIN]: 400,
  [TillErrorCode.TREATMENT_REQUIRED]: 400,
  [TillErrorCode.RECOUNT_NOT_ALLOWED]: 400,
  [TillErrorCode.COUNTER_REQUIRED]: 400,
  [TillErrorCode.REVIEW_TARGET]: 400,
  [TillErrorCode.REVIEW_REF_PAIR]: 400,
  [TillErrorCode.REVIEW_REF_NOT_ALLOWED]: 400,
  [TillErrorCode.REVIEW_REF_NOT_FOUND]: 404,
  [TillErrorCode.REVIEW_REF_NOT_POSTED]: 409,
  [TillErrorCode.PRINT_WRONG_PURPOSE]: 400,
  [TillErrorCode.VOID_SESSION_CLOSED]: 409,
  [TillErrorCode.VOID_NO_SESSION]: 409,
  [TillErrorCode.VOID_NOT_POSTED]: 409,
  [TillErrorCode.VOID_NOT_ALLOWED]: 403,
};
