export interface PriceLevelMasterErrorDetail {
  field: string;
  message: string;
}

export interface PriceLevelMasterErrorResponse {
  success: false;
  message: string;
  errors: PriceLevelMasterErrorDetail[];
}

export interface PriceLevelMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

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
