import type { SupplyNature } from '../../../accountsModule/ledgerRole/ledger-map.helper';
export interface SalesLeg {
    role?: string | null;
    ledgerId?: string | null;
    drCr: 'DR' | 'CR';
    amount: number;
    taxId?: string | null;
    supplyNature?: SupplyNature | null;
    remarks?: string | null;
    docId?: string | null;
    docAccYear?: string | null;
    docRefno?: string | null;
    field?: string;
    roleTag?: string | null;
}
export interface SalesVoucherHeader {
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    accYear: string;
    voucherTypeId: number;
    voucherDate: string;
    srcModule: 'SALES';
    srcDocType: string;
    srcDocId: string;
    docRefno?: string | null;
    docDate?: string | null;
    usrRefno?: string | null;
    docAmount: number;
    roundOff?: number;
    partyId: string;
    userId: string;
    sessionId?: string | null;
    deviceType?: string | null;
    deviceId?: string | null;
    remarks?: string | null;
    deviceCode?: string | null;
    createdBy?: string;
    presetRefno?: string | null;
    presetNo?: bigint | null;
    restateVoucherId?: string | null;
}
export interface SalesLegSource {
    header: SalesVoucherHeader;
    legs: SalesLeg[];
}
export interface SalesPostingResult {
    voucherId: string;
    voucherNo: string | null;
    voucherRefno: string | null;
    voucherSlno: bigint;
    voucherLastNo: bigint;
    postedOn: Date;
    totalDebit: number;
    totalCredit: number;
    legCount: number;
}
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
