import { AreaService } from './area.service';
import { SaveAreaDto } from './dto/save-area.dto';
import { AreaMasterCreateResult, AreaPayload, AreaSuccessResponse } from './types/area-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class AreaController {
    private readonly areaService;
    private readonly requestContextService;
    constructor(areaService: AreaService, requestContextService: RequestContextService);
    createAreaMaster(dto: SaveAreaDto): Promise<AreaSuccessResponse<AreaMasterCreateResult | AreaPayload>>;
    getById(armId: string): Promise<AreaSuccessResponse<AreaPayload>>;
    remove(armId: string): Promise<AreaSuccessResponse<{
        armId: string;
        deleted: true;
    }>>;
}
