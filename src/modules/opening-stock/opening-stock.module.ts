import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemStockLedgerService } from './item-stock-ledger.service';
import { OpeningStockController } from './opening-stock.controller';
import { OpeningStockExceptionFilter } from './opening-stock-exception.filter';
import { OpeningStockService } from './opening-stock.service';
@Module({
  imports: [AuditLogModule],
  controllers: [OpeningStockController],
  providers: [OpeningStockService, ItemStockLedgerService, OpeningStockExceptionFilter],
})
export class OpeningStockModule {}
