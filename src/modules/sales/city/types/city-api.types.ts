export interface CityErrorDetail {
  field: string;
  message: string;
}

export interface CityErrorResponse {
  success: false;
  message: string;
  errors: CityErrorDetail[];
}

export interface CitySuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

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

export interface CityListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
