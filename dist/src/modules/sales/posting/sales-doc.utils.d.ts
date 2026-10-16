import { Prisma } from '@prisma/client';
export declare function round2(v: number): number;
export declare function round4(v: number): number;
export declare function money(v: number): string;
export declare function num(v: Prisma.Decimal | number | string | bigint | null | undefined): number;
export declare function isoDate(d: Date | string | null | undefined): string | null;
export declare function isoDateTime(d: Date | null | undefined): string | null;
export declare function isoToday(): string;
export declare function daysBetween(from: string, to: string): number;
export declare function addDays(from: string, days: number): string;
export declare function accYearOf(date: string): string;
export declare function supplyNatureOf(companyStateCode: string | null | undefined, posStateCode: string | null | undefined): 'INTRA' | 'INTER';
export declare function numericTail(refno: string | null | undefined, fallback: bigint): bigint;
export interface TaxBucketRow {
    taxId: string | null;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    acess: number;
}
export declare function bucketTaxes(rows: readonly {
    taxId: string | null;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    acess?: number;
}[]): TaxBucketRow[];
export declare const TENDER_TYPE: {
    readonly CASH: 1;
    readonly CARD: 2;
    readonly UPI: 3;
    readonly WALLET: 4;
    readonly CHEQUE: 5;
    readonly BANK: 6;
    readonly RRN: 7;
    readonly TEMP_CREDIT: 8;
    readonly CREDIT: 9;
    readonly LOYALTY: 10;
    readonly VOUCHER: 11;
};
export declare const SALES_VOUCHER_TYPE: {
    readonly BILL: 3;
    readonly ORDER: 4;
    readonly SALE_RETURN: 18;
    readonly DELIVERY_CHALLAN: 19;
    readonly DC_RETURN: 20;
    readonly TENDER_CHANGE: 22;
};
export declare const SALES_MENU_ID: {
    readonly SALE_BILL: 12;
    readonly SALES_ORDER: 11;
    readonly SALE_RETURN: 13;
    readonly DELIVERY_CHALLAN: 182;
    readonly DC_RETURN: 182;
    readonly TEMP_CREDIT: 12;
};
