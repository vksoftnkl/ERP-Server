export type { AccountsErrorDetail as LedgerShippingAddressErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as LedgerShippingAddressErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as LedgerShippingAddressSuccessResponse } from 'src/common/types/module-api.types';
export type { AccountsListMeta as LedgerShippingAddressListMeta } from 'src/common/types/module-list.types';

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
