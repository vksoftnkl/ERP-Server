export interface FixedErrorDetail {
  field: string;
  message: string;
}

export interface FixedErrorResponse {
  success: false;
  message: string;
  errors: FixedErrorDetail[];
}

export interface FixedSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}
