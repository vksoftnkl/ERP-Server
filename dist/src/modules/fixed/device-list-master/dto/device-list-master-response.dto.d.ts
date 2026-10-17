import { FixedErrorFieldDto, FixedErrorResponseDto, FixedListMetaDto } from "../../../../common/utils/module-response.dto";
import { DevicePlatform, DeviceType } from '../types/device-list-master-enum';
export { FixedErrorFieldDto as DeviceListMasterErrorFieldDto };
export { FixedErrorResponseDto as DeviceListMasterErrorResponseDto };
export { FixedListMetaDto as DeviceListMasterListMetaDto };
export declare class DeviceListMasterPayloadDto {
    devId: string;
    devCompanyId: string | null;
    devCompanyName?: string | null;
    devBranchId: string | null;
    devBranchName?: string | null;
    devUserId: string | null;
    devUserName?: string | null;
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
export declare class DeviceListMasterDeleteResultDto {
    devId: string;
    deleted: true;
}
export declare class DeviceListMasterSuccessSingleDto {
    success: true;
    message: string;
    data: DeviceListMasterPayloadDto;
}
export declare class DeviceListMasterSuccessListDto {
    success: true;
    message: string;
    data: DeviceListMasterPayloadDto[];
    meta: FixedListMetaDto;
}
export declare class DeviceListMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: DeviceListMasterDeleteResultDto;
}
