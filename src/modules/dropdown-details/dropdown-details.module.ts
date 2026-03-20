import { Module } from '@nestjs/common';
import { DropdownDetailExceptionFilter } from './dropdown-detail-exception.filter';
import { DropdownDetailsController } from './dropdown-details.controller';
import { DropdownDetailsService } from './dropdown-details.service';
@Module({
  controllers: [DropdownDetailsController],
  providers: [DropdownDetailsService, DropdownDetailExceptionFilter],
})
export class DropdownDetailsModule {}
