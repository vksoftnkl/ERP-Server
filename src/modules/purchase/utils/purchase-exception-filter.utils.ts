import { ModuleExceptionFilter } from '../../../common/utils/module-shared.utils';
import { PurchaseErrorDetail, PurchaseErrorResponse } from '../../../common/utils/module-service.utils';
export abstract class PurchaseExceptionFilter<
  TErrorDetail extends PurchaseErrorDetail,
  TErrorResponse extends PurchaseErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}