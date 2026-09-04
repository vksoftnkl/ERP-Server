import { GetChargeMasterQueryDto } from './dto/get-charge-master-query.dto';
import { SaveChargeMasterDto } from './dto/save-charge-master.dto';
import { ChargeMasterService } from './charge-master.service';
import { ChargeMasterDeleteResult, ChargeMasterPayload, ChargeMasterSuccessResponse } from './types/charge-master-api.types';
export declare class ChargeMasterController {
    private readonly chargeMasterService;
    constructor(chargeMasterService: ChargeMasterService);
    save(saveChargeMasterDto: SaveChargeMasterDto): Promise<ChargeMasterSuccessResponse<ChargeMasterPayload>>;
    get(getChargeMasterQueryDto: GetChargeMasterQueryDto): Promise<ChargeMasterSuccessResponse<ChargeMasterPayload | ChargeMasterPayload[]>>;
    remove(chgId: string): Promise<ChargeMasterSuccessResponse<ChargeMasterDeleteResult>>;
}
