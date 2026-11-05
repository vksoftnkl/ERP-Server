import { SaveTenderMasterDto } from './dto/save-tender-master.dto';
import { TenderMasterService } from './tender-master.service';
import { TenderMasterPayload, TenderMasterSuccessResponse } from './types/tender-master-api.types';
export declare class TenderMasterController {
    private readonly tenderMasterService;
    constructor(tenderMasterService: TenderMasterService);
    save(saveTenderMasterDto: SaveTenderMasterDto): Promise<TenderMasterSuccessResponse<TenderMasterPayload>>;
    list(): Promise<TenderMasterSuccessResponse<TenderMasterPayload[]>>;
    getById(tndId: string): Promise<TenderMasterSuccessResponse<TenderMasterPayload>>;
    remove(tndId: string): Promise<TenderMasterSuccessResponse<{
        tndId: string;
        deleted: true;
    }>>;
}
