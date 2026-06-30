export type { SalesErrorDetail as CityErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as CityErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as CitySuccessResponse } from 'src/common/types/module-api.types';
export interface CityPayload {
  ctmId: string;
  ctmName: string;
  ctmAlias: string | null;
  ctmShort: string | null;
  ctmStateId: string;
  ctmStateName?: string | null;
  ctmOrder: number;
  ctmDescription: string | null;
  ctmIsActive: boolean;
  ctmIsDeleted: boolean;
  ctmSyncDate: string | null;
  ctmCreatedOn: string;
  ctmCreatedBy: string | null;
  ctmModifiedOn: string;
  ctmModifiedBy: string | null;
}

// Result of createCityMaster: the created city master plus the linked account group id
// (equal to ctmId, surfaced explicitly because the two rows are created together).
export interface CityMasterCreateResult {
  cityMaster: CityPayload;
  accGroupId: string;
}

