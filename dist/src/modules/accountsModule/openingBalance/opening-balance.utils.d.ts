import { Prisma } from '@prisma/client';
import { BillDrCr, OpeningDrCr } from './types/opening-balance-enum';
export declare const ALL_BRANCHES_SENTINEL = "00000000-0000-0000-0000-000000000000";
export declare const ACC_YEAR_PATTERN: RegExp;
export declare const ZERO: Prisma.Decimal;
export declare function isValidAccYear(accYear: string): boolean;
export declare function nextAccYear(accYear: string): string;
export declare function previousAccYear(accYear: string): string;
export declare function isAccYearAfter(candidate: string, reference: string): boolean;
export declare function signedOpening(amount: Prisma.Decimal | string | number, drCr: string): Prisma.Decimal;
export declare function signedBill(amount: Prisma.Decimal | string | number, drCr: string): Prisma.Decimal;
export declare function splitSigned(signed: Prisma.Decimal): {
    amount: Prisma.Decimal;
    drCr: OpeningDrCr;
};
export declare function splitSignedBill(signed: Prisma.Decimal): {
    amount: Prisma.Decimal;
    drCr: BillDrCr;
};
export declare function money(value: Prisma.Decimal | string | number): Prisma.Decimal;
export declare function toAmount(value: Prisma.Decimal | string | number | null | undefined): number;
export declare function toNullableAmount(value: Prisma.Decimal | string | number | null | undefined): number | null;
export declare function toDateString(value: Date | null | undefined): string | null;
export declare function toIsoString(value: Date | null | undefined): string | null;
export declare function toDateOnly(value: string): Date;
export declare function isBillFrozen(bill: {
    ablAllocAmount: Prisma.Decimal;
    ablDiscAmount: Prisma.Decimal;
    ablWriteoffAmount: Prisma.Decimal;
}): boolean;
export declare function settledTotal(bill: {
    ablAllocAmount: Prisma.Decimal;
    ablDiscAmount: Prisma.Decimal;
    ablWriteoffAmount: Prisma.Decimal;
}): Prisma.Decimal;
