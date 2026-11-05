"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACC_YEAR_PATTERN = exports.ZERO = void 0;
exports.isValidAccYear = isValidAccYear;
exports.money = money;
exports.sum = sum;
exports.toAmount = toAmount;
exports.toNullableAmount = toNullableAmount;
exports.toDateOnly = toDateOnly;
exports.toDateString = toDateString;
exports.toIsoString = toIsoString;
exports.todayUtc = todayUtc;
exports.daysBetween = daysBetween;
exports.daysOverdue = daysOverdue;
exports.distributeProRata = distributeProRata;
exports.asEnum = asEnum;
exports.flipSide = flipSide;
exports.trimOrNull = trimOrNull;
exports.truncate = truncate;
const client_1 = require("@prisma/client");
exports.ZERO = new client_1.Prisma.Decimal(0);
exports.ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
function isValidAccYear(accYear) {
    if (!exports.ACC_YEAR_PATTERN.test(accYear)) {
        return false;
    }
    return Number(accYear.slice(5, 9)) === Number(accYear.slice(0, 4)) + 1;
}
function money(value) {
    return new client_1.Prisma.Decimal(value).toDecimalPlaces(2);
}
function sum(values) {
    let total = exports.ZERO;
    for (const value of values) {
        total = total.plus(value);
    }
    return total.toDecimalPlaces(2);
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
function toDateOnly(value) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
function toDateString(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function toIsoString(value) {
    return value ? value.toISOString() : null;
}
function todayUtc(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}
function daysBetween(from, to) {
    const MS_PER_DAY = 86_400_000;
    return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}
function startOfDay(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}
function daysOverdue(dueDate, onDate) {
    if (!dueDate) {
        return 0;
    }
    return Math.max(0, daysBetween(dueDate, onDate));
}
function distributeProRata(total, weights) {
    const target = money(total);
    const weightTotal = sum(weights);
    if (weights.length === 0 || target.isZero() || weightTotal.isZero()) {
        return weights.map(() => exports.ZERO);
    }
    const shares = weights.map((weight) => target.times(weight).dividedBy(weightTotal).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_DOWN));
    const paisa = new client_1.Prisma.Decimal('0.01');
    let remainder = target.minus(sum(shares));
    const order = weights
        .map((weight, index) => ({
        index,
        remainder: target.times(weight).dividedBy(weightTotal).minus(shares[index]),
        weight,
    }))
        .sort((left, right) => right.remainder.comparedTo(left.remainder) ||
        right.weight.comparedTo(left.weight) ||
        left.index - right.index);
    for (const entry of order) {
        if (remainder.lessThanOrEqualTo(0)) {
            break;
        }
        shares[entry.index] = shares[entry.index].plus(paisa);
        remainder = remainder.minus(paisa);
    }
    return shares;
}
function asEnum(value, allowed, fallback) {
    return value !== null && value !== undefined && allowed.includes(value)
        ? value
        : fallback;
}
function flipSide(value, dr, cr) {
    return value === dr ? cr : dr;
}
function trimOrNull(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function truncate(value, maxLength) {
    if (value === null) {
        return null;
    }
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}
//# sourceMappingURL=receipt.utils.js.map