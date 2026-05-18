export interface AccountsErrorDetail {
  field: string;
  message: string;
}
export interface AccountsErrorResponse {
  success: false;
  message: string;
  errors: AccountsErrorDetail[];
}
export interface AccountsSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}
