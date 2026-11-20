import { Module } from '@nestjs/common';
import { SaleOrderModule } from '../../modules/sales/sale-order/sale-order.module';
import { AppSettingsModule } from '../../modules/settings/appSettings/app-settings.module';
import { SaleOrderExceptionFilter } from '../../modules/sales/sale-order/sale-order-exception.filter';
import { MobileOrderController } from './mobile-order.controller';
import { MobileOrderService } from './mobile-order.service';

/** /mobile/orders: order upload from the React Native salesman app. */
@Module({
  // AppSettingsModule: the item-price lookup and the company's pricing settings
  // the desktop stamps on an order (mobile-order-desktop-fill).
  imports: [SaleOrderModule, AppSettingsModule],
  controllers: [MobileOrderController],
  providers: [MobileOrderService, SaleOrderExceptionFilter],
})
export class MobileOrderModule {}
