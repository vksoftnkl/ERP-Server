export interface CompanyMasterErrorDetail {
  field: string;
  message: string;
}

export interface CompanyMasterErrorResponse {
  success: false;
  message: string;
  errors: CompanyMasterErrorDetail[];
}

export interface CompanyMasterSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface CompanyMasterPayload {
  compId: string;
  compCode: string | null;
  compName: string;
  compShort: string | null;
  compLegalName: string | null;
  compGstinNo: string | null;
  compGstRegType: string | null;
  compPanNo: string | null;
  compFssaiNo: string | null;
  compDrugLicenseNo: string | null;
  compAddr1: string | null;
  compAddr2: string | null;
  compAddr3: string | null;
  compCity: string | null;
  compDistrict: string | null;
  compState: string | null;
  compStateCode: string;
  compPin: number | null;
  compCountry: string;
  compRegionAddr1: string | null;
  compRegionAddr2: string | null;
  compRegionAddr3: string | null;
  compRegionCity: string | null;
  compRegionDistrict: string | null;
  compRegionState: string | null;
  compRegionCountry: string | null;
  compTel: string | null;
  compPhone: string | null;
  compMail: string | null;
  compSupportEmail: string | null;
  compSupportPhone: string | null;
  compWebsiteName: string | null;
  compFinYearFrom: string | null;
  compFinYearTo: string | null;
  compBooksBeginFrom: string | null;
  compGstApplicable: boolean;
  compTcsApplicable: boolean;
  compSmsApplicable: boolean;
  compEinvoiceApplicable: boolean;
  compEwayApplicable: boolean;
  compEwayDate: string | null;
  compEwayInterLimit: number | null;
  compEwayIntraApl: boolean;
  compEwayIntraLimit: number;
  compEinvoiceDate: string | null;
  compEinvoiceInclEway: boolean | null;
  compStylesheetId: string | null;
  compBankId: string | null;
  compPriceFixing: string | null;
  compPrefixCode: string | null;
  compBillGreeting: string | null;
  compNegStkApl: boolean;
  compDefault: boolean;
  compIsActive: boolean;
  compCurrencyCode: string;
  compCurrencySymbol: string | null;
  compLocaleCode: string;
  compRemarks: string | null;
  compIsDeleted: boolean;
  compSyncDate: string | null;
  compCreatedOn: string;
  compCreatedBy: string | null;
  compModifiedOn: string;
  compModifiedBy: string | null;
}

export type CompanyMasterListItem = CompanyMasterPayload | Record<string, unknown>;

export interface CompanyMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
