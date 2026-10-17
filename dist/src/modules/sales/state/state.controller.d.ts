import { StateService } from './state.service';
import { SaveStateDto } from './dto/save-state.dto';
import { StateMasterCreateResult, StatePayload, StateSuccessResponse } from './types/state-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class StateController {
    private readonly stateService;
    private readonly requestContextService;
    constructor(stateService: StateService, requestContextService: RequestContextService);
    createStateMaster(dto: SaveStateDto): Promise<StateSuccessResponse<StateMasterCreateResult | StatePayload>>;
    getById(stmId: string): Promise<StateSuccessResponse<StatePayload>>;
    remove(stmId: string): Promise<StateSuccessResponse<{
        stmId: string;
        deleted: true;
    }>>;
}
