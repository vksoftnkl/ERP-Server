import { ModuleExceptionFilter } from '../../../common/utils/module-shared.utils';
import { AccountsErrorDetail, AccountsErrorResponse } from './accounts-service.utils';
export abstract class AccountsExceptionFilter<
  TErrorDetail extends AccountsErrorDetail,
  TErrorResponse extends AccountsErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}
