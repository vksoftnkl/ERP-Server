import { Module } from '@nestjs/common';
import { SaleOrderModule } from '../../modules/sales/sale-order/sale-order.module';
import { SaleOrderExceptionFilter } from '../../modules/sales/sale-order/sale-order-exception.filter';
import { MobileOrderController } from './mobile-order.controller';
import { MobileOrderService } from './mobile-order.service';

/** /mobile/orders: order upload from the React Native salesman app. */
@Module({
  imports: [SaleOrderModule],
  controllers: [MobileOrderController],
  providers: [MobileOrderService, SaleOrderExceptionFilter],
})
export class MobileOrderModule {}
