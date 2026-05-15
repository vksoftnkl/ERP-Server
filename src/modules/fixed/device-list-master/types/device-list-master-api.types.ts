export type { FixedErrorDetail as DeviceListMasterErrorDetail } from '../../utils/fixed-api.types';
export type { FixedErrorResponse as DeviceListMasterErrorResponse } from '../../utils/fixed-api.types';
export type { FixedSuccessResponse as DeviceListMasterSuccessResponse } from '../../utils/fixed-api.types';
export type { FixedListMeta as DeviceListMasterListMeta } from '../../utils/fixed-list.utils';

export interface DeviceListMasterPayload {
  devId: string;
  devCompanyId: string | null;
  devBranchId: string | null;
  devUserId: string | null;
  devDeviceUid: string;
  devDeviceName: string | null;
  devDeviceType: string;
  devPlatform: string | null;
  devOsVersion: string | null;
  devAppVersion: string | null;
  devSerialNo: string | null;
  devImei: string | null;
  devMacAddress: string | null;
  devProductKey: string | null;
  devIsAllowed: boolean;
  devIsBlocked: boolean;
  devAllowReason: string | null;
  devBlockReason: string | null;
  devLastSeenOn: string | null;
  devLastIp: string | null;
  devLastLoginOn: string | null;
  devIsActive: boolean;
  devIsDeleted: boolean;
  devSyncDate: string | null;
  devCreatedOn: string;
  devCreatedBy: string | null;
  devModifiedOn: string;
  devModifiedBy: string | null;
}

export type DeviceListMasterListItem = DeviceListMasterPayload | Record<string, unknown>;
