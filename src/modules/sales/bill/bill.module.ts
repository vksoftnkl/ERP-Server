import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { BillController } from './bill.controller';
import { BillExceptionFilter } from './bill-exception.filter';
import { BillService } from './bill.service';
import { BillLifecycleService } from './bill-lifecycle.service';
import { BillReadService } from './bill-read.service';
import { BillBandService } from './bill-band.service';
import { BillRetenderService } from './bill-retender.service';
import { BillVoidService } from './bill-void.service';
import { BillVoucherTypeService } from './bill-voucher-type.service';
import { SaleOrderModule } from '../sale-order/sale-order.module';
import { QuotationModule } from '../quotation/quotation.module';
import { SalesPostingModule } from '../posting/posting.module';
import { BillBalanceModule } from '../../accountsModule/billBalance/bill-balance.module';
import { TillModule } from '../../till/till.module';
import { DeliveryCoreModule } from '../delivery/core/delivery-core.module';

/**
 * ChargeDetailModule / TenderDetailModule export the services that own the
 * bill's applied charge lines (txn_charge_detail) and its tendered amounts
 * (acc_tender_detail).
 *
 * SaleOrderModule owns sale_order_item's fulfilment caches; QuotationModule
 * owns sale_quotation's conversion columns. Both edges point one way.
 *
 * SalesPostingModule (A2) is where the legs, the register, the stock movement,
 * the loyalty ledger, the guards and the settings resolver live — the bill
 * posts THROUGH it and never grows an engine of its own.
 */
@Module({
  imports: [
    AuditLogModule,
    ChargeDetailModule,
    TenderDetailModule,
    SaleOrderModule,
    QuotationModule,
    SalesPostingModule,
    // /bills/retender recomputes the receivable after moving its counter rows.
    BillBalanceModule,
    // The till (§7.4): a bill posted on a counter's device posts in its live
    // session; a cash bill of a counted session is not cancelled (D7); a bill
    // of a live session is voided, not cancelled (void bill REV 2).
    TillModule,
    // Delivery tracking: the bill's computed delivery status and the D6 guards.
    DeliveryCoreModule,
  ],
  controllers: [BillController],
  providers: [
    BillService,
    BillReadService,
    BillLifecycleService,
    BillBandService,
    BillRetenderService,
    // Void bill (REV 2): /bills/void and /bills/void-check — cancel's unwind
    // plus the till_void evidence row and the BILL_VOID event.
    BillVoidService,
    // Voucher Types plan §7.1: /bills/voucher-type-choices.
    BillVoucherTypeService,
    BillExceptionFilter,
  ],
  // BillLifecycleService: the mobile bill upload (src/mobile-modules/bill) saves
  // and posts through saveAndPostInTx inside its own transaction.
  exports: [BillService, BillReadService, BillLifecycleService],
})
export class BillModule {}
