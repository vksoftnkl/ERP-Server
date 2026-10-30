import type { SalesErrorDetail, SalesErrorResponse } from 'src/common/types/module-api.types';
import type { CityErrorCode } from './city-error-codes';

/** Notes 119: every refusal names its code — see city-error-codes.ts. */
export interface CityErrorDetail extends SalesErrorDetail {
  code: CityErrorCode;
}
export type CityErrorResponse = SalesErrorResponse<CityErrorDetail>;
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
