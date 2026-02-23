export interface DeviceListMasterErrorDetail {
  field: string;
  message: string;
}
export interface DeviceListMasterErrorResponse {
  success: false;
  message: string;
  errors: DeviceListMasterErrorDetail[];
}
export interface DeviceListMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}
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
export interface DeviceListMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
