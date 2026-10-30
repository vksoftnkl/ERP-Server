/**
 * till.module.ts — the Nest wiring of /api/v1/till/*.
 *
 * Flow of a request: the app's guard fills RequestContext (user, device) → one of the five
 * controllers (each under TillExceptionFilter) → TillContextService (the right on a till menu,
 * the caller, the till.* settings) → a service → the single writers: TillSessionService for
 * till_session / till_count(_line), TillPostingService for till_cash_movement / till_variance and
 * every till voucher (through CommonPostingModule), TillEventService for till_event (INSERT only).
 *
 * Imports: AppSettingsModule (the till.* keys), AuditLogModule (the masters' audit rows),
 * CommonPostingModule (VoucherPostingService, the menu rights). Exports: what other modules call
 * — the sales / accounts money paths (TillSessionService), the payment / expense gate
 * (TillApprovalService), the journal for a re-tender / void / settlement (TillEventService),
 * print-render's till.* providers (TillPrintService).
 */
import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../settings/appSettings/app-settings.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CommonPostingModule } from '../../common/posting/posting.module';
import { TillController } from './till.controller';
import { TillApprovalController } from './till-approval.controller';
import { TillMastersController } from './till-masters.controller';
import { TillSafeController } from './till-safe.controller';
import { TillReviewController } from './till-review.controller';
import { TillExceptionFilter } from './till-exception.filter';
import { TillContextService } from './till-context.service';
import { TillApprovalService } from './services/till-approval.service';
import { TillApprovalGateService } from './services/till-approval-gate.service';
import { TillDayService } from './services/till-day.service';
import { TillDayCloseService } from './services/till-day-close.service';
import { TillEventService } from './services/till-event.service';
import { TillLedgerService } from './services/till-ledger.service';
import { TillMastersService } from './services/till-masters.service';
import { TillMovementService } from './services/till-movement.service';
import { TillPostingService } from './services/till-posting.service';
import { TillPrintService } from './services/till-print.service';
import { TillReviewService } from './services/till-review.service';
import { TillSafeService } from './services/till-safe.service';
import { TillSessionService } from './services/till-session.service';
import { TillSlipCheckService } from './services/till-slip-check.service';

/**
 * Till management (TILL_DESIGN.md REV 1, build phase 1) — /api/v1/till/*.
 *
 * The settings resolver (the till.* keys), the one posting routine (TFlt /
 * TDrp / TVar go through VoucherPostingService like every other voucher), and
 * the audit log for the masters. TillSessionService is exported for the money
 * paths' `resolveForMoney` check (§7.4); TillApprovalService for the rules a
 * payment or an expense reports (plan-till-receipt-payment-expense §3.3 / §4.3);
 * TillPrintService for the print module's till.* providers (notes 117 §7).
 * TillSafeController / TillSafeService are the safe (notes 118, Cash Office 287).
 * TillApprovalController / TillApprovalGateService are the approval gate's
 * request · decide · cancel · inbox (notes 124 §5).
 * TillReviewController / TillReviewService are head office's reviews of a day
 * or a session (notes 134, Cash Position 289).
 */
@Module({
  imports: [AppSettingsModule, AuditLogModule, CommonPostingModule],
  controllers: [
    TillController,
    TillMastersController,
    TillSafeController,
    TillApprovalController,
    TillReviewController,
  ],
  providers: [
    TillApprovalService,
    TillApprovalGateService,
    TillContextService,
    TillDayService,
    TillDayCloseService,
    TillEventService,
    TillLedgerService,
    TillPostingService,
    TillPrintService,
    TillReviewService,
    TillSafeService,
    TillSessionService,
    TillMastersService,
    TillMovementService,
    TillSlipCheckService,
    TillExceptionFilter,
  ],
  exports: [TillSessionService, TillApprovalService, TillEventService, TillPrintService],
})
export class TillModule {}
