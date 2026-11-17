import { Module } from '@nestjs/common';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileItemController } from './mobile-item.controller';
import { MobileItemService } from './mobile-item.service';

/** /mobile/items: the React Native order screen's item list and pick lists (read-only). */
@Module({
  controllers: [MobileItemController],
  providers: [MobileItemService, MobileExceptionFilter],
})
export class MobileItemModule {}
