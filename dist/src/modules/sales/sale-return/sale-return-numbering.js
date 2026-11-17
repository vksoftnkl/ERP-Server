"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALE_RETURN_NUMBER_PREFIX = void 0;
exports.allocateSaleReturnNumber = allocateSaleReturnNumber;
const stock_voucher_numbering_helper_1 = require("../../stocks/stock-voucher/stock-voucher-numbering.helper");
exports.SALE_RETURN_NUMBER_PREFIX = 'SRT';
async function allocateSaleReturnNumber(tx, q) {
    const devCode = await (0, stock_voucher_numbering_helper_1.resolveDeviceCode)(tx, q.deviceId);
    const lockKey = [exports.SALE_RETURN_NUMBER_PREFIX, q.companyId, q.branchId, q.accYear, q.deviceId].join('|');
    await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext('sale_return_no'), hashtext(${lockKey})))::int AS locked`;
    const [r] = await tx.$queryRaw `
    SELECT COALESCE(MAX(sr_return_slno), 0) + 1 AS n FROM sales.sale_return
     WHERE sr_company_id = ${q.companyId}::uuid AND sr_branch_id = ${q.branchId}::uuid
       AND sr_acc_year = ${q.accYear}::char(9) AND sr_device_id = ${q.deviceId}`;
    const lastNo = BigInt(r?.n ?? 1);
    return {
        lastNo,
        refno: [
            exports.SALE_RETURN_NUMBER_PREFIX,
            q.accYear.trim(),
            devCode,
            lastNo.toString().padStart(5, '0'),
        ].join('/'),
    };
}
//# sourceMappingURL=sale-return-numbering.js.map