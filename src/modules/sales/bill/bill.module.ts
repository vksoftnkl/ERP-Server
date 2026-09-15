import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { BillController } from './bill.controller';
import { BillExceptionFilter } from './bill-exception.filter';
import { BillService } from './bill.service';
import { SaleOrderModule } from '../sale-order/sale-order.module';
import { QuotationModule } from '../quotation/quotation.module';
@Module({
  // ChargeDetailModule / TenderDetailModule export the services that own the
  // bill's applied charge lines (txn_charge_detail) and its tendered amounts
  // (acc_tender_detail).
  //
  // SaleOrderModule exports the service that owns sale_order_item's fulfilment
  // caches: a bill converted from an order hands it the lines it drew down. The
  // edge points one way only, so no forwardRef is needed.
  //
  // QuotationModule is the same shape: it owns sale_quotation's conversion
  // columns, and a bill raised from a quotation hands it the reference so the
  // quote can be stamped CONVERTED.
  imports: [
    AuditLogModule,
    ChargeDetailModule,
    TenderDetailModule,
    SaleOrderModule,
    QuotationModule,
  ],
  controllers: [BillController],
  providers: [BillService, BillExceptionFilter],
  exports: [BillService],
})
export class BillModule {}
