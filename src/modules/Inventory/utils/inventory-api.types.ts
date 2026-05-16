export interface InventoryErrorDetail {
  field: string;
  message: string;
}
export interface InventoryErrorResponse {
  success: false;
  message: string;
  errors: InventoryErrorDetail[];
}
export interface InventorySuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}
