import { ModuleExceptionFilter } from '../../../common/utils/module-shared.utils';
import { SalesErrorDetail, SalesErrorResponse } from './sales-service.utils';
export abstract class SalesExceptionFilter<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}
