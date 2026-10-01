import { StockAdminService } from './stock-admin.service';
import type { StockBalanceFinding } from './stock-balance-assertion';
export declare class PostMissingVouchersQueryDto {
    companyId: string;
    accYear: string;
}
export declare class BalanceAssertionQueryDto {
    companyId?: string;
    branchId?: string;
    itemId?: string;
}
export declare class StockAdminController {
    private readonly admin;
    constructor(admin: StockAdminService);
    postMissingVouchers(query: PostMissingVouchersQueryDto): Promise<{
        success: true;
        message: string;
        data: {
            walked: number;
            posted: number;
            skipped: Array<{
                svhId: string;
                refno: string;
                reason: string;
            }>;
        };
    }>;
    balanceAssertion(query: BalanceAssertionQueryDto): Promise<{
        success: true;
        message: string;
        data: StockBalanceFinding[];
    }>;
}
