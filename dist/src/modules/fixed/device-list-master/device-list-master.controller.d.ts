import { ListDeviceListMasterQueryDto } from './dto/list-device-list-master-query.dto';
import { SaveDeviceListMasterDto } from './dto/save-device-list-master.dto';
import { DeviceListMasterService } from './device-list-master.service';
import { DeviceListMasterListItem, DeviceListMasterListMeta, DeviceListMasterPayload, DeviceListMasterSuccessResponse } from './types/device-list-master-api.types';
export declare class DeviceListMasterController {
    private readonly deviceListMasterService;
    constructor(deviceListMasterService: DeviceListMasterService);
    save(saveDeviceListMasterDto: SaveDeviceListMasterDto): Promise<DeviceListMasterSuccessResponse<DeviceListMasterPayload>>;
    list(queryDto: ListDeviceListMasterQueryDto): Promise<DeviceListMasterSuccessResponse<DeviceListMasterListItem[], DeviceListMasterListMeta>>;
    getById(devId: string): Promise<DeviceListMasterSuccessResponse<DeviceListMasterPayload>>;
    remove(devId: string): Promise<DeviceListMasterSuccessResponse<{
        devId: string;
        deleted: true;
    }>>;
}
