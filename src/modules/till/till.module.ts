import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../settings/appSettings/app-settings.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CommonPostingModule } from '../../common/posting/posting.module';
import { TillController } from './till.controller';
import { TillMastersController } from './till-masters.controller';
import { TillExceptionFilter } from './till-exception.filter';
import { TillContextService } from './till-context.service';
import { TillApprovalService } from './services/till-approval.service';
import { TillDayService } from './services/till-day.service';
import { TillEventService } from './services/till-event.service';
import { TillLedgerService } from './services/till-ledger.service';
import { TillMastersService } from './services/till-masters.service';
import { TillMovementService } from './services/till-movement.service';
import { TillPostingService } from './services/till-posting.service';
import { TillSessionService } from './services/till-session.service';
import { TillSlipCheckService } from './services/till-slip-check.service';

/**
 * Till management (TILL_DESIGN.md REV 1, build phase 1) — /api/v1/till/*.
 *
 * The settings resolver (the till.* keys), the one posting routine (TFlt /
 * TDrp / TVar go through VoucherPostingService like every other voucher), and
 * the audit log for the masters. TillSessionService is exported for the money
 * paths' `resolveForMoney` check (§7.4); TillApprovalService for the rules a
 * payment or an expense reports (plan-till-receipt-payment-expense §3.3 / §4.3).
 */
@Module({
  imports: [AppSettingsModule, AuditLogModule, CommonPostingModule],
  controllers: [TillController, TillMastersController],
  providers: [
    TillApprovalService,
    TillContextService,
    TillDayService,
    TillEventService,
    TillLedgerService,
    TillPostingService,
    TillSessionService,
    TillMastersService,
    TillMovementService,
    TillSlipCheckService,
    TillExceptionFilter,
  ],
  exports: [TillSessionService, TillApprovalService, TillEventService],
})
export class TillModule {}
