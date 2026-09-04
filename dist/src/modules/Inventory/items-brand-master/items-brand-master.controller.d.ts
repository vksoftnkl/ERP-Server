import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemsBrandMasterService } from './items-brand-master.service';
import { ItemBrandPayload, ItemBrandSuccessResponse } from './types/item-brand-api.types';
type UploadedPhotoFile = {
    buffer: Buffer;
};
export declare class ItemsBrandMasterController {
    private readonly itemsBrandMasterService;
    constructor(itemsBrandMasterService: ItemsBrandMasterService);
    save(saveItemBrandDto: SaveItemBrandDto, brandPhotoFile?: UploadedPhotoFile): Promise<ItemBrandSuccessResponse<ItemBrandPayload>>;
    getById(brandId: string): Promise<ItemBrandSuccessResponse<ItemBrandPayload>>;
    remove(brandId: string): Promise<ItemBrandSuccessResponse<{
        brand_id: string;
        deleted: boolean;
    }>>;
    private withUploadedPhoto;
}
export {};
