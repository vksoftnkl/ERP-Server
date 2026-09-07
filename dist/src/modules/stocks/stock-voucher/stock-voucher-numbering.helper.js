"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDeviceCode = resolveDeviceCode;
exports.nextStockVoucherSlno = nextStockVoucherSlno;
exports.buildStockVoucherRefno = buildStockVoucherRefno;
exports.allocateStockVoucherNumber = allocateStockVoucherNumber;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const SLNO_LOCK_NAMESPACE = 'stock.stock_voucher.slno';
const REFNO_MAX_LENGTH = 100;
async function resolveDeviceCode(tx, deviceId) {
    const device = await tx.deviceMaster.findFirst({
        where: { devId: deviceId, devIsDeleted: false },
        select: {
            devDeviceUid: true,
            devDeviceName: true,
            devIsActive: true,
            devIsBlocked: true,
            devBlockReason: true,
        },
    });
    if (!device) {
        (0, module_service_utils_1.throwStockNotFound)('Device not found', 'deviceId', `No device master row ${deviceId}. svh_device_id is NOT NULL and the device is the number series — register the device before raising documents on it.`);
    }
    if (device.devIsBlocked || !device.devIsActive) {
        (0, module_service_utils_1.throwStockNotFound)('Device unavailable', 'deviceId', device.devBlockReason?.trim()
            ? `Device ${deviceId} is blocked: ${device.devBlockReason.trim()}`
            : `Device ${deviceId} is blocked or inactive.`);
    }
    const code = device.devDeviceUid?.trim() || device.devDeviceName?.trim();
    return code || deviceId;
}
async function lockSlnoScope(tx, scope) {
    const lockKey = [
        scope.companyId,
        scope.branchId,
        scope.accYear,
        scope.voucherType,
        scope.deviceId,
    ].join('|');
    await tx.$queryRaw `
    WITH advisory_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtext(${SLNO_LOCK_NAMESPACE}),
        hashtext(${lockKey})
      )
    )
    SELECT 1::int AS locked
  `;
}
async function nextStockVoucherSlno(tx, scope) {
    await lockSlnoScope(tx, scope);
    const rows = await tx.$queryRaw `
    SELECT COALESCE(MAX(svh_slno), 0) + 1 AS next_slno
    FROM stock.stock_voucher
    WHERE svh_company_id  = ${scope.companyId}::uuid
      AND svh_branch_id   = ${scope.branchId}::uuid
      AND svh_acc_year    = ${scope.accYear}::bpchar
      AND svh_voucher_type = ${scope.voucherType}
      AND svh_device_id   = ${scope.deviceId}::uuid
  `;
    return rows[0]?.next_slno ?? BigInt(1);
}
function buildStockVoucherRefno(typeCode, accYear, deviceCode, slno) {
    const refno = [typeCode, accYear.trim(), deviceCode, slno.toString()].join('/');
    if (refno.length > REFNO_MAX_LENGTH) {
        throw new Error(`Generated stock voucher reference "${refno}" exceeds ${REFNO_MAX_LENGTH} characters. Shorten the device code on device_master.`);
    }
    return refno;
}
async function allocateStockVoucherNumber(tx, scope, typeCode, supplied = {}) {
    const suppliedRefno = supplied.refno?.trim() || null;
    const suppliedSlno = supplied.slno === undefined || supplied.slno === null || supplied.slno === ''
        ? null
        : BigInt(supplied.slno);
    if (suppliedSlno !== null && suppliedRefno !== null) {
        return { slno: suppliedSlno, refno: suppliedRefno };
    }
    const slno = suppliedSlno ?? (await nextStockVoucherSlno(tx, scope));
    if (suppliedRefno !== null) {
        return { slno, refno: suppliedRefno };
    }
    const deviceCode = await resolveDeviceCode(tx, scope.deviceId);
    return { slno, refno: buildStockVoucherRefno(typeCode, scope.accYear, deviceCode, slno) };
}
//# sourceMappingURL=stock-voucher-numbering.helper.js.map