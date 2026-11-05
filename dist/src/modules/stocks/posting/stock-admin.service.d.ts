import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { StockAccountsPostingService } from './stock-accounts-posting.service';
import { type StockBalanceAssertionScope, type StockBalanceFinding } from './stock-balance-assertion';
import { type StockRebuildOutcome, type StockRebuildScope } from '../stock-voucher/stock-voucher-posting.helper';
export declare class StockAdminService {
    private readonly prisma;
    private readonly accounts;
    private readonly requestContext;
    private readonly logger;
    constructor(prisma: PrismaService, accounts: StockAccountsPostingService, requestContext: RequestContextService);
    postMissingVouchers(companyId: string, accYear: string): Promise<{
        walked: number;
        posted: number;
        skipped: Array<{
            svhId: string;
            refno: string;
            reason: string;
        }>;
    }>;
    assertBalances(scope: StockBalanceAssertionScope): Promise<StockBalanceFinding[]>;
    rebuildCosts(scope: StockRebuildScope, dryRun: boolean): Promise<StockRebuildReport>;
    private itemTotals;
    private lotRatesMoved;
}
export interface StockRebuildItemTotal {
    companyId: string;
    branchId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string | null;
    totalQty: string;
    totalValue: string;
    avgCostRate: string;
}
export interface StockRebuildItemMove extends StockRebuildItemTotal {
    oldTotalQty: string | null;
    oldTotalValue: string | null;
    oldAvgCostRate: string | null;
    valueDifference: string | number;
}
export interface StockRebuildLotRate {
    branchId: string;
    itemCode: string | null;
    itemName: string | null;
    lotId: string;
    batchNo: string | null;
    mrp: string | null;
    onHand: string;
    rate: string;
    value: string;
}
export interface StockRebuildReport {
    dryRun: boolean;
    written: StockRebuildOutcome;
    itemsMoved: StockRebuildItemMove[];
    lotRatesWritten: StockRebuildLotRate[];
    assertion: StockBalanceFinding[];
}
