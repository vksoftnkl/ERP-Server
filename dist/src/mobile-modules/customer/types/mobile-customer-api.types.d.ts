import type { SidedAmount } from "../../../modules/reports/common/voucher-books.sql";
import type { CustomerPayload } from "../../../modules/sales/customer/types/customer-api.types";
export declare const MOBILE_CUSTOMER_FILTERS: readonly ["ALL", "OUTSTANDING", "UNREGISTERED", "INACTIVE"];
export type MobileCustomerFilter = (typeof MOBILE_CUSTOMER_FILTERS)[number];
export type MobileCustomerBalanceStatus = 'OUTSTANDING' | 'OVER_LIMIT' | 'ADVANCE' | 'SETTLED';
export interface MobileCustomerBalance {
    balance: SidedAmount | null;
    balanceStatus: MobileCustomerBalanceStatus | null;
}
export interface MobileCustomerOutstanding {
    outstanding: string | null;
    outstandingBills: number | null;
    oldestBillDate: string | null;
}
export interface MobileCustomerListItem extends MobileCustomerBalance, MobileCustomerOutstanding {
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
    cusCreditAmtLimit: string;
}
export interface MobileCustomerCounts {
    all: number;
    outstanding: number;
    unregistered: number;
    inactive: number;
}
export interface MobileCustomerListPayload {
    items: MobileCustomerListItem[];
    counts: MobileCustomerCounts;
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    balanceAsOn: string | null;
    accYear: string | null;
    companyId: string | null;
}
export type MobileCustomerDetail = CustomerPayload & MobileCustomerBalance & MobileCustomerOutstanding;
export interface MobileCustomerOption {
    id: string;
    name: string;
}
export interface MobileCustomerFormOptions {
    areas: Array<MobileCustomerOption & {
        cityId: string;
        cityName: string | null;
    }>;
    groups: MobileCustomerOption[];
    priceLevels: Array<{
        id: number;
        name: string;
    }>;
    states: Array<{
        code: string;
        name: string;
    }>;
    gstTypes: readonly string[];
}
