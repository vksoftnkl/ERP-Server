export interface CustomerErrorDetail {
  field: string;
  message: string;
}

export interface CustomerErrorResponse {
  success: false;
  message: string;
  errors: CustomerErrorDetail[];
}

export interface CustomerSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface CustomerPayload {
  cusId: string;
  cusTitle: string | null;
  cusShort: string | null;
  cusCode: string | null;
  cusName: string | null;
  cusAddr1: string | null;
  cusAddr2: string | null;
  cusAddr3: string | null;
  cusCity: string | null;
  cusDistrict: string | null;
  cusStateName: string;
  cusCountry: string | null;
  cusStateCode: string;
  cusLandmark: string | null;
  cusPin: string | null;
  cusTel: string | null;
  cusPhone1: string | null;
  cusPhone2: string | null;
  cusWhatsappNo: string | null;
  cusEmail: string | null;
  cusAadharNo: string | null;
  cusContactPerson: string | null;
  cusDistanceKm: number | null;
  cusCreditAllowed: boolean;
  cusCreditBillLimit: number;
  cusCreditAmtLimit: number;
  cusCreditDays: number;
  cusDebitBalance: number;
  cusDiscPerc: number;
  cusDebitGraceDays: number;
  cusEnableSms: boolean;
  cusOverdueSms: boolean;
  cusOverdueBilling: boolean;
  cusAllowPromotion: boolean;
  cusAllowLoyalty: boolean;
  cusAllowDiscount: boolean;
  cusSortOrder: number;
  cusRegionName: string | null;
  cusRegionAddr1: string | null;
  cusRegionAddr2: string | null;
  cusRegionAddr3: string | null;
  cusRegionCity: string | null;
  cusRegionDistrict: string | null;
  cusRegionStateName: string | null;
  cusRegionCountry: string | null;
  cusBirthDate: string | null;
  cusMarriageDate: string | null;
  cusTransportName: string | null;
  cusFreightCharge: boolean;
  cusLoadingCharge: boolean;
  cusUnloadingCharge: boolean;
  cusGstNo: string | null;
  cusPanNo: string | null;
  cusGstType: string | null;
  cusEcommerceGstin: string | null;
  cusTcsApplicable: boolean;
  cusItcollExempted: boolean;
  cusItcollType: string | null;
  cusGeoLocation: string | null;
  cusCollectionDays: number[];
  cusDefaultSalesman: string | null;
  cusPriceLevelId: number;
  cusBilledDate: string | null;
  cusBilledCount: number;
  cusNotes: string | null;
  cusCompanyId: string | null;
  cusBranchId: string | null;
  cusAreaId: string;
  cusGroupId: string;
  cusIsActive: boolean;
  cusIsDeleted: boolean;
  cusSyncDate: string | null;
  cusCreatedOn: string;
  cusCreatedBy: string | null;
  cusModifiedOn: string;
  cusModifiedBy: string | null;
}

export type CustomerListItem = CustomerPayload | Record<string, unknown>;

export interface CustomerListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
