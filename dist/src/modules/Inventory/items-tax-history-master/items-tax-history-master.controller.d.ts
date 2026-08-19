import { SaveItemTaxHistoryDto } from './dto/save-item-tax-history.dto';
import { ItemsTaxHistoryMasterService } from './items-tax-history-master.service';
import { ItemTaxHistoryPayload, ItemTaxHistorySuccessResponse } from './types/item-tax-history-api.types';
export declare class ItemsTaxHistoryMasterController {
    private readonly itemsTaxHistoryMasterService;
    constructor(itemsTaxHistoryMasterService: ItemsTaxHistoryMasterService);
    save(saveItemTaxHistoryDto: SaveItemTaxHistoryDto): Promise<ItemTaxHistorySuccessResponse<ItemTaxHistoryPayload>>;
    getById(ithId: string): Promise<ItemTaxHistorySuccessResponse<ItemTaxHistoryPayload>>;
    remove(ithId: string): Promise<ItemTaxHistorySuccessResponse<{
        ith_id: string;
        deleted: true;
    }>>;
}
