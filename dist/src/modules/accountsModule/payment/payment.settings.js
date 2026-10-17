"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_SETTING_DEFAULTS = void 0;
exports.readPaymentSettings = readPaymentSettings;
const client_1 = require("@prisma/client");
const payment_enum_1 = require("./types/payment-enum");
exports.PAYMENT_SETTING_DEFAULTS = {
    pdcPostingMode: payment_enum_1.PdcPostingMode.ON_RECEIPT,
    billSort: payment_enum_1.ReceiptBillSort.DUE_DATE,
    salesmanMandatory: false,
    writeoffApprovalAbove: new client_1.Prisma.Decimal(0),
    allowPostedAmend: false,
};
function readPaymentSettings(effective) {
    const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
    return {
        pdcPostingMode: pickEnum(byKey.get(payment_enum_1.PaymentSettingKey.PDC_POSTING_MODE), Object.values(payment_enum_1.PdcPostingMode), exports.PAYMENT_SETTING_DEFAULTS.pdcPostingMode),
        billSort: pickEnum(byKey.get(payment_enum_1.PaymentSettingKey.BILL_SORT), Object.values(payment_enum_1.ReceiptBillSort), exports.PAYMENT_SETTING_DEFAULTS.billSort),
        salesmanMandatory: pickBoolean(byKey.get(payment_enum_1.PaymentSettingKey.SALESMAN_MANDATORY), exports.PAYMENT_SETTING_DEFAULTS.salesmanMandatory),
        writeoffApprovalAbove: pickDecimal(byKey.get(payment_enum_1.PaymentSettingKey.WRITEOFF_APPROVAL_ABOVE), exports.PAYMENT_SETTING_DEFAULTS.writeoffApprovalAbove),
        allowPostedAmend: pickBoolean(byKey.get(payment_enum_1.PaymentSettingKey.ALLOW_POSTED_AMEND), exports.PAYMENT_SETTING_DEFAULTS.allowPostedAmend),
    };
}
function pickEnum(value, allowed, fallback) {
    const token = value?.trim().toUpperCase();
    return token && allowed.includes(token) ? token : fallback;
}
function pickBoolean(value, fallback) {
    const token = value?.trim().toLowerCase();
    if (token === undefined || token === '') {
        return fallback;
    }
    if (['true', '1', 'yes', 'y', 'on'].includes(token)) {
        return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(token)) {
        return false;
    }
    return fallback;
}
function pickDecimal(value, fallback) {
    const token = value?.trim();
    if (!token) {
        return fallback;
    }
    try {
        const parsed = new client_1.Prisma.Decimal(token);
        return parsed.isNegative() || !parsed.isFinite() ? fallback : parsed;
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=payment.settings.js.map