export type { SalesErrorDetail as AreaErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as AreaErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as AreaSuccessResponse } from 'src/common/types/module-api.types';

export interface AreaPayload {
  armId: string;
  armName: string;
  armAlias: string | null;
  armShort: string | null;
  armCityId: string;
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

