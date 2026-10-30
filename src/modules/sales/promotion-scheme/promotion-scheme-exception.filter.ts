import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  PromotionSchemeErrorDetail,
  PromotionSchemeErrorResponse,
} from './types/promotion-scheme-api.types';

@Catch()
export class PromotionSchemeExceptionFilter extends SalesExceptionFilter<
  PromotionSchemeErrorDetail,
  PromotionSchemeErrorResponse
> {
  constructor() {
    super(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/i);
  }
}
