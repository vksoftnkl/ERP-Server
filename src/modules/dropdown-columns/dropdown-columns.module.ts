import { Module } from '@nestjs/common';
import { DropdownColumnExceptionFilter } from './dropdown-column-exception.filter';
import { DropdownColumnsController } from './dropdown-columns.controller';
import { DropdownColumnsService } from './dropdown-columns.service';
@Module({
  controllers: [DropdownColumnsController],
  providers: [DropdownColumnsService, DropdownColumnExceptionFilter],
})
export class DropdownColumnsModule {}
