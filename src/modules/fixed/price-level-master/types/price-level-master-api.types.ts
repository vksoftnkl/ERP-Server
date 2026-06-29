export type { FixedErrorDetail as PriceLevelMasterErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as PriceLevelMasterErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as PriceLevelMasterSuccessResponse } from 'src/common/types/module-api.types';
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