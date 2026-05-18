export type { SalesErrorDetail as AreaErrorDetail } from 'src/common/utils/module-api.types';
export type { SalesErrorResponse as AreaErrorResponse } from 'src/common/utils/module-api.types';
export type { SalesSuccessResponse as AreaSuccessResponse } from 'src/common/utils/module-api.types';
export type { SalesListMeta as AreaListMeta } from 'src/common/utils/module-list.utils';

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

export type AreaListItem = AreaPayload | Record<string, unknown>;
