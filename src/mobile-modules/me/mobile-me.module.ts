import { Module } from '@nestjs/common';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileMeController } from './mobile-me.controller';
import { MobileMeService } from './mobile-me.service';

/** /mobile/me: the signed-in login, its employee and its rights (read-only). */
@Module({
  controllers: [MobileMeController],
  providers: [MobileMeService, MobileExceptionFilter],
})
export class MobileMeModule {}
