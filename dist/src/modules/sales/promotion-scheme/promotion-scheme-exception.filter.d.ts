import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { PromotionSchemeErrorDetail, PromotionSchemeErrorResponse } from './types/promotion-scheme-api.types';
export declare class PromotionSchemeExceptionFilter extends SalesExceptionFilter<PromotionSchemeErrorDetail, PromotionSchemeErrorResponse> {
    constructor();
}
