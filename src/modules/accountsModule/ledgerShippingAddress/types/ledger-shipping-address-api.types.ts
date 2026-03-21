export interface LedgerShippingAddressErrorDetail {
  field: string;
  message: string;
}

export interface LedgerShippingAddressErrorResponse {
  success: false;
  message: string;
  errors: LedgerShippingAddressErrorDetail[];
}

export interface LedgerShippingAddressSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface LedgerShippingAddressPayload {
  saaId: string;
  saaCompanyId: string | null;
  saaLedgerId: string;
  saaAddrType: string;
  saaIsDefault: boolean;
  saaSort: number;
  saaTrdnm: string | null;
  saaContactName: string | null;
  saaAddr1: string | null;
  saaAddr2: string | null;
  saaAddr3: string | null;
  saaLoc: string | null;
  saaPin: string | null;
  saaStateCode: string | null;
  saaStateName: string | null;
  saaDistanceKm: number | null;
  saaPhone: string | null;
  saaEmail: string | null;
  saaGstin: string | null;
  saaPan: string | null;
  saaSyncDate: string | null;
  saaIsActive: boolean;
  saaIsDeleted: boolean;
  saaCreatedOn: string;
  saaCreatedBy: string | null;
  saaModifiedOn: string;
  saaModifiedBy: string | null;
  saaRemarks: string | null;
}

export type LedgerShippingAddressListItem = LedgerShippingAddressPayload | Record<string, unknown>;

export interface LedgerShippingAddressListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
