export interface ModuleApiErrorDetail {
  field: string;
  message: string;
}
export interface ModuleApiErrorResponse<
  TErrorDetail extends ModuleApiErrorDetail = ModuleApiErrorDetail,
> {
  success: false;
  message: string;
  errors: TErrorDetail[];
}
export interface ModuleApiSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}
export type AccountsErrorDetail = ModuleApiErrorDetail;
export type AccountsErrorResponse<
  TErrorDetail extends AccountsErrorDetail = AccountsErrorDetail,
> = ModuleApiErrorResponse<TErrorDetail>;
export type AccountsSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> =
  ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type SalesErrorDetail = ModuleApiErrorDetail;
export type SalesErrorResponse<
  TErrorDetail extends SalesErrorDetail = SalesErrorDetail,
> = ModuleApiErrorResponse<TErrorDetail>;
export type SalesSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> =
  ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type PurchaseErrorDetail = ModuleApiErrorDetail;
export type PurchaseErrorResponse<
  TErrorDetail extends PurchaseErrorDetail = PurchaseErrorDetail,
> = ModuleApiErrorResponse<TErrorDetail>;
export type PurchaseSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> =
  ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type InventoryErrorDetail = ModuleApiErrorDetail;
export type InventoryErrorResponse<
  TErrorDetail extends InventoryErrorDetail = InventoryErrorDetail,
> = ModuleApiErrorResponse<TErrorDetail>;
export type InventorySuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> =
  ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type FixedErrorDetail = ModuleApiErrorDetail;
export type FixedErrorResponse<
  TErrorDetail extends FixedErrorDetail = FixedErrorDetail,
> = ModuleApiErrorResponse<TErrorDetail>;
export type FixedSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> =
  ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type SettingsErrorDetail = ModuleApiErrorDetail;
export type SettingsErrorResponse<
  TErrorDetail extends SettingsErrorDetail = SettingsErrorDetail,
> = ModuleApiErrorResponse<TErrorDetail>;
export type SettingsSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> =
  ModuleApiSuccessResponse<T, TMeta, TStyles>;