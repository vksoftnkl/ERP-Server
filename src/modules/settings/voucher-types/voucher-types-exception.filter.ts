import { Catch } from '@nestjs/common';
import {
  ModuleExceptionFilter,
  type ModuleErrorDetail,
  type ModuleErrorResponse,
} from 'src/common/utils/module-shared.utils';

/** /voucher-types/*: every refusal goes out with its plain words (notes 120). */
@Catch()
export class VoucherTypesExceptionFilter extends ModuleExceptionFilter<
  ModuleErrorDetail,
  ModuleErrorResponse
> {
  constructor() {
    super(/\b(vchr[A-Za-z0-9]+|ppo[A-Za-z0-9]+|offerBase|companyId|branchId|accYear)\b/);
  }
}
