import { GetItemGstUnitQueryDto } from './dto/get-item-gst-unit-query.dto';
import { ItemsGstUnitsMasterService } from './items-gst-units-master.service';
import { ItemGstUnitPayload, ItemGstUnitSuccessResponse } from './types/item-gst-unit-api.types';
export declare class ItemsGstUnitsMasterController {
    private readonly itemsGstUnitsMasterService;
    constructor(itemsGstUnitsMasterService: ItemsGstUnitsMasterService);
    list(queryDto: GetItemGstUnitQueryDto): Promise<ItemGstUnitSuccessResponse<ItemGstUnitPayload[]>>;
}
