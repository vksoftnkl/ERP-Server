import { OpeningDrCr, OpeningSource } from '../types/opening-balance-enum';
export declare class SaveOpeningBalanceRowDto {
    opId?: string;
    opLedgerId: string;
    opAmount: number;
    opDrCr: OpeningDrCr;
    opSource?: OpeningSource;
    opRemarks?: string | null;
}
export declare class SaveOpeningBalanceDto {
    opCompanyId: string;
    opBranchId?: string | null;
    opAccYear: string;
    opTenantId?: string | null;
    rows: SaveOpeningBalanceRowDto[];
    replace?: boolean;
}
