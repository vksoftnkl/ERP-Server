import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { TillErrorDetail, TillErrorResponse } from './types/till-api.types';

/**
 * The house error body for /till/*. A TILL_* refusal already is one and is
 * passed through with its status (428 included); class-validator's flat list
 * is turned back into field errors.
 */
@Catch()
export class TillExceptionFilter extends AccountsExceptionFilter<
  TillErrorDetail,
  TillErrorResponse
> {
  constructor() {
    super(
      /\b(tss[A-Z][a-zA-Z0-9]*|tbd[A-Z][a-zA-Z0-9]*|tcn[A-Z][a-zA-Z0-9]*|tsf[A-Z][a-zA-Z0-9]*|trs[A-Z][a-zA-Z0-9]*|tdn[A-Z][a-zA-Z0-9]*|tar[A-Z][a-zA-Z0-9]*|taa[A-Z][a-zA-Z0-9]*|lines(\.\d+)?(\.[a-zA-Z]+)?|events(\.\d+)?(\.[a-zA-Z]+)?|companyId|branchId|accYear|tenantId|counterId|floatMode|floatIssued|floatLeft|prevSessionId|witnessBy|reasonId|notes|id)\b/,
    );
  }
}
