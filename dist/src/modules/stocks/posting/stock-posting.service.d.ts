import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PostStockVoucherResult, StockLedgerSourceLabel } from '../stock-voucher/stock-voucher-posting.helper';
import { StockAccountsPostingService } from './stock-accounts-posting.service';
import { StockVoucherSource } from './stock-voucher.source';
export interface StockPostOutcome extends PostStockVoucherResult {
    accountsVoucherId: string | null;
}
export declare class StockPostingService {
    private readonly prisma;
    private readonly accounts;
    constructor(prisma: PrismaService, accounts: StockAccountsPostingService);
    post(tx: Prisma.TransactionClient, source: StockVoucherSource, opts: {
        actor: string;
        postedOn: Date;
        ledgerSource?: StockLedgerSourceLabel;
    }): Promise<StockPostOutcome>;
    cancel(tx: Prisma.TransactionClient, source: StockVoucherSource, opts: {
        actor: string;
        reason: string;
        cancelledOn: Date;
        ledgerSource?: StockLedgerSourceLabel;
    }): Promise<number>;
    private assertNotFrozen;
}
