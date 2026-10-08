"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOption = toOption;
exports.sortOptionsById = sortOptionsById;
exports.serializeLookupRow = serializeLookupRow;
exports.toDateOnly = toDateOnly;
exports.formatBilledDate = formatBilledDate;
exports.toFreightChargeOption = toFreightChargeOption;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
function toOption(id, name, options) {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const fallbackNameToId = options?.fallbackNameToId ?? true;
    return {
        id,
        name: normalizedName || (fallbackNameToId ? id : ''),
    };
}
function sortOptionsById(options) {
    return [...options].sort((left, right) => String(left.id).localeCompare(String(right.id), undefined, {
        numeric: true,
        sensitivity: 'base',
    }));
}
function serializeLookupRow(row) {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, serializeLookupValue(value)]));
}
function serializeLookupValue(value) {
    if (typeof value === 'bigint')
        return value.toString();
    if (value instanceof Date)
        return value.toISOString();
    if (Array.isArray(value))
        return value.map((item) => serializeLookupValue(item));
    if (value && typeof value === 'object') {
        const prototype = Object.getPrototypeOf(value);
        if (prototype === Object.prototype || prototype === null) {
            return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
                key,
                serializeLookupValue(nested),
            ]));
        }
    }
    return value;
}
function toDateOnly(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function formatBilledDate(billedDate) {
    if (!billedDate)
        return null;
    const now = new Date();
    const billedUtc = Date.UTC(billedDate.getUTCFullYear(), billedDate.getUTCMonth(), billedDate.getUTCDate());
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.floor((todayUtc - billedUtc) / 86_400_000);
    const dd = String(billedDate.getUTCDate()).padStart(2, '0');
    const mm = String(billedDate.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(billedDate.getUTCFullYear()).slice(-2);
    return `${days} days : ${dd}/${mm}/${yy}`;
}
function toFreightChargeOption(row) {
    return {
        id: row.frId,
        fromKm: row.frFromKm ?? null,
        toKm: row.frToKm ?? null,
        freightCharge: toNullableDecimal(row.frFreightChrg),
        fromWeight: toNullableDecimal(row.frFromWeight),
        toWeight: toNullableDecimal(row.frToWeight),
    };
}
function toNullableDecimal(value) {
    return value === null || value === undefined ? null : (0, module_service_utils_1.toNumber)(value);
}
//# sourceMappingURL=lookup-option.utils.js.map