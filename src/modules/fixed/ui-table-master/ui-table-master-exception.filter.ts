import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from '../utils/fixed-exception-filter.utils';
import {
  UiTableMasterErrorDetail,
  UiTableMasterErrorResponse,
} from './types/ui-table-master-api.types';

@Catch()
export class UiTableMasterExceptionFilter extends FixedExceptionFilter<
  UiTableMasterErrorDetail,
  UiTableMasterErrorResponse
> {
  constructor() {
    super(/\b(uiTbl[A-Za-z0-9]+)\b/);
  }
}
