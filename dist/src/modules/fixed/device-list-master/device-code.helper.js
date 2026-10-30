"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVICE_CODE_PATTERN = exports.DEVICE_CODE_MAX_LENGTH = void 0;
exports.normalizeDeviceCode = normalizeDeviceCode;
exports.lockDeviceCodes = lockDeviceCodes;
exports.nextDeviceCode = nextDeviceCode;
exports.deviceCodeTaken = deviceCodeTaken;
exports.ensureDeviceCode = ensureDeviceCode;
exports.DEVICE_CODE_MAX_LENGTH = 10;
exports.DEVICE_CODE_PATTERN = /^[A-Z0-9_-]{1,10}$/;
const DEVICE_CODE_LOCK = 'fixed.device_master.dev_code';
function normalizeDeviceCode(value) {
    const trimmed = value?.trim().toUpperCase();
    return trimmed ? trimmed : null;
}
async function lockDeviceCodes(tx) {
    await tx.$queryRaw `
    SELECT count(pg_advisory_xact_lock(hashtext(${DEVICE_CODE_LOCK})))::int AS locked
  `;
}
async function nextDeviceCode(tx) {
    const [row] = await tx.$queryRaw `
    SELECT (COALESCE(MAX(substring(upper(dev_code) FROM '^D([0-9]{1,8})$')::int), 0) + 1)::int AS n
      FROM fixed.device_master
  `;
    return `D${row?.n ?? 1}`;
}
async function deviceCodeTaken(tx, code, excludeDevId) {
    const [row] = await tx.$queryRaw `
    SELECT EXISTS (
      SELECT 1 FROM fixed.device_master
       WHERE upper(dev_code) = upper(${code})
         AND (${excludeDevId ?? null}::uuid IS NULL OR dev_id <> ${excludeDevId ?? null}::uuid)
    ) AS taken
  `;
    return row?.taken === true;
}
async function ensureDeviceCode(tx, devId) {
    await lockDeviceCodes(tx);
    const [device] = await tx.$queryRaw `
    SELECT dev_code FROM fixed.device_master WHERE dev_id = ${devId}::uuid FOR UPDATE
  `;
    if (!device) {
        return null;
    }
    if (device.dev_code) {
        return device.dev_code;
    }
    const code = await nextDeviceCode(tx);
    await tx.$executeRaw `
    UPDATE fixed.device_master SET dev_code = ${code} WHERE dev_id = ${devId}::uuid
  `;
    return code;
}
//# sourceMappingURL=device-code.helper.js.map