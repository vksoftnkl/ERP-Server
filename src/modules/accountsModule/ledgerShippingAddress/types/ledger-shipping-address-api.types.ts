export type { AccountsErrorDetail as LedgerShippingAddressErrorDetail } from '../../utils/accounts-api.types';
export type { AccountsErrorResponse as LedgerShippingAddressErrorResponse } from '../../utils/accounts-api.types';
export type { AccountsSuccessResponse as LedgerShippingAddressSuccessResponse } from '../../utils/accounts-api.types';
export type { AccountsListMeta as LedgerShippingAddressListMeta } from '../../utils/accounts-list.utils';

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
