export interface AreaErrorDetail {
  field: string;
  message: string;
}

export interface AreaErrorResponse {
  success: false;
  message: string;
  errors: AreaErrorDetail[];
}

export interface AreaSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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

export interface AreaListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
