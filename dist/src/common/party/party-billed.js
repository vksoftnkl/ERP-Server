"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lastBilledOf = lastBilledOf;
async function lastBilledOf(client, cusId) {
    const rows = await client.$queryRaw `
    SELECT max(sb_bill_date) AS d, count(*)::int AS n
      FROM sales.sale_bill
     WHERE sb_cust_id = ${cusId}::uuid
       AND sb_status = 'POSTED'
       AND sb_is_deleted = false`;
    const row = rows[0];
    return { date: row?.d ?? null, count: Number(row?.n ?? 0) };
}
//# sourceMappingURL=party-billed.js.map