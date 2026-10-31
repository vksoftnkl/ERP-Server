import { GetTenderDetailQueryDto } from './dto/get-tender-detail-query.dto';
import { SaveTenderDetailDto } from './dto/save-tender-detail.dto';
import { TenderDetailService } from './tender-detail.service';
import { TenderDetailDeleteResult, TenderDetailPayload, TenderDetailSuccessResponse } from './types/tender-detail-api.types';
export declare class TenderDetailController {
    private readonly tenderDetailService;
    constructor(tenderDetailService: TenderDetailService);
    save(saveTenderDetailDto: SaveTenderDetailDto): Promise<TenderDetailSuccessResponse<TenderDetailPayload>>;
    get(getTenderDetailQueryDto: GetTenderDetailQueryDto): Promise<TenderDetailSuccessResponse<TenderDetailPayload | TenderDetailPayload[]>>;
    remove(tdId: string): Promise<TenderDetailSuccessResponse<TenderDetailDeleteResult>>;
}
