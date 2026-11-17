import type { SidedAmount } from 'src/modules/reports/common/voucher-books.sql';
import type { CustomerPayload } from 'src/modules/sales/customer/types/customer-api.types';

/** The list chips on the mobile Customers screen. */
export const MOBILE_CUSTOMER_FILTERS = ['ALL', 'OUTSTANDING', 'UNREGISTERED', 'INACTIVE'] as const;
export type MobileCustomerFilter = (typeof MOBILE_CUSTOMER_FILTERS)[number];

/**
 * What the balance means for the row's right-hand tag.
 *  - OUTSTANDING: the party owes us (DR).
 *  - OVER_LIMIT:  owes us more than its credit amount limit (cusCreditAmtLimit > 0).
 *  - ADVANCE:     we owe the party (CR).
 *  - SETTLED:     0.
 * null when no balance could be read (no company on the login, or no
 * financial year holding today).
 */
export type MobileCustomerBalanceStatus = 'OUTSTANDING' | 'OVER_LIMIT' | 'ADVANCE' | 'SETTLED';

export interface MobileCustomerBalance {
  /** The ledger's closing, today, in the login company: this year's opening set + posted legs. */
  balance: SidedAmount | null;
  balanceStatus: MobileCustomerBalanceStatus | null;
}

/** One row of GET /mobile/customers/list. */
export interface MobileCustomerListItem extends MobileCustomerBalance {
  cusId: string;
  cusName: string | null;
  cusShort: string | null;
  cusCode: string | null;
  cusCity: string | null;
  cusAreaName: string | null;
  cusPhone1: string | null;
  cusWhatsappNo: string | null;
  cusGstNo: string | null;
  cusGstType: string | null;
  cusIsActive: boolean;
  /** Two decimals, as text. 0.00 = no limit. */
  cusCreditAmtLimit: string;
}

/** Chip counts, with the search applied and the filter not. */
export interface MobileCustomerCounts {
  all: number;
  outstanding: number;
  unregistered: number;
  inactive: number;
}

export interface MobileCustomerListPayload {
  items: MobileCustomerListItem[];
  counts: MobileCustomerCounts;
  /** Rows matching the search AND the filter. */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** The day the balances are read at (database CURRENT_DATE), null when none were read. */
  balanceAsOn: string | null;
  /** The financial year the balances come from, null when none were read. */
  accYear: string | null;
}

/** GET /mobile/customers/get: the desktop customer payload plus its balance. */
export type MobileCustomerDetail = CustomerPayload & MobileCustomerBalance;

export interface MobileCustomerOption {
  id: string;
  name: string;
}

export interface MobileCustomerFormOptions {
  areas: Array<MobileCustomerOption & { cityName: string | null }>;
  groups: MobileCustomerOption[];
  priceLevels: Array<{ id: number; name: string }>;
  states: Array<{ code: string; name: string }>;
  gstTypes: readonly string[];
}
