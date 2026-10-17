import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { GstinLookupErrorDetail, GstinLookupErrorResponse } from './types/gstin-lookup.types';

@Catch()
export class GstinLookupExceptionFilter extends SettingsExceptionFilter<
  GstinLookupErrorDetail,
  GstinLookupErrorResponse
> {
  constructor() {
    super(/\b(gstin)\b/);
  }
}
