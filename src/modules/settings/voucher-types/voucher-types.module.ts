import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { VoucherTypesController } from './voucher-types.controller';
import { VoucherTypesExceptionFilter } from './voucher-types-exception.filter';
import { VoucherTypesService } from './voucher-types.service';

/** Voucher Types master, menu 303 (plan-voucher-types-2026-11-14 §7). */
@Module({
  imports: [AuditLogModule],
  controllers: [VoucherTypesController],
  providers: [VoucherTypesService, VoucherTypesExceptionFilter],
})
export class VoucherTypesModule {}
