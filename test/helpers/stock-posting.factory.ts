import type { PrismaService } from '../../src/database/prisma/prisma.service';
import { VoucherPostingService } from '../../src/common/posting/voucher-posting.service';
import { StockAccountsPostingService } from '../../src/modules/stocks/posting/stock-accounts-posting.service';
import { StockPostingService } from '../../src/modules/stocks/posting/stock-posting.service';
import type { CogsMode } from '../../src/modules/stocks/posting/stock-cogs-mode.service';

/**
 * The one stock engine, built the way the e2e suites need it: a REAL accounts
 * writer (so an opening's DR INVENTORY leg is actually written and can be
 * asserted) and a cogs-mode resolver pinned by the test rather than read from
 * app settings, so a suite can run both PERPETUAL and PERIODIC deliberately.
 */
export function buildStockPosting(
  prisma: PrismaService,
  cogsMode: CogsMode = 'PERPETUAL',
): { stockPosting: StockPostingService; stockAccounts: StockAccountsPostingService } {
  const stockAccounts = new StockAccountsPostingService(new VoucherPostingService(prisma), {
    cogsMode: async () => cogsMode,
  });
  return { stockPosting: new StockPostingService(prisma, stockAccounts), stockAccounts };
}
