import { Module } from '@nestjs/common';
import { CommonPostingModule } from '../../../common/posting/posting.module';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { TillModule } from '../../till/till.module';
import { TenderDetailModule } from '../tenderDetail/tender-detail.module';
import { ExpenseController } from './expense.controller';
import { ExpenseExceptionFilter } from './expense-exception.filter';
import { ExpenseService } from './expense.service';

/** The expense voucher (ExpV, /expenses/*) — plan-till-receipt-payment-expense §4. */
@Module({
  imports: [CommonPostingModule, TenderDetailModule, TillModule, AppSettingsModule],
  controllers: [ExpenseController],
  providers: [ExpenseService, ExpenseExceptionFilter],
})
export class ExpenseModule {}
