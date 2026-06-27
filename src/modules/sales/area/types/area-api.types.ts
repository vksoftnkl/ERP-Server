export type { SalesErrorDetail as AreaErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as AreaErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as AreaSuccessResponse } from 'src/common/types/module-api.types';

export interface AreaPayload {
  armId: string;
  armName: string;
  armAlias: string | null;
  armShort: string | null;
  armCityId: string;
  armCityName?: string | null;
  armSort: number;
  armDistanceKm: number | null;
  armCollectionDays: number[];
  armIsActive: boolean;
  armIsDeleted: boolean;
  armSyncDate: string | null;
  armCreatedOn: string;
  armCreatedBy: string | null;
  armModifiedOn: string;
  armModifiedBy: string | null;
}

// Result of createAreaMaster: the created area master plus the linked account group id
// (equal to armId, surfaced explicitly because the two rows are created together).
export interface AreaMasterCreateResult {
  areaMaster: AreaPayload;
  accGroupId: string;
}

