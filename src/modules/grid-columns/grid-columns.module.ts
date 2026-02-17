import { Module } from '@nestjs/common';
import { GridColumnExceptionFilter } from './grid-column-exception.filter';
import { GridColumnsController } from './grid-columns.controller';
import { GridColumnsService } from './grid-columns.service';

@Module({
  controllers: [GridColumnsController],
  providers: [GridColumnsService, GridColumnExceptionFilter],
})
export class GridColumnsModule {}
