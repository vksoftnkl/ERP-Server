import { ListItemCustRateQueryDto } from './dto/list-item-cust-rate-query.dto';
import { SaveItemCustRateDto } from './dto/save-item-cust-rate.dto';
import { ItemsCustRatesMasterService } from './items-cust-rates-master.service';
import { ItemCustRateListItem, ItemCustRateListMeta, ItemCustRatePayload, ItemCustRateSuccessResponse } from './types/item-cust-rate-api.types';
export declare class ItemsCustRatesMasterController {
    private readonly itemsCustRatesMasterService;
    constructor(itemsCustRatesMasterService: ItemsCustRatesMasterService);
    save(saveItemCustRateDto: SaveItemCustRateDto): Promise<ItemCustRateSuccessResponse<ItemCustRatePayload>>;
    list(queryDto: ListItemCustRateQueryDto): Promise<ItemCustRateSuccessResponse<ItemCustRateListItem[], ItemCustRateListMeta>>;
    getById(csrId: string): Promise<ItemCustRateSuccessResponse<ItemCustRatePayload>>;
    remove(csrId: string): Promise<ItemCustRateSuccessResponse<{
        csr_id: string;
        deleted: true;
    }>>;
}
