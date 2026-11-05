import { ListStateCodeMasterQueryDto } from './dto/list-state-code-master-query.dto';
import { SaveStateCodeMasterDto } from './dto/save-state-code-master.dto';
import { StateCodeMasterService } from './state-code-master.service';
import { StateCodeMasterListItem, StateCodeMasterListMeta, StateCodeMasterPayload, StateCodeMasterSuccessResponse } from './types/state-code-master-api.types';
export declare class StateCodeMasterController {
    private readonly stateCodeMasterService;
    constructor(stateCodeMasterService: StateCodeMasterService);
    save(saveStateCodeMasterDto: SaveStateCodeMasterDto): Promise<StateCodeMasterSuccessResponse<StateCodeMasterPayload>>;
    list(queryDto: ListStateCodeMasterQueryDto): Promise<StateCodeMasterSuccessResponse<StateCodeMasterListItem[], StateCodeMasterListMeta>>;
    getById(stateCode: string): Promise<StateCodeMasterSuccessResponse<StateCodeMasterPayload>>;
    remove(stateCode: string): Promise<StateCodeMasterSuccessResponse<{
        stateCode: string;
        deleted: true;
    }>>;
}
