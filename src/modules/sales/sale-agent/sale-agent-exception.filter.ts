import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { SaleAgentErrorDetail, SaleAgentErrorResponse } from './types/sale-agent-api.types';

@Catch()
export class SaleAgentExceptionFilter extends SalesExceptionFilter<
  SaleAgentErrorDetail,
  SaleAgentErrorResponse
> {
  constructor() {
    super(/\b(sa[A-Za-z0-9]+)\b/);
  }
}
