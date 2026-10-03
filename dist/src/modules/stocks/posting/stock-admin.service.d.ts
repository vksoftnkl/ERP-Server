import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { StockAccountsPostingService } from './stock-accounts-posting.service';
import { type StockBalanceAssertionScope, type StockBalanceFinding } from './stock-balance-assertion';
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
}
