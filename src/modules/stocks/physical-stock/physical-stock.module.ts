import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { PhysicalStockController } from './physical-stock.controller';
import { PhysicalStockExceptionFilter } from './physical-stock-exception.filter';
import { PhysicalStockService } from './physical-stock.service';
@Module({
  imports: [AuditLogModule],
  controllers: [PhysicalStockController],
  providers: [PhysicalStockService, PhysicalStockExceptionFilter],
})
export class PhysicalStockModule {}
