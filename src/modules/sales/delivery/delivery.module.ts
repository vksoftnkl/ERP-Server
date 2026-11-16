import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { SalesPostingModule } from '../posting/posting.module';
import { DeliveryCoreModule } from './core/delivery-core.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { DeliveryExceptionFilter } from './delivery-exception.filter';
import { DeliveryNoteReadService } from './delivery-note-read.service';
import { DeliveryNoteService } from './delivery-note.service';
import { DeliveryNotesController } from './delivery-notes.controller';
import { DeliveryStockCorrectionService } from './delivery-stock-correction.service';

/**
 * Delivery tracking phase 1 (plan sales/plan-delivery-tracking-p1-2026-11-15.md
 * §8): /delivery-notes/* (menu 305) and /deliveries/* (menu 304 / the bill).
 *
 * SalesPostingModule brings the sales context (rights, settings), the
 * transport band and — re-exported — StockPostingModule, through which the
 * lot / godown corrections post. DeliveryCoreModule is the shared §5 core.
 */
@Module({
  imports: [DeliveryCoreModule, SalesPostingModule, AuditLogModule],
  controllers: [DeliveryNotesController, DeliveriesController],
  providers: [
    DeliveryNoteService,
    DeliveryNoteReadService,
    DeliveriesService,
    DeliveryStockCorrectionService,
    DeliveryExceptionFilter,
  ],
  exports: [DeliveryNoteReadService],
})
export class DeliveryModule {}
