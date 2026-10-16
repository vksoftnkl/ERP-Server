import { Module } from '@nestjs/common';
import { TenderDayBookController } from './tender-day-book.controller';
import { TenderDayBookService } from './tender-day-book.service';

/**
 * reports/tender-day-book — notes 126 §4: the Day Book by tender and the money
 * lines with no tender. Read-only; imports no feature module (Prisma and the
 * request context are global). The labelling SQL mirrors common/posting/
 * money-lines.ts, which writes the labels.
 */
@Module({
  controllers: [TenderDayBookController],
  providers: [TenderDayBookService],
})
export class TenderDayBookModule {}
