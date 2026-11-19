import type { DeviceMaster } from '@prisma/client';
import { deviceDisplayName } from '../../audit-log/audit-log.service';

/**
 * Review list 11-19 step 3 (239.9): what a device's audit row is, for the Devices screen
 * and for the desktop login that moves a device to the signed-in user's company / branch.
 * The 'Device List Master' label map (audit-screen-sql.constants.ts) picks the fields and
 * shows Company / Branch / User by name; the per-login touch (last login, IP) is left out.
 */
export const DEVICE_AUDIT_SCREEN_NAME = 'Device List Master';
export const DEVICE_AUDIT_TABLE_NAME = 'erp device master';

type DeviceAuditFields = Pick<
  DeviceMaster,
  | 'devId'
  | 'devCompanyId'
  | 'devBranchId'
  | 'devUserId'
  | 'devDeviceUid'
  | 'devDeviceName'
  | 'devCode'
  | 'devDeviceType'
  | 'devPlatform'
  | 'devMacAddress'
  | 'devIsBlocked'
  | 'devBlockReason'
  | 'devIsActive'
  | 'devIsDeleted'
  | 'devCreatedOn'
  | 'devCreatedBy'
>;

export function toDeviceAuditRecord(record: DeviceAuditFields): Record<string, unknown> {
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

/** The history's name for a device: its name, else its code, never the uid unless that is all. */
export function deviceAuditDisplayName(
  record: Pick<DeviceMaster, 'devDeviceName' | 'devCode' | 'devDeviceUid'>,
): string {
  return deviceDisplayName(record);
}

/**
 * The row's note for a save: "Device updated" plus the state changes a reader looks for.
 * Block / unblock and active / inactive are fields of the save (no separate route).
 */
export function deviceSaveNotes(
  base: string,
  before: Pick<DeviceMaster, 'devIsBlocked' | 'devBlockReason' | 'devIsActive'>,
  after: Pick<DeviceMaster, 'devIsBlocked' | 'devBlockReason' | 'devIsActive'>,
): string {
  const notes = [base];
  if (!before.devIsBlocked && after.devIsBlocked) {
    const reason = after.devBlockReason?.trim();
    notes.push(reason ? `device blocked: ${reason}` : 'device blocked');
  } else if (before.devIsBlocked && !after.devIsBlocked) {
    notes.push('device unblocked');
  }
  if (before.devIsActive && !after.devIsActive) {
    notes.push('device made inactive');
  } else if (!before.devIsActive && after.devIsActive) {
    notes.push('device made active');
  }
  return notes.join('; ');
}
