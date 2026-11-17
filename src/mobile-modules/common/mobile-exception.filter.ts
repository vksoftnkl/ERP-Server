import { Catch } from '@nestjs/common';
import {
  type ModuleErrorDetail,
  type ModuleErrorResponse,
} from 'src/common/utils/module-shared.utils';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';

/**
 * The house filter for /mobile/items and /mobile/visits: coded house bodies
 * pass through, validation 400s are mapped per field, and every coded error
 * goes out worded (notes 120). Field names it recognises in a raw message:
 * the visit's cv*, and the query / body keys companyId, deviceUid, clientUuid.
 * /mobile/orders uses the desktop SaleOrderExceptionFilter instead (so* / soi*).
 */
@Catch()
export class MobileExceptionFilter extends SalesExceptionFilter<
  ModuleErrorDetail,
  ModuleErrorResponse<ModuleErrorDetail>
> {
  constructor() {
    super(/\b(cv[A-Z][A-Za-z0-9]*|companyId|deviceUid|clientUuid|page|pageSize)\b/);
  }
}
