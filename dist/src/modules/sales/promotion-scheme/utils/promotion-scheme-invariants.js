"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLAB_INVARIANTS = exports.ckPrsSlno = exports.ckPrsBenefitColumns = exports.ckPrsFreeUnitPair = exports.ckPrsAmounts = exports.ckPrsEach = exports.ckPrsBand = exports.ITEM_INVARIANTS = exports.ckPriMatchPriority = exports.ckPriSlno = exports.ckPriValues = exports.ckPriExclude = exports.ckPriOneRate = exports.ckPriUnit = exports.ckPriKind = exports.PARTY_INVARIANTS = exports.ckPrpMatchPriority = exports.ckPrpSlno = exports.ckPrpKind = exports.SCHEME_INVARIANTS = exports.ckPrmApproved = exports.ckPrmCaps = exports.ckPrmThresholds = exports.ckPrmPriority = exports.ckPrmWeekdays = exports.ckPrmTimePair = exports.ckPrmDates = exports.ckPrmFixedPriceScope = exports.ckPrmItemScope = exports.ckPrmCustScope = exports.ckPrmBranchScope = exports.ckPrmBillType = exports.ckPrmCalcOn = exports.ckPrmStackMode = exports.ckPrmBenefit = exports.ckPrmApplyOn = exports.ckPrmStatus = exports.ckPrmCodeShape = void 0;
exports.collectSchemeInvariantErrors = collectSchemeInvariantErrors;
exports.collectPartyInvariantErrors = collectPartyInvariantErrors;
exports.collectItemInvariantErrors = collectItemInvariantErrors;
exports.collectSlabInvariantErrors = collectSlabInvariantErrors;
const promotion_scheme_utils_1 = require("./promotion-scheme.utils");
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
    : [
        {
            field,
            message: `${field} must be a whole number between ${minimum} and ${maximum}`,
        },
    ];
const ckPrmCodeShape = (s) => promotion_scheme_utils_1.PRM_CODE_PATTERN.test(s.prmCode)
    ? ok
    : [
        {
            field: 'prm_code',
            message: 'prm_code may contain only letters, digits, underscore and hyphen',
        },
    ];
exports.ckPrmCodeShape = ckPrmCodeShape;
const ckPrmStatus = (s) => vocabulary('prm_status', s.prmStatus, promotion_scheme_utils_1.PRM_STATUSES);
exports.ckPrmStatus = ckPrmStatus;
const ckPrmApplyOn = (s) => vocabulary('prm_apply_on', s.prmApplyOn, promotion_scheme_utils_1.PRM_APPLY_ON);
exports.ckPrmApplyOn = ckPrmApplyOn;
const ckPrmBenefit = (s) => vocabulary('prm_benefit', s.prmBenefit, promotion_scheme_utils_1.PRM_BENEFITS);
exports.ckPrmBenefit = ckPrmBenefit;
const ckPrmStackMode = (s) => vocabulary('prm_stack_mode', s.prmStackMode, promotion_scheme_utils_1.PRM_STACK_MODES);
exports.ckPrmStackMode = ckPrmStackMode;
const ckPrmCalcOn = (s) => vocabulary('prm_calc_on_amount_type', s.prmCalcOnAmountType, promotion_scheme_utils_1.PRM_CALC_ON);
exports.ckPrmCalcOn = ckPrmCalcOn;
const ckPrmBillType = (s) => vocabulary('prm_bill_type', s.prmBillType, promotion_scheme_utils_1.PRM_BILL_TYPES);
exports.ckPrmBillType = ckPrmBillType;
const ckPrmBranchScope = (s) => vocabulary('prm_branch_scope', s.prmBranchScope, promotion_scheme_utils_1.PRM_SCOPES);
exports.ckPrmBranchScope = ckPrmBranchScope;
const ckPrmCustScope = (s) => vocabulary('prm_cust_scope', s.prmCustScope, promotion_scheme_utils_1.PRM_SCOPES);
exports.ckPrmCustScope = ckPrmCustScope;
const ckPrmItemScope = (s) => vocabulary('prm_item_scope', s.prmItemScope, promotion_scheme_utils_1.PRM_SCOPES);
exports.ckPrmItemScope = ckPrmItemScope;
const ckPrmFixedPriceScope = (s) => s.prmBenefit !== 'FIXED_PRICE' || ['ITEM_QTY', 'ITEM_AMOUNT'].includes(s.prmApplyOn)
    ? ok
    : [
        {
            field: 'prm_apply_on',
            message: 'A FIXED_PRICE benefit needs an item trigger (ITEM_QTY or ITEM_AMOUNT) — there is no ' +
                'line to reprice on a bill-level scheme',
        },
    ];
exports.ckPrmFixedPriceScope = ckPrmFixedPriceScope;
const ckPrmDates = (s) => s.prmEndDate.getTime() >= s.prmStartDate.getTime()
    ? ok
    : [{ field: 'prm_end_date', message: 'prm_end_date must be on or after prm_start_date' }];
exports.ckPrmDates = ckPrmDates;
const ckPrmTimePair = (s) => (s.prmValidFromTime === null) === (s.prmValidToTime === null)
    ? ok
    : [
        {
            field: 'prm_valid_to_time',
            message: 'Send both prm_valid_from_time and prm_valid_to_time, or neither',
        },
    ];
exports.ckPrmTimePair = ckPrmTimePair;
const ckPrmWeekdays = (s) => s.prmValidWeekdays === null || promotion_scheme_utils_1.PRM_WEEKDAYS_PATTERN.test(s.prmValidWeekdays)
    ? ok
    : [
        {
            field: 'prm_valid_weekdays',
            message: 'prm_valid_weekdays must be comma-separated MON,TUE,WED,THU,FRI,SAT,SUN',
        },
    ];
exports.ckPrmWeekdays = ckPrmWeekdays;
const ckPrmPriority = (s) => wholeBetween('prm_priority', s.prmPriority, 1, 9);
exports.ckPrmPriority = ckPrmPriority;
const ckPrmThresholds = (s) => [
    ...notNegative('prm_min_bill_amount', s.prmMinBillAmount),
    ...notNegative('prm_min_qty', s.prmMinQty),
];
exports.ckPrmThresholds = ckPrmThresholds;
const ckPrmCaps = (s) => [
    ...notNegative('prm_max_benefit_per_bill', s.prmMaxBenefitPerBill),
    ...notNegative('prm_max_uses_total', s.prmMaxUsesTotal),
    ...notNegative('prm_max_uses_per_cust', s.prmMaxUsesPerCust),
    ...notNegative('prm_budget_amount', s.prmBudgetAmount),
];
exports.ckPrmCaps = ckPrmCaps;
const ckPrmApproved = (s) => s.prmStatus !== 'APPROVED' || s.prmApprovedBy
    ? ok
    : [
        {
            field: 'prm_approved_by',
            message: 'prm_approved_by is required once prm_status is APPROVED',
        },
    ];
exports.ckPrmApproved = ckPrmApproved;
exports.SCHEME_INVARIANTS = new Map([
    ['ck_prm_code_shape', exports.ckPrmCodeShape],
    ['ck_prm_status', exports.ckPrmStatus],
    ['ck_prm_apply_on', exports.ckPrmApplyOn],
    ['ck_prm_benefit', exports.ckPrmBenefit],
    ['ck_prm_stack_mode', exports.ckPrmStackMode],
    ['ck_prm_calc_on', exports.ckPrmCalcOn],
    ['ck_prm_bill_type', exports.ckPrmBillType],
    ['ck_prm_branch_scope', exports.ckPrmBranchScope],
    ['ck_prm_cust_scope', exports.ckPrmCustScope],
    ['ck_prm_item_scope', exports.ckPrmItemScope],
    ['ck_prm_fixed_price_scope', exports.ckPrmFixedPriceScope],
    ['ck_prm_dates', exports.ckPrmDates],
    ['ck_prm_time_pair', exports.ckPrmTimePair],
    ['ck_prm_weekdays', exports.ckPrmWeekdays],
    ['ck_prm_priority', exports.ckPrmPriority],
    ['ck_prm_thresholds', exports.ckPrmThresholds],
    ['ck_prm_caps', exports.ckPrmCaps],
    ['ck_prm_approved', exports.ckPrmApproved],
]);
function collectSchemeInvariantErrors(scheme) {
    return [...exports.SCHEME_INVARIANTS.values()].flatMap((invariant) => invariant(scheme));
}
const ckPrpKind = (r) => vocabulary('prp_kind', r.prpKind, promotion_scheme_utils_1.PRP_KINDS);
exports.ckPrpKind = ckPrpKind;
const ckPrpSlno = (r) => Number.isInteger(r.prpSlno) && r.prpSlno > 0
    ? ok
    : [{ field: 'prp_slno', message: 'prp_slno must be a whole number greater than 0' }];
exports.ckPrpSlno = ckPrpSlno;
const ckPrpMatchPriority = (r) => wholeBetween('prp_match_priority', r.prpMatchPriority, 0, 9);
exports.ckPrpMatchPriority = ckPrpMatchPriority;
exports.PARTY_INVARIANTS = new Map([
    ['ck_prp_kind', exports.ckPrpKind],
    ['ck_prp_slno', exports.ckPrpSlno],
    ['ck_prp_match_priority', exports.ckPrpMatchPriority],
]);
function collectPartyInvariantErrors(row) {
    return [...exports.PARTY_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
const ckPriKind = (r) => vocabulary('pri_kind', r.priKind, promotion_scheme_utils_1.PRI_KINDS);
exports.ckPriKind = ckPriKind;
const ckPriUnit = (r) => (r.priKind === 'ITEM') === (r.priUnitId !== null)
    ? ok
    : [
        {
            field: 'pri_unit_id',
            message: r.priKind === 'ITEM'
                ? 'pri_unit_id is required on an ITEM row — a quantity is meaningless without a unit'
                : `pri_unit_id must be null on an ${r.priKind} row — a unit belongs to one item`,
        },
    ];
exports.ckPriUnit = ckPriUnit;
const ckPriOneRate = (r) => Number(r.priDiscPerc !== 0) + Number(r.priDiscQty !== 0) + Number(r.priDiscAmt !== 0) <= 1
    ? ok
    : [
        {
            field: 'pri_disc_perc',
            message: 'Set at most one of pri_disc_perc, pri_disc_qty, pri_disc_amt',
        },
    ];
exports.ckPriOneRate = ckPriOneRate;
const ckPriExclude = (r) => !r.priIsExclude ||
    (r.priDiscPerc === 0 && r.priDiscQty === 0 && r.priDiscAmt === 0 && r.priFactor === 1)
    ? ok
    : [
        {
            field: 'pri_is_exclude',
            message: 'An exclude row gives nothing — leave every rate at 0 and pri_factor at 1',
        },
    ];
exports.ckPriExclude = ckPriExclude;
const ckPriValues = (r) => [
    ...inRange('pri_disc_perc', r.priDiscPerc, 0, 100),
    ...notNegative('pri_disc_qty', r.priDiscQty),
    ...notNegative('pri_disc_amt', r.priDiscAmt),
    ...notNegative('pri_min_qty', r.priMinQty),
    ...greaterThanZero('pri_factor', r.priFactor),
    ...notNegative('pri_max_benefit', r.priMaxBenefit),
];
exports.ckPriValues = ckPriValues;
const ckPriSlno = (r) => Number.isInteger(r.priSlno) && r.priSlno > 0
    ? ok
    : [{ field: 'pri_slno', message: 'pri_slno must be a whole number greater than 0' }];
exports.ckPriSlno = ckPriSlno;
const ckPriMatchPriority = (r) => wholeBetween('pri_match_priority', r.priMatchPriority, 0, 9);
exports.ckPriMatchPriority = ckPriMatchPriority;
exports.ITEM_INVARIANTS = new Map([
    ['ck_pri_kind', exports.ckPriKind],
    ['ck_pri_unit', exports.ckPriUnit],
    ['ck_pri_one_rate', exports.ckPriOneRate],
    ['ck_pri_exclude', exports.ckPriExclude],
    ['ck_pri_values', exports.ckPriValues],
    ['ck_pri_slno', exports.ckPriSlno],
    ['ck_pri_match_priority', exports.ckPriMatchPriority],
]);
function collectItemInvariantErrors(row) {
    return [...exports.ITEM_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
const ckPrsBand = (r) => [
    ...notNegative('prs_exceeds', r.prsExceeds),
    ...(r.prsUpto === null || r.prsUpto > r.prsExceeds
        ? ok
        : [{ field: 'prs_upto', message: 'prs_upto must be greater than prs_exceeds' }]),
];
exports.ckPrsBand = ckPrsBand;
const ckPrsEach = (r) => [
    ...greaterThanZero('prs_each', r.prsEach),
    ...notNegative('prs_max_repeats', r.prsMaxRepeats),
    ...(r.prsIsRepeat || r.prsMaxRepeats === 0
        ? ok
        : [
            {
                field: 'prs_max_repeats',
                message: 'prs_max_repeats only means something when prs_is_repeat is true',
            },
        ]),
];
exports.ckPrsEach = ckPrsEach;
const ckPrsAmounts = (r) => [
    ...notNegative('prs_free_qty', r.prsFreeQty),
    ...inRange('prs_disc_perc', r.prsDiscPerc, 0, 100),
    ...notNegative('prs_disc_qty', r.prsDiscQty),
    ...notNegative('prs_disc_amt', r.prsDiscAmt),
    ...notNegative('prs_fixed_price', r.prsFixedPrice),
    ...notNegative('prs_max_benefit_amt', r.prsMaxBenefitAmt),
];
exports.ckPrsAmounts = ckPrsAmounts;
const ckPrsFreeUnitPair = (r) => (r.prsFreeItemId === null) === (r.prsFreeUnitId === null)
    ? ok
    : [
        {
            field: 'prs_free_unit_id',
            message: 'A free item needs the unit it is issued in — send both or neither',
        },
    ];
exports.ckPrsFreeUnitPair = ckPrsFreeUnitPair;
const ckPrsBenefitColumns = (r) => {
    const noDiscounts = r.prsDiscPerc === 0 && r.prsDiscQty === 0 && r.prsDiscAmt === 0;
    const noFree = r.prsFreeItemId === null && r.prsFreeQty === 0;
    switch (r.prsBenefit) {
        case 'FREE_ITEM':
            return [
                ...(r.prsFreeItemId !== null && r.prsFreeQty > 0
                    ? ok
                    : [
                        {
                            field: 'prs_free_item_id',
                            message: 'A FREE_ITEM band needs prs_free_item_id and prs_free_qty greater than 0',
                        },
                    ]),
                ...(noDiscounts && r.prsFixedPrice === null
                    ? ok
                    : [
                        {
                            field: 'prs_benefit',
                            message: 'A FREE_ITEM band must leave the discount and fixed-price columns empty',
                        },
                    ]),
            ];
        case 'DISC_PERC':
            return [
                ...(r.prsDiscPerc > 0
                    ? ok
                    : [
                        {
                            field: 'prs_disc_perc',
                            message: 'A DISC_PERC band needs prs_disc_perc greater than 0',
                        },
                    ]),
                ...(noFree && r.prsDiscQty === 0 && r.prsDiscAmt === 0 && r.prsFixedPrice === null
                    ? ok
                    : [
                        {
                            field: 'prs_benefit',
                            message: 'A DISC_PERC band must leave every other benefit column empty',
                        },
                    ]),
            ];
        case 'DISC_AMT':
            return [
                ...(r.prsDiscAmt > 0 !== r.prsDiscQty > 0
                    ? ok
                    : [
                        {
                            field: 'prs_disc_amt',
                            message: 'A DISC_AMT band needs exactly one of prs_disc_amt (flat) or prs_disc_qty ' +
                                '(per unit)',
                        },
                    ]),
                ...(noFree && r.prsDiscPerc === 0 && r.prsFixedPrice === null
                    ? ok
                    : [
                        {
                            field: 'prs_benefit',
                            message: 'A DISC_AMT band must leave the free-item, percentage and price columns empty',
                        },
                    ]),
            ];
        case 'FIXED_PRICE':
            return [
                ...(r.prsFixedPrice !== null
                    ? ok
                    : [{ field: 'prs_fixed_price', message: 'A FIXED_PRICE band needs prs_fixed_price' }]),
                ...(noFree && noDiscounts
                    ? ok
                    : [
                        {
                            field: 'prs_benefit',
                            message: 'A FIXED_PRICE band must leave the free-item and discount columns empty',
                        },
                    ]),
            ];
        default:
            return [{ field: 'prs_benefit', message: `Unknown benefit ${r.prsBenefit}` }];
    }
};
exports.ckPrsBenefitColumns = ckPrsBenefitColumns;
const ckPrsSlno = (r) => Number.isInteger(r.prsSlno) && r.prsSlno > 0
    ? ok
    : [{ field: 'prs_slno', message: 'prs_slno must be a whole number greater than 0' }];
exports.ckPrsSlno = ckPrsSlno;
exports.SLAB_INVARIANTS = new Map([
    ['ck_prs_band', exports.ckPrsBand],
    ['ck_prs_each', exports.ckPrsEach],
    ['ck_prs_amounts', exports.ckPrsAmounts],
    ['ck_prs_free_unit_pair', exports.ckPrsFreeUnitPair],
    ['ck_prs_benefit_columns', exports.ckPrsBenefitColumns],
    ['ck_prs_slno', exports.ckPrsSlno],
]);
function collectSlabInvariantErrors(row) {
    return [...exports.SLAB_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
//# sourceMappingURL=promotion-scheme-invariants.js.map