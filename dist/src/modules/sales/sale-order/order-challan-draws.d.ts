import { Prisma } from '@prisma/client';
export interface ChallanDraw {
    qty: Prisma.Decimal;
    billedAmt: Prisma.Decimal;
}
export declare function challanDrawsOf(tx: Prisma.TransactionClient, soAccYear: string, lines: readonly {
    soiId: string;
    soiLineNo: number;
}[]): Promise<Map<number, ChallanDraw>>;
