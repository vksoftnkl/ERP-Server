"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZERO = exports.ACC_YEAR_PATTERN = exports.ALL_BRANCHES_SENTINEL = void 0;
exports.isValidAccYear = isValidAccYear;
exports.nextAccYear = nextAccYear;
exports.previousAccYear = previousAccYear;
exports.isAccYearAfter = isAccYearAfter;
exports.signedOpening = signedOpening;
exports.signedBill = signedBill;
exports.splitSigned = splitSigned;
exports.splitSignedBill = splitSignedBill;
exports.money = money;
exports.toAmount = toAmount;
exports.toNullableAmount = toNullableAmount;
exports.toDateString = toDateString;
exports.toIsoString = toIsoString;
exports.toDateOnly = toDateOnly;
exports.isBillFrozen = isBillFrozen;
exports.settledTotal = settledTotal;
const client_1 = require("@prisma/client");
const opening_balance_enum_1 = require("./types/opening-balance-enum");
exports.ALL_BRANCHES_SENTINEL = '00000000-0000-0000-0000-000000000000';
exports.ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
exports.ZERO = new client_1.Prisma.Decimal(0);
function isValidAccYear(accYear) {
    if (!exports.ACC_YEAR_PATTERN.test(accYear)) {
        return false;
    }
    return Number(accYear.slice(5, 9)) === Number(accYear.slice(0, 4)) + 1;
}
function nextAccYear(accYear) {
    const start = Number(accYear.slice(0, 4)) + 1;
    return `${start}-${start + 1}`;
}
function previousAccYear(accYear) {
    const start = Number(accYear.slice(0, 4)) - 1;
    return `${start}-${start + 1}`;
}
function isAccYearAfter(candidate, reference) {
    return Number(candidate.slice(0, 4)) > Number(reference.slice(0, 4));
}
function signedOpening(amount, drCr) {
    const value = new client_1.Prisma.Decimal(amount);
    return drCr === opening_balance_enum_1.OpeningDrCr.DEBIT ? value : value.negated();
}
function signedBill(amount, drCr) {
    const value = new client_1.Prisma.Decimal(amount);
    return drCr === opening_balance_enum_1.BillDrCr.DEBIT ? value : value.negated();
}
function splitSigned(signed) {
    return {
        amount: signed.abs(),
        drCr: signed.isNegative() ? opening_balance_enum_1.OpeningDrCr.CREDIT : opening_balance_enum_1.OpeningDrCr.DEBIT,
    };
}
function splitSignedBill(signed) {
    return {
        amount: signed.abs(),
        drCr: signed.isNegative() ? opening_balance_enum_1.BillDrCr.CREDIT : opening_balance_enum_1.BillDrCr.DEBIT,
    };
}
function money(value) {
    return new client_1.Prisma.Decimal(value).toDecimalPlaces(2);
}
function toAmount(value) {
    if (value === null || value === undefined) {
        return 0;
    }
    return new client_1.Prisma.Decimal(value).toDecimalPlaces(2).toNumber();
}
function toNullableAmount(value) {
    return value === null || value === undefined ? null : toAmount(value);
}
function toDateString(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function toIsoString(value) {
    return value ? value.toISOString() : null;
}
function toDateOnly(value) {
    return new Date(`${value}T00:00:00.000Z`);
}
function isBillFrozen(bill) {
    return bill.ablAllocAmount.plus(bill.ablDiscAmount).plus(bill.ablWriteoffAmount).greaterThan(0);
}
function settledTotal(bill) {
    return bill.ablAllocAmount.plus(bill.ablDiscAmount).plus(bill.ablWriteoffAmount);
}
//# sourceMappingURL=opening-balance.utils.js.map