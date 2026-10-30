import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { StateErrorDetail, StateErrorResponse } from './types/state-api.types';

@Catch()
export class StateExceptionFilter extends SalesExceptionFilter<
  StateErrorDetail,
  StateErrorResponse
> {
  constructor() {
    super(/\b(stm[A-Za-z0-9]+)\b/);
  }
}
