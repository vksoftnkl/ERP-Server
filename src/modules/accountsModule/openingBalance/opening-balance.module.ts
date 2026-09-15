import { Module } from '@nestjs/common';
import { OpeningBalanceController } from './opening-balance.controller';
import { OpeningBalanceExceptionFilter } from './opening-balance-exception.filter';
import { OpeningBalanceService } from './opening-balance.service';
import { BillWiseService } from './bill-wise.service';
import { CarryForwardService } from './carry-forward.service';

@Module({
  controllers: [OpeningBalanceController],
  providers: [
    OpeningBalanceService,
    BillWiseService,
    CarryForwardService,
    OpeningBalanceExceptionFilter,
  ],
  // CarryForwardService is exported for the scheduled caller this will grow,
  // and OpeningBalanceService because closingByLedger() is the module's one
  // definition of "what was this ledger worth at the year end".
  exports: [OpeningBalanceService, CarryForwardService],
})
export class OpeningBalanceModule {}
