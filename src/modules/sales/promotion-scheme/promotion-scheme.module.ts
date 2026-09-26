import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { PromotionSchemeController } from './promotion-scheme.controller';
import { PromotionSchemeExceptionFilter } from './promotion-scheme-exception.filter';
import { PromotionSchemeService } from './promotion-scheme.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PromotionSchemeController],
  providers: [PromotionSchemeService, PromotionSchemeExceptionFilter],
  exports: [PromotionSchemeService],
})
export class PromotionSchemeModule {}
