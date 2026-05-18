export interface PurchaseErrorDetail {
  field: string;
  message: string;
}
export interface PurchaseErrorResponse {
  success: false;
  message: string;
  errors: PurchaseErrorDetail[];
}
export interface PurchaseSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}