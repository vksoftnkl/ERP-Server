import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from '../utils/fixed-exception-filter.utils';
import {
  UiTableColumnErrorDetail,
  UiTableColumnErrorResponse,
} from './types/ui-table-column-api.types';

@Catch()
export class UiTableColumnExceptionFilter extends FixedExceptionFilter<
  UiTableColumnErrorDetail,
  UiTableColumnErrorResponse
> {
  constructor() {
    super(/\b(uiTblClm[A-Za-z0-9]+)\b/);
  }
}
