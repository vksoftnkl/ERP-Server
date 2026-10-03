import { BillDrCr } from '../types/opening-balance-enum';
export declare class SaveOpeningBillRowDto {
    ablId?: string;
    ablDocRefno: string;
    ablDocDate: string;
    ablDueDate?: string | null;
    ablCreditDays?: number;
    ablGraceDays?: number;
    ablDrCr: BillDrCr;
    ablBillAmount: number;
    ablNarration?: string | null;
}
export declare class SaveOpeningBillsDto {
    companyId: string;
    branchId: string;
    accYear: string;
    partyId: string;
    opId?: string;
    tenantId?: string | null;
    bills: SaveOpeningBillRowDto[];
    replace?: boolean;
}
export declare class ListOpeningBillsQueryDto {
    partyId: string;
    companyId: string;
    accYear: string;
    branchId: string;
}
