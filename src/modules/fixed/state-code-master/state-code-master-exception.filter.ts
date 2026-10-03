import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  StateCodeMasterErrorDetail,
  StateCodeMasterErrorResponse,
} from './types/state-code-master-api.types';

@Catch()
export class StateCodeMasterExceptionFilter extends FixedExceptionFilter<
  StateCodeMasterErrorDetail,
  StateCodeMasterErrorResponse
> {
  constructor() {
    super(/\b(stateCode|stateName|tinCode|isActive|stateUt)\b/);
  }
}
