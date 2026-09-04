import { Catch } from '@nestjs/common';
import { ModuleExceptionFilter } from 'src/common/utils/module-shared.utils';
import { ChargeMasterErrorDetail, ChargeMasterErrorResponse } from './types/charge-master-api.types';

@Catch()
export class ChargeMasterExceptionFilter extends ModuleExceptionFilter<
  ChargeMasterErrorDetail,
  ChargeMasterErrorResponse
> {
  constructor() {
    super(/\b(chg[A-Za-z0-9]+)\b/);
  }
}
