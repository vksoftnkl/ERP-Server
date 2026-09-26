import { SaveTenderTypeMasterDto } from './dto/save-tender-type-master.dto';
import { TenderTypeMasterService } from './tender-type-master.service';
import { TenderTypeMasterPayload, TenderTypeMasterSuccessResponse } from './types/tender-type-master-api.types';
export declare class TenderTypeMasterController {
    private readonly tenderTypeMasterService;
    constructor(tenderTypeMasterService: TenderTypeMasterService);
    save(saveTenderTypeMasterDto: SaveTenderTypeMasterDto): Promise<TenderTypeMasterSuccessResponse<TenderTypeMasterPayload>>;
    getById(ttmTypeId: string): Promise<TenderTypeMasterSuccessResponse<TenderTypeMasterPayload>>;
    remove(ttmTypeId: string): Promise<TenderTypeMasterSuccessResponse<{
        ttmTypeId: string;
        deleted: true;
    }>>;
}
