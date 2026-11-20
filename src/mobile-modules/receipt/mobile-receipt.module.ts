import { Module } from '@nestjs/common';
import { ReceiptModule } from '../../modules/accountsModule/receipt/receipt.module';
import { ReceiptExceptionFilter } from '../../modules/accountsModule/receipt/receipt-exception.filter';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileReceiptController } from './mobile-receipt.controller';
import { MobileReceiptService } from './mobile-receipt.service';
import { MobileReceiptStatusService } from './mobile-receipt-status.service';

/** /mobile/receipts: money collected by the salesman (saved and posted at once). */
@Module({
  imports: [ReceiptModule],
  controllers: [MobileReceiptController],
  providers: [
    MobileReceiptService,
    MobileReceiptStatusService,
    ReceiptExceptionFilter,
    MobileExceptionFilter,
  ],
})
export class MobileReceiptModule {}
