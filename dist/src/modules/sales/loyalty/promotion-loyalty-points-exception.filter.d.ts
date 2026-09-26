import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse } from './types/promotion-loyalty-points-api.types';
export declare class PromotionLoyaltyPointsExceptionFilter extends SalesExceptionFilter<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse> {
    constructor();
}
