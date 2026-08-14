import { SaveGspProviderMasterDto } from './dto/save-gsp-provider-master.dto';
import { GspProviderMasterService } from './gsp-provider-master.service';
import { GspProviderMasterPayload, GspProviderMasterSuccessResponse } from './types/gsp-provider-master-api.types';
export declare class GspProviderMasterController {
    private readonly gspProviderMasterService;
    constructor(gspProviderMasterService: GspProviderMasterService);
    save(saveGspProviderMasterDto: SaveGspProviderMasterDto): Promise<GspProviderMasterSuccessResponse<GspProviderMasterPayload>>;
    getById(gspProviderId: string): Promise<GspProviderMasterSuccessResponse<GspProviderMasterPayload>>;
    remove(gspProviderId: string): Promise<GspProviderMasterSuccessResponse<{
        gspProviderId: string;
        deleted: true;
    }>>;
}
