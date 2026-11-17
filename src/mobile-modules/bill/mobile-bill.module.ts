import { Module } from '@nestjs/common';
import { BillModule } from '../../modules/sales/bill/bill.module';
import { BillExceptionFilter } from '../../modules/sales/bill/bill-exception.filter';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileBillController } from './mobile-bill.controller';
import { MobileBillService } from './mobile-bill.service';

/** /mobile/bills: bill upload (saved and posted at once) from the React Native salesman app. */
@Module({
  imports: [BillModule],
  controllers: [MobileBillController],
  providers: [MobileBillService, BillExceptionFilter, MobileExceptionFilter],
})
export class MobileBillModule {}
