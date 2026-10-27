import { Module } from '@nestjs/common';
import { CommonPostingModule } from 'src/common/posting/posting.module';
import { StockPostingModule } from 'src/modules/stocks/posting/stock-posting.module';
import { PurchaseGrnController, PurchaseGrnService } from './grn/purchase-grn';
import { PurchaseInvoiceController } from './invoice/purchase-invoice.controller';
import { PurchaseInvoiceService } from './invoice/purchase-invoice.service';
import { PurchaseOrderController, PurchaseOrderService } from './order/purchase-order';

/**
 * Purchase — plan-purchase-backend.md. B2 calc (common/purchase-calc.ts), B6
 * Purchase Invoice (direct bill), B4 Purchase Order, B5 GRN. Return / claim,
 * shortage receipt, supplier-item and agent routes follow in this module.
 */
@Module({
  imports: [CommonPostingModule, StockPostingModule],
  controllers: [PurchaseInvoiceController, PurchaseOrderController, PurchaseGrnController],
  providers: [PurchaseInvoiceService, PurchaseOrderService, PurchaseGrnService],
})
export class PurchaseModule {}
