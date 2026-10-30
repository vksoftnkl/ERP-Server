import { Module } from '@nestjs/common';
import { CommonPostingModule } from 'src/common/posting/posting.module';
import { StockPostingModule } from 'src/modules/stocks/posting/stock-posting.module';
import { AccountLedgerMastersModule } from 'src/modules/accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { SellingPriceBulkModule } from 'src/modules/stocks/selling-price-bulk/selling-price-bulk.module';
import { PurchaseAgentController, PurchaseAgentService } from './agent/purchase-agent';
import { PurchaseSupplierItemController, PurchaseSupplierItemService } from './supplier-item/purchase-supplier-item';
import { PurchaseGrnController, PurchaseGrnService, PurchaseLabelsController } from './grn/purchase-grn';
import { PurchaseInvoiceController } from './invoice/purchase-invoice.controller';
import { PurchaseLookupController, PurchaseLookupService } from './lookup/purchase-lookup';
import { PurchaseSisterController, PurchaseSisterService } from './sister/purchase-sister';
import { PurchaseAttachmentController, PurchaseAttachmentService } from './attachment/purchase-attachment';
import { PurchaseInvoiceService } from './invoice/purchase-invoice.service';
import { PurchaseOrderController, PurchaseOrderService } from './order/purchase-order';
import { PurchaseReorderController, PurchaseReorderService } from './reorder/purchase-reorder';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { PurchaseReturnController, PurchaseReturnService } from './return/purchase-return';
import { PurchaseShortageController, PurchaseShortageService } from './shortage/purchase-shortage';
import { TransportBandService } from 'src/modules/sales/posting/transport-band.service';
import { PurchaseSupplierDuesController, PurchaseSupplierDuesService } from './dues/purchase-supplier-dues';
import { PurchaseTermsController, PurchaseTermsService } from './terms/purchase-terms';

/**
 * Purchase — plan-purchase-backend.md. B2 calc (common/purchase-calc.ts), B6
 * Purchase Invoice (direct bill), B4 Purchase Order, B5 GRN, B8 Return / claim, B7 Shortages.
 * Masters: supplier–item map (MST-02, menu 295), agents (MST-05, menu 28), PO terms (pur_terms, rights on menu 23). B9 lookups (supplier / item context).
 */
@Module({
  imports: [AuditLogModule, CommonPostingModule, StockPostingModule, AccountLedgerMastersModule, SellingPriceBulkModule],
  controllers: [PurchaseReorderController, PurchaseInvoiceController, PurchaseOrderController, PurchaseGrnController, PurchaseLabelsController, PurchaseReturnController, PurchaseShortageController,
                PurchaseAgentController, PurchaseSupplierItemController, PurchaseLookupController, PurchaseSisterController, PurchaseAttachmentController, PurchaseSupplierDuesController,
                PurchaseTermsController],
  providers: [PurchaseReorderService, PurchaseInvoiceService, PurchaseOrderService, PurchaseGrnService, PurchaseReturnService, PurchaseShortageService,
              PurchaseAgentService, PurchaseSupplierItemService, PurchaseLookupService, PurchaseSisterService, PurchaseAttachmentService,
              TransportBandService, PurchaseSupplierDuesService, PurchaseTermsService],
})
export class PurchaseModule {}
