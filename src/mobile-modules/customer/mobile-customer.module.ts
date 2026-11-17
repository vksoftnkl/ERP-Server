import { Module } from '@nestjs/common';
import { CustomerModule } from '../../modules/sales/customer/customer.module';
import { CustomerExceptionFilter } from '../../modules/sales/customer/customer-exception.filter';
import { MobileCustomerController } from './mobile-customer.controller';
import { MobileCustomerService } from './mobile-customer.service';

/** /mobile/customers: the React Native Customers screen (list, entry, delete). */
@Module({
  imports: [CustomerModule],
  controllers: [MobileCustomerController],
  providers: [MobileCustomerService, CustomerExceptionFilter],
})
export class MobileCustomerModule {}
