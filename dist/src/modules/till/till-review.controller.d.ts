import { TillContextService } from './till-context.service';
import { TillReviewService } from './services/till-review.service';
import { CreateTillReviewDto, TillReviewListQueryDto } from './dto/till-review.dto';
import type { TillReviewCreatePayload, TillReviewListPayload, TillSuccessResponse } from './types/till-api.types';
export declare class TillReviewController {
    private readonly context;
    private readonly reviews;
    constructor(context: TillContextService, reviews: TillReviewService);
    create(dto: CreateTillReviewDto): Promise<TillSuccessResponse<TillReviewCreatePayload>>;
    list(query: TillReviewListQueryDto): Promise<TillSuccessResponse<TillReviewListPayload>>;
}
