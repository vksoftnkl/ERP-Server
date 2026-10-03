import { Prisma } from '@prisma/client';
export interface PpdSlab {
    days: number;
    perc: number;
}
export declare function parsePpdSlabs(raw: string | null | undefined): PpdSlab[];
export declare function suggestPpdDiscount(params: {
    docDate: Date;
    onDate: Date;
    pendingAmount: Prisma.Decimal;
    slabs: readonly PpdSlab[];
}): Prisma.Decimal;
