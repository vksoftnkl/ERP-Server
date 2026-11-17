import { Prisma } from '@prisma/client';
type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;
export interface UndeliveredBill {
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    custName: string | null;
    qty: number;
    unitName: string | null;
    baseQty: number;
}
export interface HoldingUndelivered {
    bndBase: Prisma.Decimal;
    bills: UndeliveredBill[];
}
export declare function undeliveredKey(godownId: string, itemId: string, lotId: string | null | undefined, bucket: string | null | undefined): string;
export declare function readHoldingUndelivered(client: Client, scope: {
    companyId: string;
    branchId: string;
    godownIds: readonly string[];
    itemIds: readonly string[];
    withBills?: boolean;
}): Promise<Map<string, HoldingUndelivered>>;
export declare function readSellUnits(client: Client, itemIds: readonly string[]): Promise<Map<string, {
    name: string | null;
    factor: number;
}>>;
export declare function countedFromShelf(shelf: Prisma.Decimal, undelivered: Prisma.Decimal): Prisma.Decimal;
export {};
