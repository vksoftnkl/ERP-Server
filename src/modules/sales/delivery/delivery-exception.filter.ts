import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ModuleErrorDetail, ModuleErrorResponse } from 'src/common/utils/module-service.utils';

/** /delivery-notes/* and /deliveries/*: the house error body, worded (notes 120). */
@Catch()
export class DeliveryExceptionFilter extends SalesExceptionFilter<
  ModuleErrorDetail,
  ModuleErrorResponse<ModuleErrorDetail>
> {
  constructor() {
    super(
      /\b((?:sdn|sdni|sde|sb)[A-Za-z0-9]+|lines|qty|lotId|godownId|billId|billItemId|billAccYear|reason|baseRevision|transport|overrideWarnings|code|companyId|branchId|accYear|deviceId)\b/,
    );
  }
}
