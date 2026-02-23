export interface SupplierGroupErrorDetail {
  field: string;
  message: string;
}

export interface SupplierGroupErrorResponse {
  success: false;
  message: string;
  errors: SupplierGroupErrorDetail[];
}

export interface SupplierGroupSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface SupplierGroupPayload {
  spgId: string;
  spgName: string;
  spgAlias: string | null;
  spgShort: string | null;
  spgDesc: string | null;
  spgIsActive: boolean;
  spgIsDeleted: boolean;
  spgSyncDate: string | null;
  spgCreatedOn: string;
  spgCreatedBy: string | null;
  spgModifiedOn: string;
  spgModifiedBy: string | null;
}

export type SupplierGroupListItem = SupplierGroupPayload | Record<string, unknown>;

export interface SupplierGroupListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
