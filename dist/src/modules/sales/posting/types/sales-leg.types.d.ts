import type { SupplyNature } from '../../../accountsModule/ledgerRole/ledger-map.helper';
import type { VoucherHeaderInput, VoucherLeg, VoucherLegSource, VoucherPostingResult } from '../../../../common/posting/voucher-leg.types';
export type SalesLeg = VoucherLeg;
export type SalesVoucherHeader = VoucherHeaderInput;
export type SalesLegSource = VoucherLegSource;
export type SalesPostingResult = VoucherPostingResult;
export interface TaxBucket {
    taxId: string | null;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    acess: number;
}
export interface ChargeLegInput {
    ledgerId: string | null;
    amount: number;
    separatelyPosted: boolean;
    taxId?: string | null;
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
    name?: string | null;
}
export interface TenderLegInput {
    tenderTypeId: number;
    tenderLedgerId: string | null;
    amount: number;
    isLoyalty: boolean;
    isCredit: boolean;
    name?: string | null;
}
export interface BillLegInput {
    partyLedgerId: string;
    supplyNature: SupplyNature;
    salesAmount: number;
    taxes: TaxBucket[];
    charges: ChargeLegInput[];
    cashDiscount: number;
    schemeDiscount: number;
    roundOff: number;
    tcsAmount: number;
    setOffs: SetOffLegInput[];
    tenders: TenderLegInput[];
    cogsAmount: number;
}
export interface ReturnLegInput extends Omit<BillLegInput, 'tcsAmount' | 'setOffs'> {
    tcsAmount?: number;
}
export interface SetOffLegInput {
    ledgerId: string;
    amount: number;
    remarks?: string | null;
}
