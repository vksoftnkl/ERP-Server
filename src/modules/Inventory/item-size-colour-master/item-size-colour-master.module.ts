import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { ItemAttributeExceptionFilter } from './item-attribute-exception.filter';
import { ItemColourMasterService } from './item-colour-master.service';
import { ItemColoursController } from './item-colours.controller';
import { ItemSizeMasterService } from './item-size-master.service';
import { ItemSizesController } from './item-sizes.controller';

/** Textile auto batch, addendum 2 E1 — `/item-sizes/*` and `/item-colours/*`. */
@Module({
  imports: [AuditLogModule],
  controllers: [ItemSizesController, ItemColoursController],
  providers: [ItemSizeMasterService, ItemColourMasterService, ItemAttributeExceptionFilter],
})
export class ItemSizeColourMasterModule {}
