import { Module } from '@nestjs/common';
import { GridDetailExceptionFilter } from './grid-detail-exception.filter';
import { GridDetailsController } from './grid-details.controller';
import { GridDetailsService } from './grid-details.service';

@Module({
  controllers: [GridDetailsController],
  providers: [GridDetailsService, GridDetailExceptionFilter],
})
export class GridDetailsModule {}
