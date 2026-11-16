import { Module } from '@nestjs/common';
import { DeliveryCoreModule } from '../../../sales/delivery/core/delivery-core.module';
import { GodownPositionController } from './godown-position.controller';
import { GodownPositionService } from './godown-position.service';

/**
 * stock/reports/godown-position — Godown Stock Position, menu 306 (delivery
 * tracking plan §8.3). Read-only: Physical = Owned + Billed not delivered,
 * today only. BND comes from the shared §5.1 fragment (delivery core); Prisma
 * and the request context are global. The service is exported for the print
 * providers (P5: GODOWN_POSITION, COUNT_SHEET).
 */
@Module({
  imports: [DeliveryCoreModule],
  controllers: [GodownPositionController],
  providers: [GodownPositionService],
  exports: [GodownPositionService],
})
export class GodownPositionModule {}
