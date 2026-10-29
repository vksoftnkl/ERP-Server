import { TillContextService } from './till-context.service';
import { TillApprovalGateService } from './services/till-approval-gate.service';
import { CancelTillApprovalDto, DecideTillApprovalDto, RequestTillApprovalDto, TillApprovalKeyDto } from './dto/till-approval.dto';
import { TillScopeDto } from './dto/till-session.dto';
import type { TillApprovalInboxPayload, TillApprovalPayload, TillSuccessResponse } from './types/till-api.types';
export declare class TillApprovalController {
    private readonly context;
    private readonly gate;
    constructor(context: TillContextService, gate: TillApprovalGateService);
    request(dto: RequestTillApprovalDto): Promise<TillSuccessResponse<TillApprovalPayload>>;
    decide(dto: DecideTillApprovalDto): Promise<TillSuccessResponse<TillApprovalPayload>>;
    cancel(dto: CancelTillApprovalDto): Promise<TillSuccessResponse<TillApprovalPayload>>;
    get(query: TillApprovalKeyDto): Promise<TillSuccessResponse<TillApprovalPayload>>;
    pending(query: TillScopeDto): Promise<TillSuccessResponse<TillApprovalInboxPayload>>;
    private requireAny;
}
