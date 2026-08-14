import { ListItemBrandQueryDto } from './dto/list-item-brand-query.dto';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemsBrandMasterService } from './items-brand-master.service';
import { ItemBrandListMeta, ItemBrandPayload, ItemBrandSuccessResponse } from './types/item-brand-api.types';
type UploadedPhotoFile = {
    buffer: Buffer;
};
export declare class ItemsBrandMasterController {
    private readonly itemsBrandMasterService;
    constructor(itemsBrandMasterService: ItemsBrandMasterService);
    save(saveItemBrandDto: SaveItemBrandDto, brandPhotoFile?: UploadedPhotoFile): Promise<ItemBrandSuccessResponse<ItemBrandPayload>>;
    list(queryDto: ListItemBrandQueryDto): Promise<ItemBrandSuccessResponse<ItemBrandPayload[], ItemBrandListMeta>>;
    getById(brandId: string): Promise<ItemBrandSuccessResponse<ItemBrandPayload>>;
    remove(brandId: string): Promise<ItemBrandSuccessResponse<{
        brand_id: string;
        deleted: true;
    }>>;
    private withUploadedPhoto;
}
export {};
