import { Prisma } from '@prisma/client';
export interface OpenBillRoom {
    billId: string;
    billAccYear: string;
    pending: Prisma.Decimal;
}
export interface FilledBill {
    billId: string;
    billAccYear: string;
    amount: Prisma.Decimal;
}
export declare function moneyForBills(tenders: readonly {
    tdAmount: number | string | Prisma.Decimal;
}[], otherLines: readonly {
    drCr: string;
    amount: number | string | Prisma.Decimal;
}[]): Prisma.Decimal;
export declare function fillOldestFirst(bills: readonly OpenBillRoom[], pool: Prisma.Decimal): {
    allocations: FilledBill[];
    onAccount: Prisma.Decimal;
};
