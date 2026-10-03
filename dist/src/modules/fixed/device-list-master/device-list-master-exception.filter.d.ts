import { FixedExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { DeviceListMasterErrorDetail, DeviceListMasterErrorResponse } from './types/device-list-master-api.types';
export declare class DeviceListMasterExceptionFilter extends FixedExceptionFilter<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse> {
    constructor();
}
