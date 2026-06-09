import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { GridDetailExceptionFilter } from './grid-detail-exception.filter';
import { GridDetailsController } from './grid-details.controller';
import { GridDetailsService } from './grid-details.service';
@Module({
  imports: [AuditLogModule],
  controllers: [GridDetailsController],
  providers: [GridDetailsService, GridDetailExceptionFilter],
})
export class GridDetailsModule {}