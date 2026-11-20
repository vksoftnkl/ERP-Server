import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ModuleErrorDetail, ModuleErrorResponse } from 'src/common/utils/module-shared.utils';

/**
 * /mobile/returns/create and /delete: the desktop sale return's codes
 * (SALES_*, TILL_*, VCH_*) and the MOBILE_* ones go out worded (notes 120).
 * Field names it recognises in a raw message: the return's sr* / sri* keys and
 * the phone's own deviceUid, godownId, lines, adjustments, billId, billAccYear.
 */
@Catch()
export class MobileReturnExceptionFilter extends SalesExceptionFilter<
  ModuleErrorDetail,
  ModuleErrorResponse<ModuleErrorDetail>
> {
  constructor() {
    super(
      /\b((?:sr|sri)[A-Z][A-Za-z0-9]*|deviceUid|godownId|lines|adjustments|billId|billAccYear|amount|phoneEstimate)\b/,
    );
  }
}
