"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDeviceCode = resolveDeviceCode;
exports.nextStockVoucherSlno = nextStockVoucherSlno;
exports.buildStockVoucherRefno = buildStockVoucherRefno;
exports.allocateStockVoucherNumber = allocateStockVoucherNumber;
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const device_code_helper_1 = require("../../fixed/device-list-master/device-code.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_error_codes_1 = require("../types/stock-error-codes");
const SLNO_LOCK_NAMESPACE = 'stock.stock_voucher.slno';
const REFNO_MAX_LENGTH = 100;
async function resolveDeviceCode(tx, deviceId) {
    const device = await tx.deviceMaster.findFirst({
        where: { devId: deviceId, devIsDeleted: false },
        select: {
            devCode: true,
            devIsActive: true,
            devIsBlocked: true,
            devBlockReason: true,
        },
    });
    if (!device) {
        (0, module_service_utils_1.throwStockNotFound)('Device not found', 'deviceId', `No device master row ${deviceId}. svh_device_id is NOT NULL and the device is the number series — register the device before raising documents on it.`, stock_error_codes_1.StockErrorCode.DEVICE_NOT_FOUND);
    }
    if (device.devIsBlocked || !device.devIsActive) {
        (0, module_service_utils_1.throwStockNotFound)('Device unavailable', 'deviceId', device.devBlockReason?.trim()
            ? `Device ${deviceId} is blocked: ${device.devBlockReason.trim()}`
            : `Device ${deviceId} is blocked or inactive.`, stock_error_codes_1.StockErrorCode.DEVICE_BLOCKED);
    }
    return device.devCode?.trim() || (await (0, device_code_helper_1.ensureDeviceCode)(tx, deviceId));
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
    SELECT count(pg_advisory_xact_lock(
             hashtext(${SLNO_LOCK_NAMESPACE}),
             hashtext(${lockKey})
           ))::int AS locked
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
const REFNO_SLNO_DIGITS = 5;
function buildStockVoucherRefno(typeCode, accYear, deviceCode, slno) {
    const refno = [
        typeCode,
        accYear.trim(),
        deviceCode,
        slno.toString().padStart(REFNO_SLNO_DIGITS, '0'),
    ].join('/');
    if (refno.length > REFNO_MAX_LENGTH) {
        throw new Error(`Generated stock voucher reference "${refno}" exceeds ${REFNO_MAX_LENGTH} characters. Shorten the device code on device_master.`);
    }
    return refno;
}
async function allocateStockVoucherNumber(tx, scope, typeCode, supplied = {}, refnoVchrTypeId) {
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
    if (refnoVchrTypeId !== undefined) {
        return { slno, refno: await nextAccountsRefno(tx, scope, refnoVchrTypeId) };
    }
    const deviceCode = await resolveDeviceCode(tx, scope.deviceId);
    return { slno, refno: buildStockVoucherRefno(typeCode, scope.accYear, deviceCode, slno) };
}
async function nextAccountsRefno(tx, scope, vchrTypeId) {
    await resolveDeviceCode(tx, scope.deviceId);
    for (let attempt = 0; attempt < MAX_TAKEN_REFNO_SKIPS; attempt += 1) {
        const { refno } = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
            vchrTypeId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
        });
        const [taken] = await tx.$queryRaw `
      SELECT EXISTS (
        SELECT 1
          FROM stock.stock_voucher
         WHERE svh_acc_year   = ${scope.accYear}::bpchar
           AND svh_company_id = ${scope.companyId}::uuid
           AND svh_branch_id  = ${scope.branchId}::uuid
           AND svh_refno      = ${refno}
           AND svh_is_deleted = false
      ) AS taken`;
        if (!taken?.taken) {
            return refno;
        }
    }
    (0, module_service_utils_1.throwStockConflict)('No free voucher number', [
        {
            field: 'refno',
            code: stock_error_codes_1.StockErrorCode.REFNO_SERIES_EXHAUSTED,
            message: `The next ${MAX_TAKEN_REFNO_SKIPS} numbers of this series are all on documents already. Move the series past them (Voucher Sequence) and save again.`,
        },
    ]);
}
const MAX_TAKEN_REFNO_SKIPS = 1000;
//# sourceMappingURL=stock-voucher-numbering.helper.js.map