"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessDateNow = businessDateNow;
exports.businessDateAt = businessDateAt;
exports.accYearOf = accYearOf;
exports.isoDateOf = isoDateOf;
exports.dateParam = dateParam;
exports.sessionNumber = sessionNumber;
exports.assertTillPartitions = assertTillPartitions;
const till_errors_1 = require("./till-errors");
const till_enum_1 = require("./types/till-enum");
async function businessDateNow(client, cutoff) {
    const [row] = await client.$queryRaw `
    SELECT to_char(now() - ${`${cutoff}:00`}::interval, 'YYYY-MM-DD') AS d`;
    return row.d;
}
async function businessDateAt(client, at, cutoff) {
    const [row] = await client.$queryRaw `
    SELECT to_char(${at}::timestamptz - ${`${cutoff}:00`}::interval, 'YYYY-MM-DD') AS d`;
    return row.d;
}
function accYearOf(isoDate) {
    const [year, month] = isoDate.split('-').map(Number);
    const start = month < 4 ? year - 1 : year;
    return `${start}-${start + 1}`;
}
function isoDateOf(value) {
    return value.toISOString().slice(0, 10);
}
function dateParam(isoDate) {
    return new Date(`${isoDate}T00:00:00.000Z`);
}
function sessionNumber(counterCode, isoDate, daySeq) {
    const [y, m, d] = isoDate.split('-');
    return `${counterCode.toUpperCase()}-${y.slice(2)}${m}${d}-${String(daySeq).padStart(2, '0')}`;
}
async function assertTillPartitions(client, accYear, field) {
    const suffix = accYear.replace('-', '_');
    const [row] = await client.$queryRaw `
    SELECT count(*)::int AS present
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'accounts'
       AND c.relname IN (${`till_business_day_${suffix}`}, ${`till_session_${suffix}`},
                         ${`acc_voucher_header_${suffix}`})`;
    if ((row?.present ?? 0) < 3) {
        (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.YEAR_NOT_SET_UP, `${accYear} has no till / voucher partitions. Run SELECT public.ensure_acc_year_partitions('${accYear}'); and try again.`, field);
    }
}
//# sourceMappingURL=till-dates.js.map