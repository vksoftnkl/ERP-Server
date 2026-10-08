import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { StockVoucherModule } from '../stock-voucher/stock-voucher.module';
import { StockAdjustmentController } from './stock-adjustment.controller';
import { StockAdjustmentService } from './stock-adjustment.service';
import { StockReasonsController } from './stock-reasons.controller';
import { StockReasonsService } from './stock-reasons.service';

/**
 * The adjustment family — ADJUSTMENT, ISSUE, DAMAGE, EXPIRY_WRITEOFF and the
 * re-lot pair — plus the stock reason master's picker and maintenance. One
 * module, one screen; the type is a selector, not a route
 * (plan-nestjs-stock-adjustments §0).
 */
@Module({
  imports: [StockVoucherModule, AppSettingsModule],
  controllers: [StockAdjustmentController, StockReasonsController],
  providers: [StockAdjustmentService, StockReasonsService],
  exports: [StockAdjustmentService, StockReasonsService],
})
export class StockAdjustmentModule {}
