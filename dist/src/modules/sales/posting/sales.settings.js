"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALES_SETTING_KEYS = exports.SALES_SETTING_DEFAULTS = void 0;
exports.readSalesSettings = readSalesSettings;
exports.SALES_SETTING_DEFAULTS = {
    backdateMode: 'WARN',
    creditLimitMode: 'WARN',
    rateBelowMinMode: 'WARN',
    allowExcessTender: false,
    allowPostedAmend: true,
    allowDuplicateItem: true,
    allowBillOverOrderQty: false,
    salesmanMandatory: false,
    maxBillDiscPerc: 100,
    maxLineDiscPerc: 100,
    postSchemeDiscSeparately: false,
    stockFromAnyGodown: false,
    loyaltyAutoEnrol: true,
    loyaltyRedeemAsTender: true,
    defaultCustomerId: null,
    returnWindowDays: 0,
    freeReturnAllowed: true,
    tempCreditMaxDays: 0,
    tempCreditMaxAmount: 0,
    tempCreditBlockOpen: 'WARN',
    posSeriesPerDevice: true,
    roundOffStep: 1,
};
exports.SALES_SETTING_KEYS = {
    BACKDATE_MODE: 'sales.backdate_mode',
    CREDIT_LIMIT_MODE: 'sales.credit_limit_mode',
    RATE_BELOW_MIN_MODE: 'sales.rate_below_min_mode',
    ALLOW_EXCESS_TENDER: 'sales.allow_excess_tender',
    ALLOW_POSTED_AMEND: 'sales.allow_posted_amend',
    ALLOW_DUPLICATE_ITEM: 'sales.allow_duplicate_item',
    ALLOW_BILL_OVER_ORDER_QTY: 'sales.allow_bill_over_order_qty',
    SALESMAN_MANDATORY: 'sales.salesman_mandatory',
    MAX_BILL_DISC_PERC: 'sales.max_bill_disc_perc',
    MAX_LINE_DISC_PERC: 'sales.max_line_disc_perc',
    POST_SCHEME_DISC_SEPARATELY: 'sales.post_scheme_disc_separately',
    STOCK_FROM_ANY_GODOWN: 'sales.stock_from_any_godown',
    LOYALTY_AUTO_ENROL: 'sales.loyalty_auto_enrol',
    LOYALTY_REDEEM_AS_TENDER: 'sales.loyalty_redeem_as_tender',
    DEFAULT_CUSTOMER_ID: 'sales.default_customer_id',
    RETURN_WINDOW_DAYS: 'sales.return_window_days',
    FREE_RETURN_ALLOWED: 'sales.free_return_allowed',
    TEMP_CREDIT_MAX_DAYS: 'sales.temp_credit_max_days',
    TEMP_CREDIT_MAX_AMOUNT: 'sales.temp_credit_max_amount',
    TEMP_CREDIT_BLOCK_OPEN: 'sales.temp_credit_block_open',
    POS_SERIES_PER_DEVICE: 'sales.pos_series_per_device',
    ROUND_OFF_STEP: 'sales.round_off_step',
};
function readSalesSettings(effective) {
    const by = new Map(effective.map((i) => [i.asdKey, i.value]));
    const d = exports.SALES_SETTING_DEFAULTS;
    return {
        backdateMode: pickEnum(by.get(exports.SALES_SETTING_KEYS.BACKDATE_MODE), ['ALLOW', 'WARN', 'REFUSE'], d.backdateMode),
        creditLimitMode: pickEnum(by.get(exports.SALES_SETTING_KEYS.CREDIT_LIMIT_MODE), ['OFF', 'WARN', 'REFUSE'], d.creditLimitMode),
        rateBelowMinMode: pickEnum(by.get(exports.SALES_SETTING_KEYS.RATE_BELOW_MIN_MODE), ['ALLOW', 'WARN', 'REFUSE'], d.rateBelowMinMode),
        allowExcessTender: pickBool(by.get(exports.SALES_SETTING_KEYS.ALLOW_EXCESS_TENDER), d.allowExcessTender),
        allowPostedAmend: pickBool(by.get(exports.SALES_SETTING_KEYS.ALLOW_POSTED_AMEND), d.allowPostedAmend),
        allowDuplicateItem: pickBool(by.get(exports.SALES_SETTING_KEYS.ALLOW_DUPLICATE_ITEM), d.allowDuplicateItem),
        allowBillOverOrderQty: pickBool(by.get(exports.SALES_SETTING_KEYS.ALLOW_BILL_OVER_ORDER_QTY), d.allowBillOverOrderQty),
        salesmanMandatory: pickBool(by.get(exports.SALES_SETTING_KEYS.SALESMAN_MANDATORY), d.salesmanMandatory),
        maxBillDiscPerc: pickNumber(by.get(exports.SALES_SETTING_KEYS.MAX_BILL_DISC_PERC), d.maxBillDiscPerc),
        maxLineDiscPerc: pickNumber(by.get(exports.SALES_SETTING_KEYS.MAX_LINE_DISC_PERC), d.maxLineDiscPerc),
        postSchemeDiscSeparately: pickBool(by.get(exports.SALES_SETTING_KEYS.POST_SCHEME_DISC_SEPARATELY), d.postSchemeDiscSeparately),
        stockFromAnyGodown: pickBool(by.get(exports.SALES_SETTING_KEYS.STOCK_FROM_ANY_GODOWN), d.stockFromAnyGodown),
        loyaltyAutoEnrol: pickBool(by.get(exports.SALES_SETTING_KEYS.LOYALTY_AUTO_ENROL), d.loyaltyAutoEnrol),
        loyaltyRedeemAsTender: pickBool(by.get(exports.SALES_SETTING_KEYS.LOYALTY_REDEEM_AS_TENDER), d.loyaltyRedeemAsTender),
        defaultCustomerId: pickText(by.get(exports.SALES_SETTING_KEYS.DEFAULT_CUSTOMER_ID), d.defaultCustomerId),
        returnWindowDays: pickNumber(by.get(exports.SALES_SETTING_KEYS.RETURN_WINDOW_DAYS), d.returnWindowDays),
        freeReturnAllowed: pickBool(by.get(exports.SALES_SETTING_KEYS.FREE_RETURN_ALLOWED), d.freeReturnAllowed),
        tempCreditMaxDays: pickNumber(by.get(exports.SALES_SETTING_KEYS.TEMP_CREDIT_MAX_DAYS), d.tempCreditMaxDays),
        tempCreditMaxAmount: pickNumber(by.get(exports.SALES_SETTING_KEYS.TEMP_CREDIT_MAX_AMOUNT), d.tempCreditMaxAmount),
        tempCreditBlockOpen: pickEnum(by.get(exports.SALES_SETTING_KEYS.TEMP_CREDIT_BLOCK_OPEN), ['OFF', 'WARN', 'REFUSE'], d.tempCreditBlockOpen),
        posSeriesPerDevice: pickBool(by.get(exports.SALES_SETTING_KEYS.POS_SERIES_PER_DEVICE), d.posSeriesPerDevice),
        roundOffStep: pickNumber(by.get(exports.SALES_SETTING_KEYS.ROUND_OFF_STEP), d.roundOffStep),
    };
}
function pickEnum(value, allowed, fallback) {
    const v = (value ?? '').trim().toUpperCase();
    return (allowed.includes(v) ? v : fallback);
}
function pickBool(value, fallback) {
    const v = (value ?? '').trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes')
        return true;
    if (v === 'false' || v === '0' || v === 'no')
        return false;
    return fallback;
}
function pickNumber(value, fallback) {
    const n = Number.parseFloat((value ?? '').trim());
    return Number.isFinite(n) ? n : fallback;
}
function pickText(value, fallback) {
    const v = (value ?? '').trim();
    return v.length > 0 ? v : fallback;
}
//# sourceMappingURL=sales.settings.js.map