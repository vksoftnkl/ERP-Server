import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemsGroupMasterService } from './items-group-master.service';
import { ItemGroupPayload, ItemGroupSuccessResponse } from './types/item-group-api.types';
type UploadedPhotoFile = {
    buffer: Buffer;
};
export declare class ItemsGroupMasterController {
    private readonly itemsGroupMasterService;
    constructor(itemsGroupMasterService: ItemsGroupMasterService);
    save(saveItemGroupDto: SaveItemGroupDto, itgPhotoFile?: UploadedPhotoFile): Promise<ItemGroupSuccessResponse<ItemGroupPayload>>;
    getById(itgId: string): Promise<ItemGroupSuccessResponse<ItemGroupPayload>>;
    remove(itgId: string): Promise<ItemGroupSuccessResponse<{
        itg_id: string;
    }>>;
    private withUploadedPhoto;
}
export {};
