export type { SalesErrorDetail as CityErrorDetail } from '../../utils/sales-api.types';
export type { SalesErrorResponse as CityErrorResponse } from '../../utils/sales-api.types';
export type { SalesSuccessResponse as CitySuccessResponse } from '../../utils/sales-api.types';
export type { SalesListMeta as CityListMeta } from '../../utils/sales-list.utils';

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
