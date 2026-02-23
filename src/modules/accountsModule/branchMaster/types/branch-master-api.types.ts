export interface BranchMasterErrorDetail {
  field: string;
  message: string;
}

export interface BranchMasterErrorResponse {
  success: false;
  message: string;
  errors: BranchMasterErrorDetail[];
}

export interface BranchMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface BranchMasterPayload {
  brId: number;
  compId: number;
  brCode: string | null;
  brName: string;
  brMailingName: string | null;
  brAlias: string | null;
  brShort: string | null;
  brType: string | null;
  brIsDefault: boolean;
  brIsActive: boolean;
  brAddr1: string | null;
  brAddr2: string | null;
  brAddr3: string | null;
  brCity: string | null;
  brDistrict: string | null;
  brState: string | null;
  brStateCode: string;
  brPin: string | null;
  brCountry: string;
  brLandmark: string | null;
  brRegionAddr1: string | null;
  brRegionAddr2: string | null;
  brRegionAddr3: string | null;
  brRegionCity: string | null;
  brRegionDistrict: string | null;
  brRegionState: string | null;
  brRegionCountry: string | null;
  brContactPerson: string | null;
  brTel: string | null;
  brPhone: string | null;
  brMail: string | null;
  brBillPrefix: string | null;
  brInvoiceSeriesPrefix: string | null;
  brBillGreeting: string | null;
  brTerms: string | null;
  brRoundingMode: string | null;
  brRoundingValue: number | null;
  brDefaultGodownId: string | null;
  brPosType: string | null;
  brAllowNegativeStock: boolean;
  brSmsApplicable: boolean;
  brBankId: string | null;
  brFssaiNo: string | null;
  brFssaiLicenseType: string | null;
  brFssaiValidUpto: string | null;
  brIsDeleted: boolean;
  brSyncDate: string | null;
  brCreatedOn: string;
  brCreatedBy: string | null;
  brModifiedOn: string;
  brModifiedBy: string | null;
}

export type BranchMasterListItem = BranchMasterPayload | Record<string, unknown>;

export interface BranchMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
