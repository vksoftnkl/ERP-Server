"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countedLegsSql = countedLegsSql;
exports.openingSetSql = openingSetSql;
exports.openingNoteSql = openingNoteSql;
exports.createdByJoinSql = createdByJoinSql;
exports.money = money;
exports.sided = sided;
exports.isoDate = isoDate;
const client_1 = require("@prisma/client");
function ledgerSql(column, filter) {
    if (filter === null) {
        return client_1.Prisma.sql `true`;
    }
    if ('ledgerId' in filter) {
        return client_1.Prisma.sql `${client_1.Prisma.raw(column)} = ${filter.ledgerId}::uuid`;
    }
    return client_1.Prisma.sql `${client_1.Prisma.raw(column)} = ANY(${[...filter.ledgerIds]}::uuid[])`;
}
function countedLegsSql(scope, opts) {
    return client_1.Prisma.sql `
      SELECT v.av_voucher_id, v.av_acc_year, v.av_voucher_date, v.av_voucher_type_id,
             v.av_branch_id, v.av_ledger_id, v.av_dr_cr, v.av_amount, v.av_signed_amount
        FROM accounts.acc_vouchers v
        JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
       WHERE v.av_company_id = ${scope.companyId}::uuid
         AND ${ledgerSql('v.av_ledger_id', opts.ledgers)}
         AND v.av_acc_year   = ${scope.accYear}::char(9)
         ${opts.from ? client_1.Prisma.sql `AND v.av_voucher_date >= ${opts.from}::date` : client_1.Prisma.empty}
         AND v.av_voucher_date <= ${opts.upTo}::date
         AND v.av_is_deleted = false
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
         AND (${scope.branchId}::uuid IS NULL OR v.av_branch_id = ${scope.branchId}::uuid)`;
}
function openingSetSql(scope, ledgers) {
    return client_1.Prisma.sql `
      SELECT o.op_ledger_id AS ledger_id,
             SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END) AS amt
        FROM accounts.acc_opening_balance o
       WHERE o.op_company_id = ${scope.companyId}::uuid
         AND ${ledgerSql('o.op_ledger_id', ledgers)}
         AND o.op_acc_year   = ${scope.accYear}::char(9)
         AND o.op_is_deleted = false
         AND (${scope.branchId}::uuid IS NULL OR o.op_branch_id = ${scope.branchId}::uuid)
       GROUP BY o.op_ledger_id`;
}
function openingNoteSql(scope, ledgers) {
    return client_1.Prisma.sql `
      SELECT o.op_ledger_id AS ledger_id,
             COUNT(*) FILTER (WHERE o.op_branch_id = ${scope.branchId}::uuid) AS branch_rows,
             COUNT(*) FILTER (WHERE o.op_branch_id IS NULL AND o.op_amount <> 0) AS company_rows
        FROM accounts.acc_opening_balance o
       WHERE o.op_company_id = ${scope.companyId}::uuid
         AND ${ledgerSql('o.op_ledger_id', ledgers)}
         AND o.op_acc_year   = ${scope.accYear}::char(9)
         AND o.op_is_deleted = false
       GROUP BY o.op_ledger_id`;
}
function createdByJoinSql(column, alias) {
    const col = client_1.Prisma.raw(column);
    return client_1.Prisma.sql `
        LEFT JOIN public.user_master ${client_1.Prisma.raw(alias)}
          ON ${client_1.Prisma.raw(alias)}.usr_id =
             CASE WHEN ${col} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  THEN ${col}::uuid END`;
}
function money(value) {
    return new client_1.Prisma.Decimal(value ?? 0).toFixed(2);
}
function sided(value) {
    const d = new client_1.Prisma.Decimal(value ?? 0);
    return { amount: d.abs().toFixed(2), side: d.isNegative() ? 'CR' : 'DR' };
}
function isoDate(value) {
    return value.toISOString().slice(0, 10);
}
//# sourceMappingURL=voucher-books.sql.js.map