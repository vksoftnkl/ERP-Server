import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PromotionLoyaltyPointsController } from './promotion-loyalty-points.controller';
import { PromotionLoyaltyPointsExceptionFilter } from './promotion-loyalty-points-exception.filter';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PromotionLoyaltyPointsController],
  providers: [PromotionLoyaltyPointsService, PromotionLoyaltyPointsExceptionFilter],
})
export class PromotionLoyaltyPointsModule {}
