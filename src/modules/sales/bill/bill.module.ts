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
import { SaleOrderModule } from '../sale-order/sale-order.module';
import { QuotationModule } from '../quotation/quotation.module';
import { SalesPostingModule } from '../posting/posting.module';
import { BillBalanceModule } from '../../accountsModule/billBalance/bill-balance.module';

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
  ],
  controllers: [BillController],
  providers: [
    BillService,
    BillReadService,
    BillLifecycleService,
    BillBandService,
    BillRetenderService,
    BillExceptionFilter,
  ],
  exports: [BillService, BillReadService],
})
export class BillModule {}
