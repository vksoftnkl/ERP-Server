import { CityService } from './city.service';
import { SaveCityDto } from './dto/save-city.dto';
import { CityMasterCreateResult, CityPayload, CitySuccessResponse } from './types/city-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class CityController {
    private readonly cityService;
    private readonly requestContextService;
    constructor(cityService: CityService, requestContextService: RequestContextService);
    createCityMaster(dto: SaveCityDto): Promise<CitySuccessResponse<CityMasterCreateResult | CityPayload>>;
    getById(ctmId: string): Promise<CitySuccessResponse<CityPayload>>;
    remove(ctmId: string): Promise<CitySuccessResponse<{
        ctmId: string;
        deleted: true;
    }>>;
}
