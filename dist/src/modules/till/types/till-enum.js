"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TILL_ERROR_STATUS = exports.TillErrorCode = exports.TillSettingKey = exports.TILL_APPROVER_ROLES = exports.TILL_APPROVAL_CHANNELS = exports.TILL_APPROVAL_MODES = exports.TILL_APPROVAL_EVENTS = exports.TILL_REASON_CATEGORIES = exports.CLIENT_EVENT_CODES = exports.TillEventCode = exports.TillCountOutcome = exports.CASH_TENDER_TYPE_ID = exports.TenderCloseMode = exports.TillSessionVarianceStatus = exports.TillVarianceTreatment = exports.VARIANCE_VOUCHER_TYPE = exports.VOIDABLE_MOVEMENTS = exports.SUPERVISOR_MOVEMENTS = exports.CASHIER_MOVEMENTS = exports.MOVEMENT_VOUCHER_TYPE = exports.TillMovementKind = exports.TillCountKind = exports.TILL_COUNTER_KINDS = exports.TillDrawerMode = exports.TillFloatMode = exports.TillDayStatus = exports.TillCounterClaim = exports.HOLDING_SESSION_STATUSES = exports.LIVE_SESSION_STATUSES = exports.TillSessionStatus = exports.TILL_RIGHT_CODE_PREFIX = exports.TILL_MENU = void 0;
exports.TILL_MENU = {
    GROUP: 271,
    OPEN_TILL: 272,
    SESSIONS: 273,
    BUSINESS_DAY: 274,
    MASTERS: 275,
    APPROVAL_SETUP: 276,
};
exports.TILL_RIGHT_CODE_PREFIX = 'TILL';
var TillSessionStatus;
(function (TillSessionStatus) {
    TillSessionStatus["OPEN"] = "OPEN";
    TillSessionStatus["SUSPENDED"] = "SUSPENDED";
    TillSessionStatus["COUNTING"] = "COUNTING";
    TillSessionStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    TillSessionStatus["CLOSED"] = "CLOSED";
    TillSessionStatus["VOIDED"] = "VOIDED";
})(TillSessionStatus || (exports.TillSessionStatus = TillSessionStatus = {}));
exports.LIVE_SESSION_STATUSES = [
    TillSessionStatus.OPEN,
    TillSessionStatus.SUSPENDED,
    TillSessionStatus.COUNTING,
];
exports.HOLDING_SESSION_STATUSES = [
    ...exports.LIVE_SESSION_STATUSES,
    TillSessionStatus.PENDING_APPROVAL,
];
var TillCounterClaim;
(function (TillCounterClaim) {
    TillCounterClaim["LINKED"] = "LINKED";
    TillCounterClaim["PICKED"] = "PICKED";
})(TillCounterClaim || (exports.TillCounterClaim = TillCounterClaim = {}));
var TillDayStatus;
(function (TillDayStatus) {
    TillDayStatus["OPEN"] = "OPEN";
    TillDayStatus["CLOSING"] = "CLOSING";
    TillDayStatus["CLOSED"] = "CLOSED";
})(TillDayStatus || (exports.TillDayStatus = TillDayStatus = {}));
var TillFloatMode;
(function (TillFloatMode) {
    TillFloatMode["ISSUED"] = "ISSUED";
    TillFloatMode["CARRIED"] = "CARRIED";
    TillFloatMode["NONE"] = "NONE";
})(TillFloatMode || (exports.TillFloatMode = TillFloatMode = {}));
var TillDrawerMode;
(function (TillDrawerMode) {
    TillDrawerMode["DRAWER"] = "DRAWER";
    TillDrawerMode["TRAY"] = "TRAY";
    TillDrawerMode["NONE"] = "NONE";
})(TillDrawerMode || (exports.TillDrawerMode = TillDrawerMode = {}));
exports.TILL_COUNTER_KINDS = [
    'POS',
    'EXPRESS',
    'RETURNS_DESK',
    'SERVICE_DESK',
    'CASH_OFFICE',
    'MOBILE',
    'SELF_CHECKOUT',
];
var TillCountKind;
(function (TillCountKind) {
    TillCountKind["OPEN"] = "OPEN";
    TillCountKind["CLOSE"] = "CLOSE";
    TillCountKind["RECOUNT"] = "RECOUNT";
    TillCountKind["HANDOVER"] = "HANDOVER";
    TillCountKind["SURPRISE"] = "SURPRISE";
    TillCountKind["FLOAT_ISSUE"] = "FLOAT_ISSUE";
    TillCountKind["PICKUP"] = "PICKUP";
    TillCountKind["DROP_VERIFY"] = "DROP_VERIFY";
    TillCountKind["SAFE"] = "SAFE";
})(TillCountKind || (exports.TillCountKind = TillCountKind = {}));
var TillMovementKind;
(function (TillMovementKind) {
    TillMovementKind["FLOAT_ISSUE"] = "FLOAT_ISSUE";
    TillMovementKind["TOP_UP"] = "TOP_UP";
    TillMovementKind["PICKUP"] = "PICKUP";
    TillMovementKind["DROP"] = "DROP";
    TillMovementKind["CLOSE_HANDOVER"] = "CLOSE_HANDOVER";
    TillMovementKind["PAID_IN"] = "PAID_IN";
    TillMovementKind["REMIT"] = "REMIT";
    TillMovementKind["SAFE_TRANSFER"] = "SAFE_TRANSFER";
    TillMovementKind["EXCHANGE"] = "EXCHANGE";
})(TillMovementKind || (exports.TillMovementKind = TillMovementKind = {}));
exports.MOVEMENT_VOUCHER_TYPE = {
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
exports.CASHIER_MOVEMENTS = [
    TillMovementKind.DROP,
    TillMovementKind.PAID_IN,
    TillMovementKind.EXCHANGE,
];
exports.SUPERVISOR_MOVEMENTS = [
    TillMovementKind.PICKUP,
    TillMovementKind.TOP_UP,
];
exports.VOIDABLE_MOVEMENTS = [
    ...exports.CASHIER_MOVEMENTS,
    ...exports.SUPERVISOR_MOVEMENTS,
];
exports.VARIANCE_VOUCHER_TYPE = 'TVar';
var TillVarianceTreatment;
(function (TillVarianceTreatment) {
    TillVarianceTreatment["PENDING"] = "PENDING";
    TillVarianceTreatment["WITHIN_TOLERANCE"] = "WITHIN_TOLERANCE";
    TillVarianceTreatment["EXPENSE"] = "EXPENSE";
    TillVarianceTreatment["RECOVER"] = "RECOVER";
    TillVarianceTreatment["SUSPENSE"] = "SUSPENSE";
    TillVarianceTreatment["RETENDERED"] = "RETENDERED";
})(TillVarianceTreatment || (exports.TillVarianceTreatment = TillVarianceTreatment = {}));
var TillSessionVarianceStatus;
(function (TillSessionVarianceStatus) {
    TillSessionVarianceStatus["NONE"] = "NONE";
    TillSessionVarianceStatus["WITHIN_TOLERANCE"] = "WITHIN_TOLERANCE";
    TillSessionVarianceStatus["PENDING"] = "PENDING";
    TillSessionVarianceStatus["ACCEPTED"] = "ACCEPTED";
    TillSessionVarianceStatus["RECOVER"] = "RECOVER";
    TillSessionVarianceStatus["INVESTIGATE"] = "INVESTIGATE";
})(TillSessionVarianceStatus || (exports.TillSessionVarianceStatus = TillSessionVarianceStatus = {}));
var TenderCloseMode;
(function (TenderCloseMode) {
    TenderCloseMode["DENOM"] = "DENOM";
    TenderCloseMode["SLIPS"] = "SLIPS";
    TenderCloseMode["STATEMENT"] = "STATEMENT";
    TenderCloseMode["NONE"] = "NONE";
})(TenderCloseMode || (exports.TenderCloseMode = TenderCloseMode = {}));
exports.CASH_TENDER_TYPE_ID = 1;
var TillCountOutcome;
(function (TillCountOutcome) {
    TillCountOutcome["ACCEPTED"] = "ACCEPTED";
    TillCountOutcome["RECOUNT_REQUIRED"] = "RECOUNT_REQUIRED";
    TillCountOutcome["SENT_FOR_APPROVAL"] = "SENT_FOR_APPROVAL";
})(TillCountOutcome || (exports.TillCountOutcome = TillCountOutcome = {}));
var TillEventCode;
(function (TillEventCode) {
    TillEventCode["DAY_OPEN"] = "DAY_OPEN";
    TillEventCode["SESSION_OPEN"] = "SESSION_OPEN";
    TillEventCode["SESSION_SUSPEND"] = "SESSION_SUSPEND";
    TillEventCode["SESSION_RESUME"] = "SESSION_RESUME";
    TillEventCode["SESSION_END_BILLING"] = "SESSION_END_BILLING";
    TillEventCode["SESSION_COUNT"] = "SESSION_COUNT";
    TillEventCode["SESSION_RECOUNT"] = "SESSION_RECOUNT";
    TillEventCode["SESSION_CLOSE"] = "SESSION_CLOSE";
    TillEventCode["SESSION_IDLE_LOCK"] = "SESSION_IDLE_LOCK";
    TillEventCode["COUNTER_RELINK"] = "COUNTER_RELINK";
    TillEventCode["MOVEMENT_POSTED"] = "MOVEMENT_POSTED";
    TillEventCode["MOVEMENT_VOIDED"] = "MOVEMENT_VOIDED";
    TillEventCode["VARIANCE_DECIDED"] = "VARIANCE_DECIDED";
    TillEventCode["APPROVAL_REQUESTED"] = "APPROVAL_REQUESTED";
    TillEventCode["DRAWER_OPEN_SALE"] = "DRAWER_OPEN_SALE";
    TillEventCode["NO_SALE"] = "NO_SALE";
    TillEventCode["DRAWER_LEFT_OPEN"] = "DRAWER_LEFT_OPEN";
    TillEventCode["X_REPORT"] = "X_REPORT";
    TillEventCode["REPRINT"] = "REPRINT";
    TillEventCode["CASH_ALERT"] = "CASH_ALERT";
    TillEventCode["CASH_BLOCK"] = "CASH_BLOCK";
    TillEventCode["CASH_UNBLOCK"] = "CASH_UNBLOCK";
    TillEventCode["OFFLINE_START"] = "OFFLINE_START";
    TillEventCode["OFFLINE_END"] = "OFFLINE_END";
    TillEventCode["LOGIN"] = "LOGIN";
    TillEventCode["LOGOUT"] = "LOGOUT";
    TillEventCode["PIN_FAIL"] = "PIN_FAIL";
    TillEventCode["SYNC_PENDING_AT_CLOSE"] = "SYNC_PENDING_AT_CLOSE";
    TillEventCode["LATE_ARRIVAL"] = "LATE_ARRIVAL";
    TillEventCode["SESSION_DAY_ENDED"] = "SESSION_DAY_ENDED";
    TillEventCode["RECEIPT_POSTED"] = "RECEIPT_POSTED";
    TillEventCode["PAYMENT_POSTED"] = "PAYMENT_POSTED";
    TillEventCode["EXPENSE_POSTED"] = "EXPENSE_POSTED";
    TillEventCode["MONEY_DOC_CANCELLED"] = "MONEY_DOC_CANCELLED";
    TillEventCode["DUPLICATE_REF_BLOCKED"] = "DUPLICATE_REF_BLOCKED";
    TillEventCode["SLIP_CHECK"] = "SLIP_CHECK";
    TillEventCode["SETTLEMENT_IMPORTED"] = "SETTLEMENT_IMPORTED";
    TillEventCode["SETTLEMENT_POSTED"] = "SETTLEMENT_POSTED";
    TillEventCode["NONCASH_WRITTEN_OFF"] = "NONCASH_WRITTEN_OFF";
    TillEventCode["RETENDER"] = "RETENDER";
})(TillEventCode || (exports.TillEventCode = TillEventCode = {}));
exports.CLIENT_EVENT_CODES = [
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
exports.TILL_REASON_CATEGORIES = [
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
];
exports.TILL_APPROVAL_EVENTS = [
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
];
exports.TILL_APPROVAL_MODES = [
    'NEVER',
    'ALWAYS',
    'OVER_AMOUNT',
    'OVER_COUNT',
    'OVER_PERCENT',
];
exports.TILL_APPROVAL_CHANNELS = ['COUNTER', 'REMOTE', 'EITHER'];
exports.TILL_APPROVER_ROLES = [
    'SUPERVISOR',
    'STORE_MANAGER',
    'CASH_OFFICE',
    'AREA_MANAGER',
    'HO_FINANCE',
];
var TillSettingKey;
(function (TillSettingKey) {
    TillSettingKey["REQUIRE_SESSION"] = "till.require_session";
    TillSettingKey["DAY_CUTOFF"] = "till.day_cutoff";
    TillSettingKey["DAY_AUTO_OPEN"] = "till.day_auto_open";
    TillSettingKey["FLOAT_MODE"] = "till.float_mode";
    TillSettingKey["BLIND_CLOSE"] = "till.blind_close";
    TillSettingKey["MAX_RECOUNTS"] = "till.max_recounts";
    TillSettingKey["COUNT_PLACE"] = "till.count_place";
    TillSettingKey["CASH_TOLERANCE"] = "till.cash_tolerance";
    TillSettingKey["NONCASH_TOLERANCE"] = "till.noncash_tolerance";
    TillSettingKey["CLOSE_WITH_HOLDS"] = "till.close_with_holds";
    TillSettingKey["IDLE_LOCK_MINUTES"] = "till.idle_lock_minutes";
    TillSettingKey["SESSION_MAX_HOURS"] = "till.session_max_hours";
    TillSettingKey["SINGLE_OPERATOR"] = "till.single_operator";
    TillSettingKey["MONEY_DOCS_IN_SESSION"] = "till.money_docs_in_session";
    TillSettingKey["BACKOFFICE_CASH_FROM"] = "till.backoffice_cash_from";
    TillSettingKey["CLOSE_BY_TERMINAL"] = "tender.close_by_terminal";
})(TillSettingKey || (exports.TillSettingKey = TillSettingKey = {}));
var TillErrorCode;
(function (TillErrorCode) {
    TillErrorCode["SESSION_REQUIRED"] = "TILL_SESSION_REQUIRED";
    TillErrorCode["SESSION_NOT_OPEN"] = "TILL_SESSION_NOT_OPEN";
    TillErrorCode["SESSION_NOT_YOURS"] = "TILL_SESSION_NOT_YOURS";
    TillErrorCode["SESSION_WRONG_DEVICE"] = "TILL_SESSION_WRONG_DEVICE";
    TillErrorCode["SESSION_NOT_FOUND"] = "TILL_SESSION_NOT_FOUND";
    TillErrorCode["COUNTER_BUSY"] = "TILL_COUNTER_BUSY";
    TillErrorCode["COUNTER_NOT_FOUND"] = "TILL_COUNTER_NOT_FOUND";
    TillErrorCode["OPERATOR_BUSY"] = "TILL_OPERATOR_BUSY";
    TillErrorCode["DEVICE_REQUIRED"] = "TILL_DEVICE_REQUIRED";
    TillErrorCode["DAY_NOT_OPEN"] = "TILL_DAY_NOT_OPEN";
    TillErrorCode["DAY_CLOSING"] = "TILL_DAY_CLOSING";
    TillErrorCode["SALES_DAY_CLOSED"] = "SALES_DAY_CLOSED";
    TillErrorCode["APPROVAL_REQUIRED"] = "TILL_APPROVAL_REQUIRED";
    TillErrorCode["BLIND_CLOSE"] = "TILL_BLIND_CLOSE";
    TillErrorCode["HOLDS_OPEN"] = "TILL_HOLDS_OPEN";
    TillErrorCode["RECOUNT_LIMIT"] = "TILL_RECOUNT_LIMIT";
    TillErrorCode["LEDGER_UNMAPPED"] = "TILL_LEDGER_UNMAPPED";
    TillErrorCode["SAFE_MISSING"] = "TILL_SAFE_MISSING";
    TillErrorCode["FLOAT_INVALID"] = "TILL_FLOAT_INVALID";
    TillErrorCode["COUNT_INVALID"] = "TILL_COUNT_INVALID";
    TillErrorCode["NOT_COUNTED"] = "TILL_NOT_COUNTED";
    TillErrorCode["YEAR_NOT_SET_UP"] = "TILL_YEAR_NOT_SET_UP";
    TillErrorCode["MASTER_IN_USE"] = "TILL_MASTER_IN_USE";
    TillErrorCode["EVENT_INVALID"] = "TILL_EVENT_INVALID";
    TillErrorCode["SESSION_CLOSED_USE_RETURN"] = "TILL_SESSION_CLOSED_USE_RETURN";
    TillErrorCode["CASH_BLOCKED"] = "TILL_CASH_BLOCKED";
    TillErrorCode["MOVEMENT_INVALID"] = "TILL_MOVEMENT_INVALID";
    TillErrorCode["MOVEMENT_NOT_FOUND"] = "TILL_MOVEMENT_NOT_FOUND";
    TillErrorCode["MOVEMENT_NOT_VOIDABLE"] = "TILL_MOVEMENT_NOT_VOIDABLE";
    TillErrorCode["REASON_INVALID"] = "TILL_REASON_INVALID";
    TillErrorCode["DEVICE_UNSYNCED"] = "TILL_DEVICE_UNSYNCED";
    TillErrorCode["SESSION_DAY_ENDED"] = "TILL_SESSION_DAY_ENDED";
    TillErrorCode["MOVEMENT_SESSION_CLOSED"] = "TILL_MOVEMENT_SESSION_CLOSED";
    TillErrorCode["SESSION_CLOSED"] = "TILL_SESSION_CLOSED";
    TillErrorCode["DEVICE_UNKNOWN"] = "TILL_DEVICE_UNKNOWN";
    TillErrorCode["DEVICE_BLOCKED"] = "TILL_DEVICE_BLOCKED";
    TillErrorCode["NO_FREE_COUNTER"] = "TILL_NO_FREE_COUNTER";
    TillErrorCode["COUNTER_INACTIVE"] = "TILL_COUNTER_INACTIVE";
    TillErrorCode["COUNTER_NOT_YOURS"] = "TILL_COUNTER_NOT_YOURS";
    TillErrorCode["CASH_LEDGER_DIRECT"] = "TILL_CASH_LEDGER_DIRECT";
})(TillErrorCode || (exports.TillErrorCode = TillErrorCode = {}));
exports.TILL_ERROR_STATUS = {
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
//# sourceMappingURL=till-enum.js.map