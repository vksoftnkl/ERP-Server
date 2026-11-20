import { Module } from '@nestjs/common';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileSchemeController } from './mobile-scheme.controller';
import { MobileSchemeService } from './mobile-scheme.service';

/** /mobile/schemes: the promotion schemes the phone downloads for offline orders (read-only). */
@Module({
  controllers: [MobileSchemeController],
  providers: [MobileSchemeService, MobileExceptionFilter],
})
export class MobileSchemeModule {}
