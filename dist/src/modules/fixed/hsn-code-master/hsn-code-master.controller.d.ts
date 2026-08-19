import { GetHsnCodeMasterQueryDto } from './dto/get-hsn-code-master-query.dto';
import { HsnCodeMasterService } from './hsn-code-master.service';
import { HsnCodeMasterGetMeta, HsnCodeMasterPayload, HsnCodeMasterSuccessResponse } from './types/hsn-code-master-api.types';
export declare class HsnCodeMasterController {
    private readonly hsnCodeMasterService;
    constructor(hsnCodeMasterService: HsnCodeMasterService);
    get(queryDto: GetHsnCodeMasterQueryDto): Promise<HsnCodeMasterSuccessResponse<HsnCodeMasterPayload[], HsnCodeMasterGetMeta>>;
}
