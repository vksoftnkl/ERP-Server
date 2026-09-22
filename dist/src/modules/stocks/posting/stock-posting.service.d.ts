import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { StockLedgerSourceLabel } from '../stock-voucher/stock-voucher-posting.helper';
import { StockVoucherSource } from './stock-voucher.source';
export declare class StockPostingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    post(tx: Prisma.TransactionClient, source: StockVoucherSource, opts: {
        actor: string;
        postedOn: Date;
        ledgerSource?: StockLedgerSourceLabel;
    }): Promise<number>;
    cancel(tx: Prisma.TransactionClient, source: StockVoucherSource, opts: {
        actor: string;
        reason: string;
        cancelledOn: Date;
    }): Promise<number>;
    private assertNotFrozen;
}
