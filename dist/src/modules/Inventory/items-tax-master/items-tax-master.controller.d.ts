import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemsTaxMasterService } from './items-tax-master.service';
import { ItemTaxPayload, ItemTaxSuccessResponse } from './types/item-tax-api.types';
export declare class ItemsTaxMasterController {
    private readonly itemsTaxMasterService;
    constructor(itemsTaxMasterService: ItemsTaxMasterService);
    save(saveItemTaxDto: SaveItemTaxDto): Promise<ItemTaxSuccessResponse<ItemTaxPayload>>;
    getById(taxId: string): Promise<ItemTaxSuccessResponse<ItemTaxPayload>>;
    remove(taxId: string): Promise<ItemTaxSuccessResponse<{
        tax_id: string;
        deleted: boolean;
    }>>;
}
