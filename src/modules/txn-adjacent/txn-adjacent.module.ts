import { Module } from '@nestjs/common';
import { TxnAdjacentController } from './txn-adjacent.controller';
import { TxnAdjacentService } from './txn-adjacent.service';

/** Notes 142 — `GET /txn/adjacent`, Previous / Next for every document type. */
@Module({
  controllers: [TxnAdjacentController],
  providers: [TxnAdjacentService],
})
export class TxnAdjacentModule {}
