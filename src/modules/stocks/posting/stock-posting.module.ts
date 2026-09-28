import { Module } from '@nestjs/common';
import { CommonPostingModule } from '../../../common/posting/posting.module';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { StockVoucherExceptionFilter } from '../stock-voucher/stock-voucher-exception.filter';
import {
  STOCK_COGS_MODE_PROVIDER,
  StockAccountsPostingService,
} from './stock-accounts-posting.service';
import { StockAdminController } from './stock-admin.controller';
import { StockAdminService } from './stock-admin.service';
import { StockCogsModeService } from './stock-cogs-mode.service';
import { StockPostingService } from './stock-posting.service';

/**
 * §3.1 — the one stock engine, as a module every document that moves stock
 * imports.
 *
 * No document route here: nothing posts stock by URL. A document module
 * imports this, hands the service a `StockLineSource`, and the phases run in
 * exactly one place — which is the whole reason this folder exists. The two
 * routes it does carry are administrative (`StockAdminController`).
 *
 * It imports the accounts writer (`CommonPostingModule`) and the settings
 * resolver because a stock post writes its accounts voucher in the same
 * transaction under PERPETUAL (§1.9).
 */
@Module({
  imports: [CommonPostingModule, AppSettingsModule],
  controllers: [StockAdminController],
  providers: [
    StockPostingService,
    StockAccountsPostingService,
    StockCogsModeService,
    STOCK_COGS_MODE_PROVIDER,
    StockAdminService,
    StockVoucherExceptionFilter,
  ],
  exports: [StockPostingService, StockAccountsPostingService],
})
export class StockPostingModule {}
