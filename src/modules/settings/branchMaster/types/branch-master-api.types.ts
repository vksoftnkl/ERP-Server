import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
export type BranchMasterErrorDetail = ModuleApiErrorDetail;
export type BranchMasterErrorResponse = ModuleApiErrorResponse<BranchMasterErrorDetail>;
export type BranchMasterSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

export interface BranchMasterPayload {
  brId: string;
  compId: string;
  compName?: string | null;
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
  brPin: number | null;
  brCountry: string;
  brLandmark: string | null;
  brRegionAddr1: string | null;
  brRegionAddr2: string | null;
  brRegionAddr3: string | null;
  brRegionCity: string | null;
  brRegionDistrict: string | null;
  brRegionState: string | null;
  brRegionCountry: string | null;
  brRegionName: string | null;
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
  brBankName?: string | null;
  brFssaiNo: string | null;
  brFssaiLicenseType: string | null;
  brFssaiValidUpto: string | null;
  brGstinNo: string | null;
  brGstRegType: string | null;
  brPanNo: string | null;
  brIsDeleted: boolean;
  brSyncDate: string | null;
  brCreatedOn: string;
  brCreatedBy: string | null;
  brModifiedOn: string;
  brModifiedBy: string | null;
}
