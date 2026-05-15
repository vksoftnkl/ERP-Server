export interface SalesErrorDetail {
  field: string;
  message: string;
}

export interface SalesErrorResponse {
  success: false;
  message: string;
  errors: SalesErrorDetail[];
}

export interface SalesSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}
