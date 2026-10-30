import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  AccGroupMasterErrorDetail,
  AccGroupMasterErrorResponse,
} from './types/acc-group-master-api.types';
@Catch()
export class AccGroupMasterExceptionFilter extends AccountsExceptionFilter<
  AccGroupMasterErrorDetail,
  AccGroupMasterErrorResponse
> {
  constructor() {
    super(/\b(accGroup[a-zA-Z0-9]+)\b/);
  }
}
