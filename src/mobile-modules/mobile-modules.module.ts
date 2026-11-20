import { Module } from '@nestjs/common';
import { MobileBankModule } from './bank/mobile-bank.module';
import { MobileBillModule } from './bill/mobile-bill.module';
import { MobileCustomerModule } from './customer/mobile-customer.module';
import { MobileItemModule } from './item/mobile-item.module';
import { MobileMeModule } from './me/mobile-me.module';
import { MobileOrderModule } from './order/mobile-order.module';
import { MobileReceiptModule } from './receipt/mobile-receipt.module';
import { MobileReturnModule } from './return/mobile-return.module';
import { MobileSchemeModule } from './scheme/mobile-scheme.module';
import { MobileVisitModule } from './visit/mobile-visit.module';

/**
 * Every route the React Native app calls that the desktop routes do not serve
 * as is, under /mobile/*. Each feature is its own module; app.module imports
 * only this one.
 */
@Module({
  imports: [
    MobileCustomerModule,
    MobileItemModule,
    MobileOrderModule,
    MobileVisitModule,
    MobileBillModule,
    MobileReceiptModule,
    MobileReturnModule,
    MobileSchemeModule,
    MobileMeModule,
    MobileBankModule,
  ],
})
export class MobileModulesModule {}
