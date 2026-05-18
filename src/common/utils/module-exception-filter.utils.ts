import { ModuleExceptionFilter } from './module-shared.utils';
import type { ModuleErrorDetail, ModuleErrorResponse } from './module-shared.utils';

export abstract class AccountsExceptionFilter<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}

export abstract class FixedExceptionFilter<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}

export abstract class InventoryExceptionFilter<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}

export abstract class PurchaseExceptionFilter<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}

export abstract class SalesExceptionFilter<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}

export abstract class SettingsExceptionFilter<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}
