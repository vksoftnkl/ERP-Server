/**
 * The till's fixed vocabulary (TILL_DESIGN.md REV 1 + share files 47 / 48 / 49).
 * Every list here mirrors a CHECK on the 47–49 tables; the CHECK is the truth
 * and these exist so the service can refuse in words before Postgres refuses
 * with a constraint name.
 */

/** Menus 271–276 (migration 20261008140000). Rights are judged on these. */
export const TILL_MENU = {
  GROUP: 271,
  /** The cashier's own session: VIEW · CREATE (open) · EDIT (suspend … close) · PRINT. */
  OPEN_TILL: 272,
  /** A supervisor's view of every session: VIEW · EXPORT · OVERRIDE (expected) · PRINT. */
  SESSIONS: 273,
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
  /** Approval rules · approval authority. */
  APPROVAL_SETUP: 276,
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
 * The movements a till posts by hand (§5, S3) and who may: a cashier drops a
 * sealed bag, takes money in, or changes notes; a SUPERVISOR takes a pickup or
 * brings change. FLOAT_ISSUE and CLOSE_HANDOVER are written by the session's
 * open and close; REMIT and SAFE_TRANSFER are the cash office's (phase 5).
 */
export const CASHIER_MOVEMENTS: readonly TillMovementKind[] = [
  TillMovementKind.DROP,
  TillMovementKind.PAID_IN,
  TillMovementKind.EXCHANGE,
];
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
  /** A bill re-tendered, in the session the money moved in (notes 99 §7; in ck_tev_code since 47). */
  RETENDER = 'RETENDER',
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
/** ck_tar_role / ck_taa_role, lowest level first. */
export const TILL_APPROVER_ROLES = [
  'SUPERVISOR',
  'STORE_MANAGER',
  'CASH_OFFICE',
  'AREA_MANAGER',
  'HO_FINANCE',
] as const;

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
}

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
};
