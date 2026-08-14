import { ListItemSectionQueryDto } from './dto/list-item-section-query.dto';
import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemsSectionMasterService } from './items-section-master.service';
import { ItemSectionListMeta, ItemSectionPayload, ItemSectionSuccessResponse } from './types/item-section-api.types';
type UploadedPhotoFile = {
    buffer: Buffer;
};
export declare class ItemsSectionMasterController {
    private readonly itemsSectionMasterService;
    constructor(itemsSectionMasterService: ItemsSectionMasterService);
    save(saveItemSectionDto: SaveItemSectionDto, secPhotoFile?: UploadedPhotoFile): Promise<ItemSectionSuccessResponse<ItemSectionPayload>>;
    list(queryDto: ListItemSectionQueryDto): Promise<ItemSectionSuccessResponse<ItemSectionPayload[], ItemSectionListMeta>>;
    getById(secId: string): Promise<ItemSectionSuccessResponse<ItemSectionPayload>>;
    remove(secId: string): Promise<ItemSectionSuccessResponse<{
        sec_id: string;
        deleted: true;
    }>>;
    private withUploadedPhoto;
}
export {};
