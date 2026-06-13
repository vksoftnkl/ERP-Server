import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DropdownDetailExceptionFilter } from './dropdown-detail-exception.filter';
import { DropdownDetailsController } from './dropdown-details.controller';
import { DropdownDetailsService } from './dropdown-details.service';
@Module({
  imports: [AuditLogModule],
  controllers: [DropdownDetailsController],
  providers: [DropdownDetailsService, DropdownDetailExceptionFilter],
})
export class DropdownDetailsModule {}
