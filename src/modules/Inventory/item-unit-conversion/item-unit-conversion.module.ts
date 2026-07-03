import { Module } from '@nestjs/common';
import { ItemUnitConversionExceptionFilter } from './item-unit-conversion-exception.filter';
import { ItemUnitConversionController } from './item-unit-conversion.controller';
import { ItemUnitConversionService } from './item-unit-conversion.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemUnitConversionController],
  providers: [ItemUnitConversionService, ItemUnitConversionExceptionFilter],
  exports: [ItemUnitConversionService],
})
export class ItemUnitConversionModule {}
