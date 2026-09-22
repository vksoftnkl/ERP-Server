import { Prisma } from '@prisma/client';
import type { StockVoucherTypeRules } from './types/stock-voucher.types';
export declare const STOCK_LEDGER_SRC_MODULE = "STOCK";
export declare function usesInProcessPosting(rules: StockVoucherTypeRules): boolean;
export interface StockLedgerSourceLabel {
    srcModule: 'SALES' | 'PURCHASE' | 'STOCK';
    srcDocType: string;
    srcRefno?: string | null;
    partyId?: string | null;
}
export interface PostStockVoucherParams {
    rules: StockVoucherTypeRules;
    svhId: string;
    accYear: string;
    ledgerSource?: StockLedgerSourceLabel;
    actor: string;
    postedOn: Date;
}
export declare function postStockVoucher(tx: Prisma.TransactionClient, params: PostStockVoucherParams): Promise<number>;
export declare function effectivePolicyLateral(scope: {
    companyId: Prisma.Sql;
    branchId: Prisma.Sql;
    itemId: Prisma.Sql;
    itemGroupId: Prisma.Sql;
    onDate: Prisma.Sql;
}): Prisma.Sql;
export declare function effectivePolicyCte(): Prisma.Sql;
export declare function lotIdentityKeyColumns(): Prisma.Sql;
export declare function unreversedLedgerRow(): Prisma.Sql;
export interface CancelStockVoucherParams {
    rules: StockVoucherTypeRules;
    svhId: string;
    accYear: string;
    actor: string;
    reason: string;
    cancelledOn: Date;
}
export declare function cancelStockVoucher(tx: Prisma.TransactionClient, params: CancelStockVoucherParams): Promise<number>;
export declare function cancelDraftVoucher(tx: Prisma.TransactionClient, params: CancelStockVoucherParams): Promise<number>;
