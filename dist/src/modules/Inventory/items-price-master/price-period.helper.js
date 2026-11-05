"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseToday = databaseToday;
exports.toDateColumn = toDateColumn;
exports.priceRowsInForce = priceRowsInForce;
exports.priceRowsScheduledAfter = priceRowsScheduledAfter;
async function databaseToday(client) {
    const [row] = await client.$queryRaw `
    SELECT CURRENT_DATE::text AS today
  `;
    return row.today;
}
function toDateColumn(day) {
    return new Date(`${day}T00:00:00.000Z`);
}
function priceRowsInForce(day) {
    const date = toDateColumn(day);
    return { ipmEffectiveFrom: { lte: date }, ipmEffectiveTo: { gte: date } };
}
function priceRowsScheduledAfter(day) {
    return { ipmEffectiveFrom: { gt: toDateColumn(day) } };
}
//# sourceMappingURL=price-period.helper.js.map