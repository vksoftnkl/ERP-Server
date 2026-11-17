import { Module } from '@nestjs/common';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileVisitController } from './mobile-visit.controller';
import { MobileVisitService } from './mobile-visit.service';

/** /mobile/visits: check-ins from the React Native salesman app. */
@Module({
  controllers: [MobileVisitController],
  providers: [MobileVisitService, MobileExceptionFilter],
})
export class MobileVisitModule {}
