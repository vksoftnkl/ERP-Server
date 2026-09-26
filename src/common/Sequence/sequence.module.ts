import { Module } from '@nestjs/common';
import { SequenceController } from './sequence.controller';
import { SequenceService } from './sequence.service';

@Module({
  controllers: [SequenceController],
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
