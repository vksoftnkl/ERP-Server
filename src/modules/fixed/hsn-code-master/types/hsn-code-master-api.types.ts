export type { FixedErrorDetail as HsnCodeMasterErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as HsnCodeMasterErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as HsnCodeMasterSuccessResponse } from 'src/common/types/module-api.types';

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
