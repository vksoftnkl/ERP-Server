import { Module } from '@nestjs/common';
import { SalesPostingModule } from '../../modules/sales/posting/posting.module';
import { SaleReturnModule } from '../../modules/sales/sale-return/sale-return.module';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileReturnController } from './mobile-return.controller';
import { MobileReturnExceptionFilter } from './mobile-return-exception.filter';
import { MobileReturnService } from './mobile-return.service';
import { MobileReturnStatusService } from './mobile-return-status.service';

/** /mobile/returns: sale returns from the React Native salesman app (saved, then posted at once). */
@Module({
  // SalesPostingModule: the return settings (SalesContextService), as the post reads them.
  imports: [SaleReturnModule, SalesPostingModule],
  controllers: [MobileReturnController],
  providers: [
    MobileReturnService,
    MobileReturnStatusService,
    MobileReturnExceptionFilter,
    MobileExceptionFilter,
  ],
})
export class MobileReturnModule {}
