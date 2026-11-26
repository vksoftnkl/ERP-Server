import { Module } from '@nestjs/common';
import { PrintRenderModule } from '../../settings/print-render/print-render.module';
import { PrintTemplateAssignmentModule } from '../../settings/print-template-assignment/print-template-assignment.module';
import { StickerDocSourceService } from './sticker-doc-source.service';
import { StickerExceptionFilter } from './sticker-exception.filter';
import { StickerJobsService } from './sticker-jobs.service';
import { StickerLinesService } from './sticker-lines.service';
import { StickersController } from './stickers.controller';

/**
 * Sticker Printing (menu 32, plan S-P1): the line builder, the sticker jobs,
 * Test print. Renders through print-render's ONE label path; resolves the
 * label purpose's design and printer through the assignment ladder.
 *
 * StickerLinesService is the one builder of a sticker line;
 * StickerDocSourceService (S-P2) reads a posted purchase bill / shortage
 * receipt's lines and counts (S-P3 adds the Make's reader there).
 */
@Module({
  imports: [PrintRenderModule, PrintTemplateAssignmentModule],
  controllers: [StickersController],
  providers: [
    StickerLinesService,
    StickerDocSourceService,
    StickerJobsService,
    StickerExceptionFilter,
  ],
  exports: [StickerLinesService, StickerDocSourceService, StickerJobsService],
})
export class StickersModule {}
