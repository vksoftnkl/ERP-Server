import { Module } from '@nestjs/common';
import { DocRegisterService } from './doc-register.service';
import { StatutoryService } from './statutory.service';
import { VoucherPostingService } from './voucher-posting.service';

/**
 * The shared posting pieces (voucher_register.md §7): the one routine that
 * writes a voucher's header and legs, the GST register writer, and the
 * statutory limits both consult. No controller, no routes. The sales
 * documents reach them through `SalesPostingModule`, which re-exports this
 * module; the Voucher Register imports it directly.
 */
const SERVICES = [VoucherPostingService, DocRegisterService, StatutoryService];

@Module({
  providers: SERVICES,
  exports: SERVICES,
})
export class CommonPostingModule {}
