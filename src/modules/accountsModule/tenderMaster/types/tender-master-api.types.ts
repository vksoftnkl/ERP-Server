export interface TenderMasterErrorDetail {
  field: string;
  message: string;
}

export interface TenderMasterErrorResponse {
  success: false;
  message: string;
  errors: TenderMasterErrorDetail[];
}

export interface TenderMasterSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface TenderMasterPayload {
  tndId: string;
  tndTypeId: string;
  tndName: string;
  tndLedgerId: string;
  tndMinAmount: number;
  tndMaxAmount: number | null;
  tndDisplayPosition: number;
  tndSurchargePerc: number;
  tndIsActive: boolean;
  tndIsDeleted: boolean;
  tndRemarks: string | null;
  tndEditSurcharge: boolean;
  tndEditLedger: boolean;
  tndSyncDate: string | null;
  tndCreatedOn: string;
  tndCreatedBy: string | null;
  tndModifiedOn: string;
  tndModifiedBy: string | null;
}

export type TenderMasterListItem = TenderMasterPayload | Record<string, unknown>;

export interface TenderMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
