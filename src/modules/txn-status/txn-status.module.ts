import { Module } from '@nestjs/common';
import { TxnStatusController } from './txn-status.controller';
import { TxnStatusService } from './txn-status.service';

/** §1.10 — `GET /txn-status/pending`, the day-close screen's "what is still unposted?". */
@Module({
  controllers: [TxnStatusController],
  providers: [TxnStatusService],
  exports: [TxnStatusService],
})
export class TxnStatusModule {}
