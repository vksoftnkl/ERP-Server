import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ModuleErrorDetail, ModuleErrorResponse } from 'src/common/utils/module-service.utils';

@Catch()
export class DeliveryChallanExceptionFilter extends SalesExceptionFilter<
  ModuleErrorDetail,
  ModuleErrorResponse<ModuleErrorDetail>
> {
  constructor() {
    super(
      /\b((?:sdc|sdi|cd|td)[A-Za-z0-9]+|reason|remark|purpose|baseRevision|editRemark|transport)\b/,
    );
  }
}
