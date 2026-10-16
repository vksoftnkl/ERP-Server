import { TillContextService } from './till-context.service';
import { TillSafeService } from './services/till-safe.service';
import { ConfirmTillRemitDto, CountTillSafeDto, DecideTillSafeVarianceDto, RemitTillCashDto, TillSafeBalanceQueryDto } from './dto/till-safe.dto';
import type { TillRemitConfirmPayload, TillRemitPayload, TillSafeBalancePayload, TillSafeCountPayload, TillSafeDecisionPayload, TillSuccessResponse } from './types/till-api.types';
export declare class TillSafeController {
    private readonly context;
    private readonly safes;
    constructor(context: TillContextService, safes: TillSafeService);
    balance(query: TillSafeBalanceQueryDto): Promise<TillSuccessResponse<TillSafeBalancePayload>>;
    count(dto: CountTillSafeDto): Promise<TillSuccessResponse<TillSafeCountPayload>>;
    decideVariance(dto: DecideTillSafeVarianceDto): Promise<TillSuccessResponse<TillSafeDecisionPayload>>;
    remit(dto: RemitTillCashDto): Promise<TillSuccessResponse<TillRemitPayload>>;
    confirmRemit(dto: ConfirmTillRemitDto): Promise<TillSuccessResponse<TillRemitConfirmPayload>>;
    private requireAny;
}
