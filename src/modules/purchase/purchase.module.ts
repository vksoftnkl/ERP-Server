import { Module } from '@nestjs/common';
import { CommonPostingModule } from 'src/common/posting/posting.module';
import { StockPostingModule } from 'src/modules/stocks/posting/stock-posting.module';
import { AccountLedgerMastersModule } from 'src/modules/accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { SellingPriceBulkModule } from 'src/modules/stocks/selling-price-bulk/selling-price-bulk.module';
import { PurchaseAgentController, PurchaseAgentService } from './agent/purchase-agent';
import { PurchaseSupplierItemController, PurchaseSupplierItemService } from './supplier-item/purchase-supplier-item';
import { PurchaseGrnController, PurchaseGrnService } from './grn/purchase-grn';
import { PurchaseInvoiceController } from './invoice/purchase-invoice.controller';
import { PurchaseLookupController, PurchaseLookupService } from './lookup/purchase-lookup';
import { PurchaseInvoiceService } from './invoice/purchase-invoice.service';
import { PurchaseOrderController, PurchaseOrderService } from './order/purchase-order';
import { PurchaseReturnController, PurchaseReturnService } from './return/purchase-return';
import { PurchaseShortageController, PurchaseShortageService } from './shortage/purchase-shortage';

/**
 * Purchase — plan-purchase-backend.md. B2 calc (common/purchase-calc.ts), B6
 * Purchase Invoice (direct bill), B4 Purchase Order, B5 GRN, B8 Return / claim, B7 Shortages.
 * Masters: supplier–item map (MST-02, menu 295), agents (MST-05, menu 28). B9 lookups (supplier / item context).
 */
@Module({
  imports: [CommonPostingModule, StockPostingModule, AccountLedgerMastersModule, SellingPriceBulkModule],
  controllers: [PurchaseInvoiceController, PurchaseOrderController, PurchaseGrnController, PurchaseReturnController, PurchaseShortageController,
                PurchaseAgentController, PurchaseSupplierItemController, PurchaseLookupController],
  providers: [PurchaseInvoiceService, PurchaseOrderService, PurchaseGrnService, PurchaseReturnService, PurchaseShortageService,
              PurchaseAgentService, PurchaseSupplierItemService, PurchaseLookupService],
})
export class PurchaseModule {}
