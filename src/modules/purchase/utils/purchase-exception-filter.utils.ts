import { ModuleExceptionFilter } from '../../../common/utils/module-shared.utils';
import { PurchaseErrorDetail, PurchaseErrorResponse } from './purchase-service.utils';
export abstract class PurchaseExceptionFilter<
  TErrorDetail extends PurchaseErrorDetail,
  TErrorResponse extends PurchaseErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}