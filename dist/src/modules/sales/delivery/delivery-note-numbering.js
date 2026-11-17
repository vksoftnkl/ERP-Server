"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateDeliveryNoteNumber = allocateDeliveryNoteNumber;
exports.deliveryNoteRefno = deliveryNoteRefno;
const stock_voucher_numbering_helper_1 = require("../../stocks/stock-voucher/stock-voucher-numbering.helper");
const delivery_constants_1 = require("./core/delivery.constants");
async function allocateDeliveryNoteNumber(tx, q) {
    const devCode = await (0, stock_voucher_numbering_helper_1.resolveDeviceCode)(tx, q.deviceId);
    const lockKey = [delivery_constants_1.DELIVERY_NOTE_NUMBER_PREFIX, q.companyId, q.branchId, q.accYear, q.deviceId].join('|');
    await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext('delivery_note_no'), hashtext(${lockKey})))::int AS locked`;
    const [r] = await tx.$queryRaw `
    SELECT COALESCE(MAX(sdn_slno), 0) + 1 AS n FROM sales.sale_delivery_note
     WHERE sdn_company_id = ${q.companyId}::uuid AND sdn_branch_id = ${q.branchId}::uuid
       AND sdn_acc_year = ${q.accYear}::char(9) AND sdn_device_id = ${q.deviceId}`;
    const lastNo = BigInt(r?.n ?? 1);
    return {
        lastNo,
        refno: deliveryNoteRefno(q.accYear, devCode, lastNo),
        deviceCode: devCode,
    };
}
function deliveryNoteRefno(accYear, deviceCode, slno) {
    return [
        delivery_constants_1.DELIVERY_NOTE_NUMBER_PREFIX,
        accYear.trim(),
        deviceCode,
        slno.toString().padStart(5, '0'),
    ].join('/');
}
//# sourceMappingURL=delivery-note-numbering.js.map