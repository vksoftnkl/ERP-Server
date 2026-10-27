import { Module } from '@nestjs/common';
import { AgeingSlabsController } from './ageing-slabs.controller';
import { AgeingSlabsService } from './ageing-slabs.service';

/**
 * The ageing ladder's maintenance (notes 159 §3, menu 294). No report reads
 * the slabs yet; when one does it takes AgeingSlabsService.get — the company's
 * own ladder or the default, whole.
 */
@Module({
  controllers: [AgeingSlabsController],
  providers: [AgeingSlabsService],
  exports: [AgeingSlabsService],
})
export class AgeingSlabsModule {}
