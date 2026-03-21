import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { LedgerShippingAddressController } from './ledger-shipping-address.controller';
import { LedgerShippingAddressExceptionFilter } from './ledger-shipping-address-exception.filter';
import { LedgerShippingAddressService } from './ledger-shipping-address.service';

@Module({
  imports: [AuditLogModule],
  controllers: [LedgerShippingAddressController],
  providers: [LedgerShippingAddressService, LedgerShippingAddressExceptionFilter],
})
export class LedgerShippingAddressModule {}
