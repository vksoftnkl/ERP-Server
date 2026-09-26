import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemsSectionMasterService } from './items-section-master.service';
import { ItemSectionPayload, ItemSectionSuccessResponse } from './types/item-section-api.types';
type UploadedPhotoFile = {
    buffer: Buffer;
};
export declare class ItemsSectionMasterController {
    private readonly itemsSectionMasterService;
    constructor(itemsSectionMasterService: ItemsSectionMasterService);
    save(saveItemSectionDto: SaveItemSectionDto, secPhotoFile?: UploadedPhotoFile): Promise<ItemSectionSuccessResponse<ItemSectionPayload>>;
    getById(secId: string): Promise<ItemSectionSuccessResponse<ItemSectionPayload>>;
    remove(secId: string): Promise<ItemSectionSuccessResponse<{
        sec_id: string;
        deleted: boolean;
    }>>;
    private withUploadedPhoto;
}
export {};
