import { VoucherStatus } from '../types/receipt-enum';
export declare class ListOpenItemsQueryDto {
    partyId: string;
    companyId: string;
    onDate?: string;
    mobile?: string;
}
export declare class PartyContextQueryDto {
    partyId: string;
    companyId: string;
}
export declare class AdjacentVoucherQueryDto {
    voucherId: string;
    companyId: string;
    branchId: string;
    accYear: string;
    direction: 'prev' | 'next';
    status?: VoucherStatus;
    fromDate?: string;
    toDate?: string;
}
export declare class DuplicateCheckQueryDto {
    partyId: string;
    companyId: string;
    accYear: string;
    voucherDate: string;
    amount: number;
    excludeVoucherId?: string;
    branchId?: string;
}
