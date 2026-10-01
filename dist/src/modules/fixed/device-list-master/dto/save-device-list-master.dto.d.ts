import { DevicePlatform, DeviceType } from '../types/device-list-master-enum';
export declare class SaveDeviceListMasterDto {
    devId?: string;
    devCompanyId?: string | null;
    devBranchId?: string | null;
    devUserId?: string | null;
    devDeviceUid?: string;
    devDeviceName?: string | null;
    devDeviceType?: DeviceType;
    devPlatform?: DevicePlatform | null;
    devMacAddress?: string | null;
    devIsBlocked?: boolean;
    devBlockReason?: string | null;
    devIsActive?: boolean;
    devEntryBy?: string | null;
    devcreatedOrModifiedBy?: string | null;
}
