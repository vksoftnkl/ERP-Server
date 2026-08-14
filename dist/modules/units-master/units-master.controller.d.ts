import { ListUnitQueryDto } from './dto/list-unit-query.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import { UnitListMeta, UnitPayload, UnitSuccessResponse } from './types/unit-api.types';
import { UnitsMasterService } from './units-master.service';
export declare class UnitsMasterController {
    private readonly unitsMasterService;
    constructor(unitsMasterService: UnitsMasterService);
    save(saveUnitDto: SaveUnitDto): Promise<UnitSuccessResponse<UnitPayload>>;
    list(queryDto: ListUnitQueryDto): Promise<UnitSuccessResponse<UnitPayload[], UnitListMeta>>;
    getById(unitId: number): Promise<UnitSuccessResponse<UnitPayload>>;
    remove(unitId: number): Promise<UnitSuccessResponse<{
        unit_id: number;
        deleted: true;
    }>>;
}
