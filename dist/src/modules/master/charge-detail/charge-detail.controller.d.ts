import { GetChargeDetailQueryDto } from './dto/get-charge-detail-query.dto';
import { SaveChargeDetailDto } from './dto/save-charge-detail.dto';
import { ChargeDetailService } from './charge-detail.service';
import { ChargeDetailDeleteResult, ChargeDetailPayload, ChargeDetailSuccessResponse } from './types/charge-detail-api.types';
export declare class ChargeDetailController {
    private readonly chargeDetailService;
    constructor(chargeDetailService: ChargeDetailService);
    save(saveChargeDetailDto: SaveChargeDetailDto): Promise<ChargeDetailSuccessResponse<ChargeDetailPayload>>;
    get(getChargeDetailQueryDto: GetChargeDetailQueryDto): Promise<ChargeDetailSuccessResponse<ChargeDetailPayload | ChargeDetailPayload[]>>;
    remove(cdId: string): Promise<ChargeDetailSuccessResponse<ChargeDetailDeleteResult>>;
}
