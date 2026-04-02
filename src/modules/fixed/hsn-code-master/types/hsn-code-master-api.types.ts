export interface HsnCodeMasterErrorDetail {
  field: string;
  message: string;
}

export interface HsnCodeMasterErrorResponse {
  success: false;
  message: string;
  errors: HsnCodeMasterErrorDetail[];
}

export interface HsnCodeMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface HsnCodeMasterPayload {
  hsnId: number;
  hsnCode: string;
  hsnName: string;
  hsnDescription: string | null;
  hsnIsService: boolean;
  hsnUqc: string | null;
  hsnIsActive: boolean;
  hsnRateOfTax: number;
}

export interface HsnCodeMasterGetMeta {
  hsnId?: number;
  hsnCode?: string;
  activeOnly: boolean;
  count: number;
}
