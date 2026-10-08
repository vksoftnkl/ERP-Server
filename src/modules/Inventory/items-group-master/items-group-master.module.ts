import { Module } from '@nestjs/common';
import { ItemGroupExceptionFilter } from './item-group-exception.filter';
import { ItemsGroupMasterController } from './items-group-master.controller';
import { ItemsGroupMasterService } from './items-group-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { StockTrackPolicyModule } from 'src/modules/stocks/stock-track-policy/stock-track-policy.module';

@Module({
  imports: [AuditLogModule, StockTrackPolicyModule],
  controllers: [ItemsGroupMasterController],
  providers: [ItemsGroupMasterService, ItemGroupExceptionFilter],
})
export class ItemsGroupMasterModule {}
