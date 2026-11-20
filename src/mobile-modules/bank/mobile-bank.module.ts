import { Module } from '@nestjs/common';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileBankController } from './mobile-bank.controller';
import { MobileBankService } from './mobile-bank.service';

/** /mobile/banks: the bank list for phone cheques (read-only). */
@Module({
  controllers: [MobileBankController],
  providers: [MobileBankService, MobileExceptionFilter],
})
export class MobileBankModule {}
