import { SaveUnitDto } from './dto/save-unit.dto';
import { UnitDetailPayload, UnitPayload, UnitSuccessResponse } from './types/unit-api.types';
import { UnitsMasterService } from './units-master.service';
export declare class UnitsMasterController {
    private readonly unitsMasterService;
    constructor(unitsMasterService: UnitsMasterService);
    save(saveUnitDto: SaveUnitDto): Promise<UnitSuccessResponse<UnitPayload>>;
    getById(unitId: string): Promise<UnitSuccessResponse<UnitDetailPayload>>;
    remove(unitId: string): Promise<UnitSuccessResponse<{
        unit_id: string;
        deleted: boolean;
    }>>;
}
