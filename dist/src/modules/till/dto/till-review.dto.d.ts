import { TillReviewOutcome } from '../types/till-enum';
import { TillScopeDto } from './till-session.dto';
export declare class CreateTillReviewDto extends TillScopeDto {
    accYear: string;
    dayId?: string | null;
    sessionId?: string | null;
    outcome: TillReviewOutcome;
    note?: string | null;
    refVoucherId?: string | null;
    refVoucherAccYear?: string | null;
}
export declare class TillReviewListQueryDto extends TillScopeDto {
    dayId?: string;
    sessionId?: string;
}
