import { Prisma } from '@prisma/client';
export interface StockBalanceFinding {
    kind: 'BALANCE_QTY' | 'BALANCE_ORPHAN' | 'ITEM_COST_QTY' | 'ITEM_COST_VALUE' | 'RESERVED' | 'TRANSIT_IN' | 'LOT_TOTAL';
    companyId: string;
    branchId: string | null;
    itemId: string;
    lotId: string | null;
    godownId: string | null;
    bucket: string | null;
    stored: string;
    derived: string;
}
export interface StockBalanceAssertionScope {
    companyId?: string | null;
    branchId?: string | null;
    itemId?: string | null;
}
type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;
export declare function assertStockBalances(client: Client, scope?: StockBalanceAssertionScope): Promise<StockBalanceFinding[]>;
export {};
