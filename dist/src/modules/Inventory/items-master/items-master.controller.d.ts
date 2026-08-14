import { SaveItemCompositeDto } from './dto/save-item-composite.dto';
import { ItemsMasterService } from './items-master.service';
import { BulkLoadItemPayload, ItemSuccessResponse } from './types/item-api.types';
import { ItemCompositeDeleteResult, ItemCompositePayload } from './types/item-composite-api.types';
export declare class ItemsMasterController {
    private readonly itemsMasterService;
    constructor(itemsMasterService: ItemsMasterService);
    save(saveItemDto: SaveItemCompositeDto): Promise<ItemSuccessResponse<ItemCompositePayload>>;
    getById(itemId: string): Promise<ItemSuccessResponse<ItemCompositePayload>>;
    bulkLoad(itemCompanyId?: string, itemBranchId?: string, godownId?: string, itemGroupId?: string, itemBrandId?: string, itemSectionId?: string, itemCategoryId?: string, limit?: number, uiTableId?: string, uiColumnId?: string): Promise<ItemSuccessResponse<BulkLoadItemPayload[]>>;
    remove(itemId: string): Promise<ItemSuccessResponse<ItemCompositeDeleteResult>>;
}
