import { Module } from '@nestjs/common';
import { PrintRenderModule } from '../../settings/print-render/print-render.module';
import { PrintTemplateAssignmentModule } from '../../settings/print-template-assignment/print-template-assignment.module';
import { StickerExceptionFilter } from './sticker-exception.filter';
import { StickerJobsService } from './sticker-jobs.service';
import { StickerLinesService } from './sticker-lines.service';
import { StickersController } from './stickers.controller';

/**
 * Sticker Printing (menu 32, plan S-P1): the line builder, the sticker jobs,
 * Test print. Renders through print-render's ONE label path; resolves the
 * label purpose's design and printer through the assignment ladder.
 *
 * StickerLinesService is exported for S-P2 (stickers from a GRN / purchase
 * bill): it is the one builder of a sticker line.
 */
@Module({
  imports: [PrintRenderModule, PrintTemplateAssignmentModule],
  controllers: [StickersController],
  providers: [StickerLinesService, StickerJobsService, StickerExceptionFilter],
  exports: [StickerLinesService, StickerJobsService],
})
export class StickersModule {}
