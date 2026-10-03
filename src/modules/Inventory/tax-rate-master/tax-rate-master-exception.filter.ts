import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { TaxRateErrorDetail, TaxRateErrorResponse } from './types/tax-rate-api.types';

/**
 * Matches both the header's tax_* fields and the grid paths the guard reports
 * against (lines.0.trl_ledger_id), so a raw DB message still names a field the
 * screen can highlight.
 */
@Catch()
export class TaxRateMasterExceptionFilter extends InventoryExceptionFilter<
  TaxRateErrorDetail,
  TaxRateErrorResponse
> {
  constructor() {
    super(/\b((?:lines\.\d+\.)?(?:tax|trl)_[a-z0-9_]+)\b/i);
  }
}
