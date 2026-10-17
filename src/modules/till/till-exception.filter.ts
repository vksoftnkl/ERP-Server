/**
 * till-exception.filter.ts — the exception filter every till controller runs under
 * (@UseFilters). A throwTill() body goes out as it is, at its status; any other error is shaped
 * into the same `{ success, message, errors[] }` body by AccountsExceptionFilter.
 */
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
  /**
   * The field names a class-validator message may start with — the column-style DTO fields
   * (tss* / tbd* / tcn* / tsf* / trs* / tdn* / tar* / taa*), `lines.N.x` / `events.N.x` array
   * items and the key fields — so a flat validation message is turned back into
   * `{ field, message }` errors.
   */
  constructor() {
    super(
      /\b(tss[A-Z][a-zA-Z0-9]*|tbd[A-Z][a-zA-Z0-9]*|tcn[A-Z][a-zA-Z0-9]*|tsf[A-Z][a-zA-Z0-9]*|trs[A-Z][a-zA-Z0-9]*|tdn[A-Z][a-zA-Z0-9]*|tar[A-Z][a-zA-Z0-9]*|taa[A-Z][a-zA-Z0-9]*|lines(\.\d+)?(\.[a-zA-Z]+)?|events(\.\d+)?(\.[a-zA-Z]+)?|companyId|branchId|accYear|tenantId|counterId|floatMode|floatIssued|floatLeft|prevSessionId|witnessBy|reasonId|notes|id)\b/,
    );
  }
}
