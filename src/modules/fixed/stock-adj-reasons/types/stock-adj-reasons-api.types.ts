export type { FixedErrorDetail as StockAdjReasonsErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as StockAdjReasonsErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as StockAdjReasonsSuccessResponse } from 'src/common/types/module-api.types';

export interface StockAdjReasonsPayload {
  sarId: string;
  sarCode: string;
  sarName: string;
  sarReasonKind: string;
  sarDefaultResolution: string;
  sarAffectsAccounts: boolean;
  sarIsActive: boolean;
  sarIsDeleted: boolean;
  sarCreatedOn: string;
  sarCreatedBy: string | null;
  sarModifiedOn: string | null;
  sarModifiedBy: string | null;
}

export interface StockAdjReasonsGetMeta {
  sarId?: string;
  sarCode?: string;
  sarReasonKind?: string;
  activeOnly: boolean;
  includeDeleted: boolean;
  count: number;
}
