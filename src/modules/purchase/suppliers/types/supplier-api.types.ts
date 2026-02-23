export interface SupplierErrorDetail {
  field: string;
  message: string;
}

export interface SupplierErrorResponse {
  success: false;
  message: string;
  errors: SupplierErrorDetail[];
}

export interface SupplierSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface SupplierPayload {
  supId: string;
  supCompanyId: string | null;
  supBranchId: string | null;
  supGroupId: string;
  supPurchaseType: string;
  supName: string;
  supShort: string | null;
  supAddr1: string | null;
  supAddr2: string | null;
  supAddr3: string | null;
  supCity: string | null;
  supDistrict: string | null;
  supStateName: string;
  supCountry: string | null;
  supPincode: string | null;
  supTel: string | null;
  supPhone: string | null;
  supMailId: string | null;
  supWhatsappNo: string | null;
  supWebsiteAddress: string | null;
  supChequePreName: string | null;
  supNotes: string | null;
  supCreditDays: number;
  supCashDiscPerc: number;
  supCollectionDays: number[];
  supGstNo: string | null;
  supStateCode: string;
  supPanNo: string | null;
  supGstType: string;
  supSupCst: string | null;
  supDrugLiscenceNo: string | null;
  supRegionName: string | null;
  supRegionAddr1: string | null;
  supRegionAddr2: string | null;
  supRegionAddr3: string | null;
  supRegionCity: string | null;
  supRegionDistrict: string | null;
  supRegionStateName: string | null;
  supRegionCountry: string | null;
  supBilledDate: string | null;
  supSortOrder: number | null;
  supIsActive: boolean;
  supIsDeleted: boolean;
  supSyncDate: string | null;
  supCreatedOn: string;
  supCreatedBy: string | null;
  supModifiedOn: string;
  supModifiedBy: string | null;
  supStateId: string | null;
}

export type SupplierListItem = SupplierPayload | Record<string, unknown>;

export interface SupplierListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
