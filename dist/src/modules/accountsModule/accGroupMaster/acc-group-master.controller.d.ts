import { SaveAccGroupMasterDto } from './dto/save-acc-group-master.dto';
import { AccGroupMasterService } from './acc-group-master.service';
import { AccGroupMasterPayload, AccGroupMasterSuccessResponse } from './types/acc-group-master-api.types';
export declare class AccGroupMasterController {
    private readonly accGroupMasterService;
    constructor(accGroupMasterService: AccGroupMasterService);
    save(saveAccGroupMasterDto: SaveAccGroupMasterDto): Promise<AccGroupMasterSuccessResponse<AccGroupMasterPayload>>;
    getById(accGroupId: string): Promise<AccGroupMasterSuccessResponse<AccGroupMasterPayload>>;
    remove(accGroupId: string): Promise<AccGroupMasterSuccessResponse<{
        accGroupId: string;
        deleted: true;
    }>>;
}
