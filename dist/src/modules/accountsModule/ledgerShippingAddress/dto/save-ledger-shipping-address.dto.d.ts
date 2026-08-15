import { SaaAddrType } from '../types/ledger-shipping-address-enum';
export declare class SaveLedgerShippingAddressDto {
    saaId?: string;
    saaCompanyId?: string | null;
    saaBranchId?: string | null;
    saaLedgerId: string;
    saaAddrType?: SaaAddrType;
    saaIsDefault?: boolean;
    saaSort?: number;
    saaTradeName?: string | null;
    saaContactName?: string | null;
    saaAddr1?: string | null;
    saaAddr2?: string | null;
    saaAddr3?: string | null;
    saaLocation?: string | null;
    saaPin?: string | null;
    saaStateCode?: string | null;
    saaStateName?: string | null;
    saaCountryCode?: string;
    saaDistanceKm?: number | null;
    saaPhone?: string | null;
    saaEmail?: string | null;
    saaGstin: string;
    saaSyncedOn?: Date | null;
    saaIsActive?: boolean;
    saaRemarks?: string | null;
}
