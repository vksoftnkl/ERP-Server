import type { DevicePlatform, DeviceType } from './device-list-master-enum';

export type { FixedErrorDetail as DeviceListMasterErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as DeviceListMasterErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as DeviceListMasterSuccessResponse } from 'src/common/types/module-api.types';
export type { FixedListMeta as DeviceListMasterListMeta } from 'src/common/types/module-list.types';
export interface DeviceListMasterPayload {
  devId: string;
  devCompanyId: string | null;
  devBranchId: string | null;
  devUserId: string | null;
  devDeviceUid: string;
  devDeviceName: string | null;
  devDeviceType: DeviceType;
  devPlatform: DevicePlatform | null;
  devMacAddress: string | null;
  devIsBlocked: boolean;
  devBlockReason: string | null;
  devLastIp: string | null;
  devIsActive: boolean;
  devIsDeleted: boolean;
  devSyncDate: string | null;
  devCreatedOn: string;
  devCreatedBy: string | null;
  devModifiedOn: string | null;
  devModifiedBy: string | null;
}
export type DeviceListMasterListItem = DeviceListMasterPayload | Record<string, unknown>;
