"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVICE_AUDIT_TABLE_NAME = exports.DEVICE_AUDIT_SCREEN_NAME = void 0;
exports.toDeviceAuditRecord = toDeviceAuditRecord;
exports.deviceAuditDisplayName = deviceAuditDisplayName;
exports.deviceSaveNotes = deviceSaveNotes;
const audit_log_service_1 = require("../../audit-log/audit-log.service");
exports.DEVICE_AUDIT_SCREEN_NAME = 'Device List Master';
exports.DEVICE_AUDIT_TABLE_NAME = 'erp device master';
function toDeviceAuditRecord(record) {
    return {
        devId: record.devId,
        devDeviceName: record.devDeviceName,
        devCode: record.devCode,
        devDeviceUid: record.devDeviceUid,
        devDeviceType: record.devDeviceType,
        devPlatform: record.devPlatform,
        devCompanyId: record.devCompanyId,
        devBranchId: record.devBranchId,
        devUserId: record.devUserId,
        devMacAddress: record.devMacAddress,
        devIsBlocked: record.devIsBlocked,
        devBlockReason: record.devBlockReason,
        devIsActive: record.devIsActive,
        devIsDeleted: record.devIsDeleted,
        devCreatedOn: record.devCreatedOn.toISOString(),
        devCreatedBy: record.devCreatedBy,
    };
}
function deviceAuditDisplayName(record) {
    return (0, audit_log_service_1.deviceDisplayName)(record);
}
function deviceSaveNotes(base, before, after) {
    const notes = [base];
    if (!before.devIsBlocked && after.devIsBlocked) {
        const reason = after.devBlockReason?.trim();
        notes.push(reason ? `device blocked: ${reason}` : 'device blocked');
    }
    else if (before.devIsBlocked && !after.devIsBlocked) {
        notes.push('device unblocked');
    }
    if (before.devIsActive && !after.devIsActive) {
        notes.push('device made inactive');
    }
    else if (!before.devIsActive && after.devIsActive) {
        notes.push('device made active');
    }
    return notes.join('; ');
}
//# sourceMappingURL=device-audit.helper.js.map