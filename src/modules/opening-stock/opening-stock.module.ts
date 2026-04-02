import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { OpeningStockController } from './opening-stock.controller';
import { OpeningStockExceptionFilter } from './opening-stock-exception.filter';
import { OpeningStockService } from './opening-stock.service';

@Module({
  imports: [AuditLogModule],
  controllers: [OpeningStockController],
  providers: [OpeningStockService, OpeningStockExceptionFilter],
})
export class OpeningStockModule {}
