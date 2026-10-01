"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_INVARIANTS = exports.ckLsgSlno = exports.ckLsgValidity = exports.ckLsgPoints = exports.ckLsgQty = exports.SLAB_INVARIANTS = exports.ckLssSlno = exports.ckLssValues = exports.ckLssBand = exports.ITEM_INVARIANTS = exports.ckLsiMatchPriority = exports.ckLsiSlno = exports.ckLsiValues = exports.ckLsiExclude = exports.ckLsiKind = exports.PARTY_INVARIANTS = exports.ckLspMatchPriority = exports.ckLspSlno = exports.ckLspKind = exports.BRANCH_INVARIANTS = exports.ckLsbSlno = exports.SCHEME_INVARIANTS = exports.ckLscApproved = exports.ckLscRedeemRate = exports.ckLscRedeemLimits = exports.ckLscEarnLimits = exports.ckLscActivation = exports.ckLscDecimals = exports.ckLscPriority = exports.ckLscWeekdays = exports.ckLscTimePair = exports.ckLscDates = exports.ckLscExpiryDays = exports.ckLscExpiryBasis = exports.ckLscReturnMode = exports.ckLscPoolMode = exports.ckLscItemScope = exports.ckLscCustScope = exports.ckLscBranchScope = exports.ckLscRounding = exports.ckLscBillType = exports.ckLscCalcOn = exports.ckLscApplyOn = exports.ckLscStatus = exports.ckLscType = exports.ckLscCodeShape = void 0;
exports.collectSchemeInvariantErrors = collectSchemeInvariantErrors;
exports.collectBranchInvariantErrors = collectBranchInvariantErrors;
exports.collectPartyInvariantErrors = collectPartyInvariantErrors;
exports.collectItemInvariantErrors = collectItemInvariantErrors;
exports.collectSlabInvariantErrors = collectSlabInvariantErrors;
exports.collectGiftInvariantErrors = collectGiftInvariantErrors;
const loyalty_utils_1 = require("./loyalty.utils");
const ok = [];
const vocabulary = (field, value, allowed) => allowed.includes(value)
    ? ok
    : [{ field, message: `${field} must be one of ${allowed.join(', ')}` }];
const notNegative = (field, value) => value === null || (Number.isFinite(value) && value >= 0)
    ? ok
    : [{ field, message: `${field} must be 0 or more` }];
const inRange = (field, value, minimum, maximum) => Number.isFinite(value) && value >= minimum && value <= maximum
    ? ok
    : [{ field, message: `${field} must be between ${minimum} and ${maximum}` }];
const greaterThanZero = (field, value) => Number.isFinite(value) && value > 0
    ? ok
    : [{ field, message: `${field} must be greater than 0` }];
const wholeBetween = (field, value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum
    ? ok
    : [{ field, message: `${field} must be a whole number between ${minimum} and ${maximum}` }];
const ckLscCodeShape = (s) => loyalty_utils_1.LSC_CODE_PATTERN.test(s.lscCode)
    ? ok
    : [
        {
            field: 'lsc_code',
            message: 'lsc_code may contain only letters, digits, underscore and hyphen',
        },
    ];
exports.ckLscCodeShape = ckLscCodeShape;
const ckLscType = (s) => vocabulary('lsc_type', s.lscType, loyalty_utils_1.LSC_TYPES);
exports.ckLscType = ckLscType;
const ckLscStatus = (s) => vocabulary('lsc_status', s.lscStatus, loyalty_utils_1.LSC_STATUSES);
exports.ckLscStatus = ckLscStatus;
const ckLscApplyOn = (s) => vocabulary('lsc_apply_on', s.lscApplyOn, loyalty_utils_1.LSC_APPLY_ON);
exports.ckLscApplyOn = ckLscApplyOn;
const ckLscCalcOn = (s) => vocabulary('lsc_calc_on_amount_type', s.lscCalcOnAmountType, loyalty_utils_1.LSC_CALC_ON);
exports.ckLscCalcOn = ckLscCalcOn;
const ckLscBillType = (s) => vocabulary('lsc_bill_type', s.lscBillType, loyalty_utils_1.LSC_BILL_TYPES);
exports.ckLscBillType = ckLscBillType;
const ckLscRounding = (s) => vocabulary('lsc_rounding_method', s.lscRoundingMethod, loyalty_utils_1.LSC_ROUNDING);
exports.ckLscRounding = ckLscRounding;
const ckLscBranchScope = (s) => vocabulary('lsc_branch_scope', s.lscBranchScope, loyalty_utils_1.LSC_SCOPES);
exports.ckLscBranchScope = ckLscBranchScope;
const ckLscCustScope = (s) => vocabulary('lsc_cust_scope', s.lscCustScope, loyalty_utils_1.LSC_SCOPES);
exports.ckLscCustScope = ckLscCustScope;
const ckLscItemScope = (s) => vocabulary('lsc_item_scope', s.lscItemScope, loyalty_utils_1.LSC_SCOPES);
exports.ckLscItemScope = ckLscItemScope;
const ckLscPoolMode = (s) => vocabulary('lsc_pool_mode', s.lscPoolMode, loyalty_utils_1.LSC_POOL_MODES);
exports.ckLscPoolMode = ckLscPoolMode;
const ckLscReturnMode = (s) => vocabulary('lsc_return_mode', s.lscReturnMode, loyalty_utils_1.LSC_RETURN_MODES);
exports.ckLscReturnMode = ckLscReturnMode;
const ckLscExpiryBasis = (s) => vocabulary('lsc_expiry_basis', s.lscExpiryBasis, loyalty_utils_1.LSC_EXPIRY_BASES);
exports.ckLscExpiryBasis = ckLscExpiryBasis;
const ckLscExpiryDays = (s) => [
    ...notNegative('lsc_points_valid_days', s.lscPointsValidDays),
    ...(s.lscExpiryBasis !== 'EARN_DATE' || s.lscPointsValidDays > 0
        ? ok
        : [
            {
                field: 'lsc_points_valid_days',
                message: 'lsc_points_valid_days must be greater than 0 when lsc_expiry_basis is EARN_DATE',
            },
        ]),
];
exports.ckLscExpiryDays = ckLscExpiryDays;
const ckLscDates = (s) => s.lscEndDate.getTime() >= s.lscStartDate.getTime()
    ? ok
    : [{ field: 'lsc_end_date', message: 'lsc_end_date must be on or after lsc_start_date' }];
exports.ckLscDates = ckLscDates;
const ckLscTimePair = (s) => (s.lscValidFromTime === null) === (s.lscValidToTime === null)
    ? ok
    : [
        {
            field: 'lsc_valid_to_time',
            message: 'Send both lsc_valid_from_time and lsc_valid_to_time, or neither',
        },
    ];
exports.ckLscTimePair = ckLscTimePair;
const ckLscWeekdays = (s) => s.lscValidWeekdays === null || loyalty_utils_1.LSC_WEEKDAYS_PATTERN.test(s.lscValidWeekdays)
    ? ok
    : [
        {
            field: 'lsc_valid_weekdays',
            message: 'lsc_valid_weekdays must be comma-separated MON,TUE,WED,THU,FRI,SAT,SUN',
        },
    ];
exports.ckLscWeekdays = ckLscWeekdays;
const ckLscPriority = (s) => wholeBetween('lsc_priority', s.lscPriority, 1, 9);
exports.ckLscPriority = ckLscPriority;
const ckLscDecimals = (s) => wholeBetween('lsc_points_decimals', s.lscPointsDecimals, 0, 4);
exports.ckLscDecimals = ckLscDecimals;
const ckLscActivation = (s) => wholeBetween('lsc_activation_days', s.lscActivationDays, 0, 365);
exports.ckLscActivation = ckLscActivation;
const ckLscEarnLimits = (s) => [
    ...notNegative('lsc_min_bill_amount', s.lscMinBillAmount),
    ...notNegative('lsc_max_earn_points', s.lscMaxEarnPoints),
];
exports.ckLscEarnLimits = ckLscEarnLimits;
const ckLscRedeemLimits = (s) => [
    ...notNegative('lsc_redeem_value_per_point', s.lscRedeemValuePerPoint),
    ...notNegative('lsc_min_redeem_points', s.lscMinRedeemPoints),
    ...notNegative('lsc_max_redeem_points', s.lscMaxRedeemPoints),
    ...notNegative('lsc_redeem_min_bill_amount', s.lscRedeemMinBillAmount),
    ...notNegative('lsc_redeem_multiple', s.lscRedeemMultiple),
    ...inRange('lsc_max_redeem_perc', s.lscMaxRedeemPerc, 0, 100),
];
exports.ckLscRedeemLimits = ckLscRedeemLimits;
const ckLscRedeemRate = (s) => !s.lscAllowPointRedeem || s.lscRedeemValuePerPoint > 0
    ? ok
    : [
        {
            field: 'lsc_redeem_value_per_point',
            message: 'lsc_redeem_value_per_point must be greater than 0 once lsc_allow_point_redeem is true',
        },
    ];
exports.ckLscRedeemRate = ckLscRedeemRate;
const ckLscApproved = (s) => s.lscStatus !== 'APPROVED' || s.lscApprovedBy
    ? ok
    : [
        {
            field: 'lsc_approved_by',
            message: 'lsc_approved_by is required once lsc_status is APPROVED',
        },
    ];
exports.ckLscApproved = ckLscApproved;
exports.SCHEME_INVARIANTS = new Map([
    ['ck_lsc_code_shape', exports.ckLscCodeShape],
    ['ck_lsc_type', exports.ckLscType],
    ['ck_lsc_status', exports.ckLscStatus],
    ['ck_lsc_apply_on', exports.ckLscApplyOn],
    ['ck_lsc_calc_on', exports.ckLscCalcOn],
    ['ck_lsc_bill_type', exports.ckLscBillType],
    ['ck_lsc_rounding', exports.ckLscRounding],
    ['ck_lsc_branch_scope', exports.ckLscBranchScope],
    ['ck_lsc_cust_scope', exports.ckLscCustScope],
    ['ck_lsc_item_scope', exports.ckLscItemScope],
    ['ck_lsc_pool_mode', exports.ckLscPoolMode],
    ['ck_lsc_return_mode', exports.ckLscReturnMode],
    ['ck_lsc_expiry_basis', exports.ckLscExpiryBasis],
    ['ck_lsc_expiry_days', exports.ckLscExpiryDays],
    ['ck_lsc_dates', exports.ckLscDates],
    ['ck_lsc_time_pair', exports.ckLscTimePair],
    ['ck_lsc_weekdays', exports.ckLscWeekdays],
    ['ck_lsc_priority', exports.ckLscPriority],
    ['ck_lsc_decimals', exports.ckLscDecimals],
    ['ck_lsc_activation', exports.ckLscActivation],
    ['ck_lsc_earn_limits', exports.ckLscEarnLimits],
    ['ck_lsc_redeem_limits', exports.ckLscRedeemLimits],
    ['ck_lsc_redeem_rate', exports.ckLscRedeemRate],
    ['ck_lsc_approved', exports.ckLscApproved],
]);
function collectSchemeInvariantErrors(scheme) {
    return [...exports.SCHEME_INVARIANTS.values()].flatMap((invariant) => invariant(scheme));
}
const ckLsbSlno = (r) => Number.isInteger(r.lsbSlno) && r.lsbSlno > 0
    ? ok
    : [{ field: 'lsb_slno', message: 'lsb_slno must be a whole number greater than 0' }];
exports.ckLsbSlno = ckLsbSlno;
exports.BRANCH_INVARIANTS = new Map([
    ['ck_lsb_slno', exports.ckLsbSlno],
]);
function collectBranchInvariantErrors(row) {
    return [...exports.BRANCH_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
const ckLspKind = (r) => vocabulary('lsp_kind', r.lspKind, loyalty_utils_1.LSP_KINDS);
exports.ckLspKind = ckLspKind;
const ckLspSlno = (r) => Number.isInteger(r.lspSlno) && r.lspSlno > 0
    ? ok
    : [{ field: 'lsp_slno', message: 'lsp_slno must be a whole number greater than 0' }];
exports.ckLspSlno = ckLspSlno;
const ckLspMatchPriority = (r) => wholeBetween('lsp_match_priority', r.lspMatchPriority, 0, 9);
exports.ckLspMatchPriority = ckLspMatchPriority;
exports.PARTY_INVARIANTS = new Map([
    ['ck_lsp_kind', exports.ckLspKind],
    ['ck_lsp_slno', exports.ckLspSlno],
    ['ck_lsp_match_priority', exports.ckLspMatchPriority],
]);
function collectPartyInvariantErrors(row) {
    return [...exports.PARTY_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
const ckLsiKind = (r) => vocabulary('lsi_kind', r.lsiKind, loyalty_utils_1.LSI_KINDS);
exports.ckLsiKind = ckLsiKind;
const ckLsiExclude = (r) => !r.lsiIsExclude || (r.lsiPoints === 0 && r.lsiFactor === 1)
    ? ok
    : [
        {
            field: 'lsi_is_exclude',
            message: 'An exclude row earns nothing — leave lsi_points at 0 and lsi_factor at 1',
        },
    ];
exports.ckLsiExclude = ckLsiExclude;
const ckLsiValues = (r) => [
    ...greaterThanZero('lsi_factor', r.lsiFactor),
    ...notNegative('lsi_points', r.lsiPoints),
    ...notNegative('lsi_max_points', r.lsiMaxPoints),
];
exports.ckLsiValues = ckLsiValues;
const ckLsiSlno = (r) => Number.isInteger(r.lsiSlno) && r.lsiSlno > 0
    ? ok
    : [{ field: 'lsi_slno', message: 'lsi_slno must be a whole number greater than 0' }];
exports.ckLsiSlno = ckLsiSlno;
const ckLsiMatchPriority = (r) => wholeBetween('lsi_match_priority', r.lsiMatchPriority, 0, 9);
exports.ckLsiMatchPriority = ckLsiMatchPriority;
exports.ITEM_INVARIANTS = new Map([
    ['ck_lsi_kind', exports.ckLsiKind],
    ['ck_lsi_exclude', exports.ckLsiExclude],
    ['ck_lsi_values', exports.ckLsiValues],
    ['ck_lsi_slno', exports.ckLsiSlno],
    ['ck_lsi_match_priority', exports.ckLsiMatchPriority],
]);
function collectItemInvariantErrors(row) {
    return [...exports.ITEM_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
const ckLssBand = (r) => [
    ...notNegative('lss_exceeds', r.lssExceeds),
    ...(r.lssUpto === null || r.lssUpto > r.lssExceeds
        ? ok
        : [{ field: 'lss_upto', message: 'lss_upto must be greater than lss_exceeds' }]),
];
exports.ckLssBand = ckLssBand;
const ckLssValues = (r) => [
    ...greaterThanZero('lss_each', r.lssEach),
    ...notNegative('lss_points', r.lssPoints),
    ...greaterThanZero('lss_factor', r.lssFactor),
    ...notNegative('lss_max_points', r.lssMaxPoints),
];
exports.ckLssValues = ckLssValues;
const ckLssSlno = (r) => Number.isInteger(r.lssSlno) && r.lssSlno > 0
    ? ok
    : [{ field: 'lss_slno', message: 'lss_slno must be a whole number greater than 0' }];
exports.ckLssSlno = ckLssSlno;
exports.SLAB_INVARIANTS = new Map([
    ['ck_lss_band', exports.ckLssBand],
    ['ck_lss_values', exports.ckLssValues],
    ['ck_lss_slno', exports.ckLssSlno],
]);
function collectSlabInvariantErrors(row) {
    return [...exports.SLAB_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
const ckLsgQty = (r) => [
    ...greaterThanZero('lsg_item_qty', r.lsgItemQty),
    ...notNegative('lsg_max_qty_per_bill', r.lsgMaxQtyPerBill),
];
exports.ckLsgQty = ckLsgQty;
const ckLsgPoints = (r) => notNegative('lsg_redeem_points', r.lsgRedeemPoints);
exports.ckLsgPoints = ckLsgPoints;
const ckLsgValidity = (r) => r.lsgValidFrom === null ||
    r.lsgValidUpto === null ||
    r.lsgValidUpto.getTime() >= r.lsgValidFrom.getTime()
    ? ok
    : [{ field: 'lsg_valid_upto', message: 'lsg_valid_upto must be on or after lsg_valid_from' }];
exports.ckLsgValidity = ckLsgValidity;
const ckLsgSlno = (r) => Number.isInteger(r.lsgSlno) && r.lsgSlno > 0
    ? ok
    : [{ field: 'lsg_slno', message: 'lsg_slno must be a whole number greater than 0' }];
exports.ckLsgSlno = ckLsgSlno;
exports.GIFT_INVARIANTS = new Map([
    ['ck_lsg_qty', exports.ckLsgQty],
    ['ck_lsg_points', exports.ckLsgPoints],
    ['ck_lsg_validity', exports.ckLsgValidity],
    ['ck_lsg_slno', exports.ckLsgSlno],
]);
function collectGiftInvariantErrors(row) {
    return [...exports.GIFT_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
//# sourceMappingURL=loyalty-scheme-invariants.js.map