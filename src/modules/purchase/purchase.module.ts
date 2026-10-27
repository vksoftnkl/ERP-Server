import { Module } from '@nestjs/common';
import { CommonPostingModule } from 'src/common/posting/posting.module';
import { StockPostingModule } from 'src/modules/stocks/posting/stock-posting.module';
import { PurchaseInvoiceController } from './invoice/purchase-invoice.controller';
import { PurchaseInvoiceService } from './invoice/purchase-invoice.service';

/**
 * Purchase — plan-purchase-backend.md. B2 calc (common/purchase-calc.ts) + B6
 * Purchase Invoice (direct bill). GRN, PO, return / claim, shortage receipt,
 * supplier-item and agent routes follow in this module.
 */
@Module({
  imports: [CommonPostingModule, StockPostingModule],
  controllers: [PurchaseInvoiceController],
  providers: [PurchaseInvoiceService],
})
export class PurchaseModule {}
