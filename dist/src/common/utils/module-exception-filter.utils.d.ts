import { ModuleExceptionFilter } from './module-shared.utils';
import type { ModuleErrorDetail, ModuleErrorResponse } from './module-shared.utils';
export declare abstract class AccountsExceptionFilter<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail>> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {
}
export declare abstract class FixedExceptionFilter<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail>> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {
}
export declare abstract class InventoryExceptionFilter<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail>> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {
}
export declare abstract class PurchaseExceptionFilter<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail>> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {
}
export declare abstract class SalesExceptionFilter<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail>> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {
}
export declare abstract class SettingsExceptionFilter<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail>> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {
}
