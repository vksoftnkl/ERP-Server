export type { FixedErrorDetail as PriceLevelMasterErrorDetail } from '../../utils/fixed-api.types';
export type { FixedErrorResponse as PriceLevelMasterErrorResponse } from '../../utils/fixed-api.types';
export type { FixedSuccessResponse as PriceLevelMasterSuccessResponse } from '../../utils/fixed-api.types';

export interface PriceLevelMasterPayload {
  priceLvlId: number;
  priceLvlName: string;
  priceLvlShort: string | null;
  priceLvlIsActive: boolean;
  priceLvlIsAdmin: boolean;
  priceLvlIsDeleted: boolean;
  priceLvlSyncDate: string | null;
  priceLvlCreatedOn: string;
  priceLvlCreatedBy: string | null;
  priceLvlModifiedOn: string;
  priceLvlModifiedBy: string | null;
}

export interface PriceLevelMasterGetMeta {
  priceLvlId?: number;
  activeOnly: boolean;
  includeDeleted: boolean;
  count: number;
}
