export type { SalesErrorDetail as CityErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as CityErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as CitySuccessResponse } from 'src/common/types/module-api.types';
export type { SalesListMeta as CityListMeta } from 'src/common/types/module-list.types';

export interface CityPayload {
  ctmId: string;
  ctmName: string;
  ctmAlias: string | null;
  ctmShort: string | null;
  ctmStateId: string;
  ctmOrder: number;
  ctmIsActive: boolean;
  ctmIsDeleted: boolean;
  ctmSyncDate: string | null;
  ctmCreatedOn: string;
  ctmCreatedBy: string | null;
  ctmModifiedOn: string;
  ctmModifiedBy: string | null;
}

export type CityListItem = CityPayload | Record<string, unknown>;
