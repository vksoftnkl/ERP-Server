export interface AccountLedgerMasterErrorDetail {
  field: string;
  message: string;
}

export interface AccountLedgerMasterErrorResponse {
  success: false;
  message: string;
  errors: AccountLedgerMasterErrorDetail[];
}

export interface AccountLedgerMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface AccountLedgerMasterPayload {
  ledId: string;
  ledCompanyId: string | null;
  ledGroupId: string;
  ledName: string;
  ledAlias: string | null;
  ledShort: string | null;
  ledTallyName: string | null;
  ledTallyGroupName: string | null;
  ledTallyGuid: string | null;
  ledCategory: string;
  ledIsBillByBill: boolean;
  ledIsCostCenterReq: boolean;
  ledIsInterestApplicable: boolean;
  ledInterestRate: number | null;
  ledContactPerson: string | null;
  ledEmail: string | null;
  ledTel: string | null;
  ledPhone1: string | null;
  ledPhone2: string | null;
  ledWhatsappNo: string | null;
  ledAddr1: string | null;
  ledAddr2: string | null;
  ledAddr3: string | null;
  ledCity: string | null;
  ledDistrict: string | null;
  ledStateName: string | null;
  ledStateCode: string | null;
  ledPin: string | null;
  ledCountry: string | null;
  ledRegionAddr1: string | null;
  ledRegionAddr2: string | null;
  ledRegionAddr3: string | null;
  ledRegionCity: string | null;
  ledRegionDistrict: string | null;
  ledRegionStateName: string | null;
  ledRegionCountry: string | null;
  ledGstPartyRegType: string | null;
  ledGstinNo: string | null;
  ledPanNo: string | null;
  ledAadharNo: string | null;
  ledEcommerceGstin: string | null;
  ledIsSez: boolean;
  ledChequeName: string | null;
  ledBankName: string | null;
  ledBankBranch: string | null;
  ledBankAcNo: string | null;
  ledBankIfsc: string | null;
  ledUpiId: string | null;
  ledObAmount: number;
  ledObType: string;
  ledObAsOn: string | null;
  ledIsActive: boolean;
  ledIsDeleted: boolean;
  ledAllowEdit: boolean;
  ledIsEntry: boolean;
  ledAllowSms: boolean;
  ledRemarks: string | null;
  ledSyncDate: string | null;
  ledCreatedOn: string;
  ledCreatedBy: string | null;
  ledModifiedOn: string;
  ledModifiedBy: string | null;
}

export type AccountLedgerMasterListItem = AccountLedgerMasterPayload | Record<string, unknown>;

export interface AccountLedgerMasterListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
