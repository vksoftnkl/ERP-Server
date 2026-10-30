import { GetPriceLevelMasterQueryDto } from './dto/get-price-level-master-query.dto';
import { UpdatePriceLevelMasterDto } from './dto/update-price-level-master.dto';
import { PriceLevelMasterSuccessUpdateDto } from './dto/price-level-master-response.dto';
import { PriceLevelMasterService } from './price-level-master.service';
import { PriceLevelMasterGetMeta, PriceLevelMasterPayload, PriceLevelMasterSuccessResponse } from './types/price-level-master-api.types';
export declare class PriceLevelMasterController {
    private readonly priceLevelMasterService;
    constructor(priceLevelMasterService: PriceLevelMasterService);
    get(queryDto: GetPriceLevelMasterQueryDto): Promise<PriceLevelMasterSuccessResponse<PriceLevelMasterPayload[], PriceLevelMasterGetMeta>>;
    update(updateDto: UpdatePriceLevelMasterDto): Promise<PriceLevelMasterSuccessUpdateDto>;
}
