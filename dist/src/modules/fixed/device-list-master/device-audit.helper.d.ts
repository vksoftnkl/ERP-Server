import type { DeviceMaster } from '@prisma/client';
export declare const DEVICE_AUDIT_SCREEN_NAME = "Device List Master";
export declare const DEVICE_AUDIT_TABLE_NAME = "erp device master";
type DeviceAuditFields = Pick<DeviceMaster, 'devId' | 'devCompanyId' | 'devBranchId' | 'devUserId' | 'devDeviceUid' | 'devDeviceName' | 'devCode' | 'devDeviceType' | 'devPlatform' | 'devMacAddress' | 'devIsBlocked' | 'devBlockReason' | 'devIsActive' | 'devIsDeleted' | 'devCreatedOn' | 'devCreatedBy'>;
export declare function toDeviceAuditRecord(record: DeviceAuditFields): Record<string, unknown>;
export declare function deviceAuditDisplayName(record: Pick<DeviceMaster, 'devDeviceName' | 'devCode' | 'devDeviceUid'>): string;
export declare function deviceSaveNotes(base: string, before: Pick<DeviceMaster, 'devIsBlocked' | 'devBlockReason' | 'devIsActive'>, after: Pick<DeviceMaster, 'devIsBlocked' | 'devBlockReason' | 'devIsActive'>): string;
export {};
