import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from '../utils/sales-exception-filter.utils';
import {
  PromotionLoyaltyPointsErrorDetail,
  PromotionLoyaltyPointsErrorResponse,
} from './types/promotion-loyalty-points-api.types';

@Catch()
export class PromotionLoyaltyPointsExceptionFilter extends SalesExceptionFilter<
  PromotionLoyaltyPointsErrorDetail,
  PromotionLoyaltyPointsErrorResponse
> {
  constructor() {
    super(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/i);
  }
}
