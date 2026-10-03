import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  TenderMasterErrorDetail,
  TenderMasterErrorResponse,
} from './types/tender-master-api.types';
@Catch()
export class TenderMasterExceptionFilter extends AccountsExceptionFilter<
  TenderMasterErrorDetail,
  TenderMasterErrorResponse
> {
  constructor() {
    super(/\b(tnd[A-Za-z0-9]+)\b/);
  }
}
