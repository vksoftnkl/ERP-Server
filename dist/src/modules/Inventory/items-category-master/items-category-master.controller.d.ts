import { SaveItemCategoryDto } from './dto/save-item-category.dto';
import { ItemsCategoryMasterService } from './items-category-master.service';
import { ItemCategoryPayload, ItemCategorySuccessResponse } from './types/item-category-api.types';
type UploadedPhotoFile = {
    buffer: Buffer;
};
export declare class ItemsCategoryMasterController {
    private readonly itemsCategoryMasterService;
    constructor(itemsCategoryMasterService: ItemsCategoryMasterService);
    save(saveItemCategoryDto: SaveItemCategoryDto, categoryPhotoFile?: UploadedPhotoFile): Promise<ItemCategorySuccessResponse<ItemCategoryPayload>>;
    getById(categoryId: string): Promise<ItemCategorySuccessResponse<ItemCategoryPayload>>;
    remove(categoryId: string): Promise<ItemCategorySuccessResponse<{
        category_id: string;
        deleted: boolean;
    }>>;
    private withUploadedPhoto;
}
export {};
