import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  GridDetailErrorDetail,
  GridDetailErrorResponse,
} from './types/grid-detail-api.types';

@Catch()
export class GridDetailExceptionFilter extends FixedExceptionFilter<
  GridDetailErrorDetail,
  GridDetailErrorResponse
> {
  constructor() {
    super(/\b(grid_[a-z0-9_]+)\b/i);
  }
}
