"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECEIPT_SETTING_DEFAULTS = void 0;
exports.readReceiptSettings = readReceiptSettings;
const client_1 = require("@prisma/client");
const ppd_slab_1 = require("./ppd-slab");
const receipt_enum_1 = require("./types/receipt-enum");
exports.RECEIPT_SETTING_DEFAULTS = {
    pdcPostingMode: receipt_enum_1.PdcPostingMode.ON_RECEIPT,
    billSort: receipt_enum_1.ReceiptBillSort.DUE_DATE,
    salesmanMandatory: false,
    writeoffApprovalAbove: new client_1.Prisma.Decimal(0),
    tcsBasis: receipt_enum_1.TcsBasis.RECEIPT,
    ppdSlabs: [],
};
function readReceiptSettings(effective) {
    const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
    return {
        pdcPostingMode: pickEnum(byKey.get(receipt_enum_1.ReceiptSettingKey.PDC_POSTING_MODE), Object.values(receipt_enum_1.PdcPostingMode), exports.RECEIPT_SETTING_DEFAULTS.pdcPostingMode),
        billSort: pickEnum(byKey.get(receipt_enum_1.ReceiptSettingKey.BILL_SORT), Object.values(receipt_enum_1.ReceiptBillSort), exports.RECEIPT_SETTING_DEFAULTS.billSort),
        salesmanMandatory: pickBoolean(byKey.get(receipt_enum_1.ReceiptSettingKey.SALESMAN_MANDATORY), exports.RECEIPT_SETTING_DEFAULTS.salesmanMandatory),
        writeoffApprovalAbove: pickDecimal(byKey.get(receipt_enum_1.ReceiptSettingKey.WRITEOFF_APPROVAL_ABOVE), exports.RECEIPT_SETTING_DEFAULTS.writeoffApprovalAbove),
        tcsBasis: pickEnum(byKey.get(receipt_enum_1.ReceiptSettingKey.TCS_BASIS), Object.values(receipt_enum_1.TcsBasis), exports.RECEIPT_SETTING_DEFAULTS.tcsBasis),
        ppdSlabs: (0, ppd_slab_1.parsePpdSlabs)(byKey.get(receipt_enum_1.ReceiptSettingKey.PPD_SLABS) ?? null),
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
//# sourceMappingURL=receipt.settings.js.map