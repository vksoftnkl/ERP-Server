import { Module } from '@nestjs/common';
import { CommonPostingModule } from '../../../common/posting/posting.module';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { TillModule } from '../../till/till.module';
import { TenderSettlementController } from './tender-settlement.controller';
import { TenderSettlementExceptionFilter } from './tender-settlement-exception.filter';
import { TenderSettlementExceptionService } from './tender-settlement-exceptions.service';
import { TenderSettlementService } from './tender-settlement.service';

/** Non-cash tender control, layers 3 and 4 (/tender-settlement/*) — plan-noncash-tender-control §5–§7. */
@Module({
  imports: [CommonPostingModule, AppSettingsModule, TillModule],
  controllers: [TenderSettlementController],
  providers: [
    TenderSettlementService,
    TenderSettlementExceptionService,
    TenderSettlementExceptionFilter,
  ],
})
export class TenderSettlementModule {}
